import { useState, useCallback } from "react";
import JSZip from "jszip";
import { z } from "zod";
import { ConfigSchema, PoiSchema, CategorySchema } from "../../lib/schema";
import { DropZone } from "../../components/DropZone";
import { t, type UiLang } from "../../lib/i18n";
import type { BuilderContext, Step } from "./types";

export function StepImport(props: BuilderContext) {
  const {
    cfg, uiLang, setStep, builderAssets,
    setBuilderConfig, setBuilderData, setBuilderAsset, removeBuilderAsset,
    previewBuilder,
  } = props;

  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [importedName, setImportedName] = useState("");

  const clearAllAssets = useCallback(() => {
    if (builderAssets.floorFile) removeBuilderAsset("floor", "");
    for (const k of Object.keys(builderAssets.images)) {
      removeBuilderAsset("image", k);
    }
  }, [builderAssets, removeBuilderAsset]);

  const importZip = useCallback(async (file: File) => {
    if (!window.confirm(t(uiLang, "confirm_overwrite"))) return;
    setImportError("");
    setImportState("loading");
    setImportedName(file.name);

    try {
      const zip = await JSZip.loadAsync(file);
      const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir && !p.startsWith("__MACOSX/"));
      const cfgPath = paths.find(p => p.endsWith("data/config.json"));
      if (!cfgPath) throw new Error("data/config.json が見つかりませんでした");
      const prefix = cfgPath.slice(0, cfgPath.length - "data/config.json".length);

      async function readJson<T>(rel: string): Promise<T> {
        const f = zip.file(prefix + rel);
        if (!f) throw new Error(`${rel} が見つかりませんでした`);
        return JSON.parse(await f.async("text")) as T;
      }

      const nextCfg = ConfigSchema.parse(await readJson("data/config.json"));
      const nextPois = z.array(PoiSchema).parse(await readJson("data/pois.json"));
      const nextCats = z.array(CategorySchema).parse(await readJson("data/categories.json"));

      setBuilderConfig(nextCfg);
      setBuilderData(nextPois, nextCats);
      clearAllAssets();

      // Floor image
      const floorUrl = nextCfg.mode === "indoor" ? (nextCfg.indoor?.imageUrl || "") : "";
      const floorPath = floorUrl.replace(/^\//, "");
      if (floorPath) {
        const floorEntry = zip.file(prefix + floorPath);
        if (floorEntry) {
          const blob = await floorEntry.async("blob");
          const name = floorPath.split("/").pop() || "floor.png";
          setBuilderAsset("floor", floorUrl, new File([blob], name, { type: blob.type || "image/png" }));
        }
      }

      // Images
      const imageEntries = paths.filter(p => p.startsWith(prefix + "images/"));
      for (const p of imageEntries) {
        const entry = zip.file(p);
        if (!entry) continue;
        const blob = await entry.async("blob");
        const name = p.split("/").pop() || "image";
        const key = "/" + p.slice(prefix.length);
        setBuilderAsset("image", key, new File([blob], name, { type: blob.type || "" }));
      }

      previewBuilder();
      setImportState("done");
    } catch (e: any) {
      setImportError(String(e?.message ?? e));
      setImportState("error");
    }
  }, [uiLang, setBuilderConfig, setBuilderData, clearAllAssets, setBuilderAsset, previewBuilder]);

  return (
    <div className="cards">
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "import_title")}</div>
        <div className="hint" style={{ marginBottom: 12 }}>{t(uiLang, "import_hint")}</div>
        <DropZone
          title={t(uiLang, "import_choose_zip")}
          accept=".zip"
          multiple={false}
          onFiles={(files) => {
            const f = files.item?.(0) ?? files[0];
            if (f) importZip(f);
          }}
          buttonLabel={t(uiLang, "import_choose_zip")}
        />
        {importedName ? <div className="hint" style={{ marginTop: 8 }}>{importedName}</div> : null}
        {importState === "loading" ? <div className="hint" style={{ marginTop: 8 }}>{t(uiLang, "loading")}</div> : null}
        {importState === "done" ? <div className="hint" style={{ marginTop: 8 }}>{t(uiLang, "import_loaded")}</div> : null}
        {importState === "error" && importError ? <div className="hint" style={{ marginTop: 8, color: "var(--danger)" }}>{importError}</div> : null}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className={"btn " + (importState === "done" ? "primary" : "soft")} onClick={() => setStep(1)} disabled={importState !== "done"}>
            {t(uiLang, "next_template")}
          </button>
        </div>
      </div>
    </div>
  );
}
