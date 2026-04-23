import { useState } from "react";
import { toast } from "../../components/ToastHost";
import { exportContentZip, exportSiteZip, downloadBlob, type ThemePreset } from "../../lib/export";
import { t } from "../../lib/i18n";
import { QrModal } from "../../components/QrModal";
import type { BuilderContext } from "./types";

export function StepPublish(props: BuilderContext) {
  const { cfg, builderPois, builderCategories, builderAssets, uiLang, setStep } = props;

  const [publishTheme, setPublishTheme] = useState<ThemePreset>("blue");
  const [exportLoading, setExportLoading] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const themes = [
    { key: "blue", label: t(uiLang, "theme_blue"), color: "#6ea8fe" },
    { key: "green", label: t(uiLang, "theme_green"), color: "#2fd4a3" },
    { key: "orange", label: t(uiLang, "theme_orange"), color: "#ffb020" },
    { key: "purple", label: t(uiLang, "theme_purple"), color: "#b39ddb" },
    { key: "red", label: t(uiLang, "theme_red"), color: "#ff6b6b" },
  ] as const;

  return (
    <div className="cards">
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "publish_title")}</div>
        <div className="hint">{t(uiLang, "publish_hint")}</div>

        {/* Color template */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>{t(uiLang, "publish_color_templates")}</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {themes.map(p => (
              <button key={p.key} className={"btn " + (publishTheme === p.key ? "primary" : "")} type="button"
                onClick={() => setPublishTheme(p.key as ThemePreset)}>
                <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, background: p.color, marginRight: 8 }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Download buttons */}
        <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={!!exportLoading} onClick={async () => {
            setExportLoading(t(uiLang, "generating_zip"));
            try {
              const blob = await exportSiteZip({
                config: cfg, pois: builderPois, categories: builderCategories,
                floorFile: builderAssets.floorFile, floorFiles: builderAssets.floorFiles, images: builderAssets.images,
                themePreset: publishTheme,
              });
              downloadBlob(blob, "site.zip");
            } finally { setExportLoading(""); }
          }}>
            {t(uiLang, "download_site_zip")}
          </button>
          <button className="btn" onClick={() => setQrOpen(true)}>{t(uiLang, "qr_title")}</button>
          <button className="btn" onClick={() => setStep(3)}>{t(uiLang, "back")}</button>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn" disabled={!!exportLoading} onClick={async () => {
            setExportLoading(t(uiLang, "generating_zip"));
            try {
              const blob = await exportContentZip({
                config: cfg, pois: builderPois, categories: builderCategories,
                floorFile: builderAssets.floorFile, floorFiles: builderAssets.floorFiles, images: builderAssets.images,
              });
              downloadBlob(blob, "content-pack.zip");
            } finally { setExportLoading(""); }
          }}>
            {t(uiLang, "download_content_pack")}
          </button>
        </div>

        {exportLoading ? (
          <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
            <div className="msf-spinner" style={{ width: 20, height: 20 }} />
            <span className="hint">{exportLoading}</span>
          </div>
        ) : null}

        {/* Embed code */}
        <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--card2)", borderRadius: 12, border: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>{t(uiLang, "embed_title")}</div>
          <div className="hint" style={{ marginBottom: 8 }}>{t(uiLang, "embed_hint")}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1, fontSize: 11, padding: "6px 10px", background: "var(--input-bg)",
              borderRadius: 8, border: "1px solid var(--line)", color: "var(--muted)",
              overflow: "auto", whiteSpace: "nowrap",
            }}>
              {`<iframe src="YOUR_URL/#/" width="100%" height="600" frameborder="0" allow="geolocation"></iframe>`}
            </code>
            <button className="btn soft" onClick={() => {
              const code = `<iframe src="YOUR_URL/#/" width="100%" height="600" frameborder="0" allow="geolocation"></iframe>`;
              navigator.clipboard?.writeText(code).then(() => toast.success(t(uiLang, "copied"))).catch(() => {});
            }}>
              {t(uiLang, "copy_embed_code")}
            </button>
          </div>
        </div>
      </div>

      {qrOpen ? (
        <QrModal
          onClose={() => setQrOpen(false)}
          uiLang={uiLang}
          url={window.location.href.replace(/#\/builder.*/, "#/")}
        />
      ) : null}
    </div>
  );
}
