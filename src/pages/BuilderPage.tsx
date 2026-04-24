import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../components/ToastHost";
import { useLocation } from "react-router-dom";
import * as L from "leaflet";
import JSZip from "jszip";
import { z } from "zod";
import { useAppStore } from "../state/store";
import { ConfigSchema, PoiSchema, CategorySchema, type AppConfig, type Poi, type Category } from "../lib/schema";
import { parseCategoriesFromCsv, parsePoisFromCsv, exampleCategoriesCsv, examplePoisCsv } from "../lib/csv";
import { validateAll } from "../lib/validation";
import { DropZone } from "../components/DropZone";
import { MapView } from "../components/MapView";
import { DetailsModal } from "../components/DetailsModal";
import { FloorSelector } from "../components/FloorSelector";
import { QrModal } from "../components/QrModal";
import { compressImage, guessImagePath, ImageTooLargeError, formatBytes, MAX_INPUT_IMAGE_BYTES } from "../lib/image";
import { exportContentZip, exportSiteZip, downloadBlob, type ThemePreset } from "../lib/export";
import { poisToGeoJson, geoJsonToPois, geoJsonToString } from "../lib/geojson";
import { pickPoiName, pickCategoryLabel } from "../lib/contentText";
import { t, langLabel, type UiLang } from "../lib/i18n";
import { publicUrl } from "../lib/publicUrl";

const nextSequentialPoiId = (pois: { id: string }[]): string => {
  let max = 0;
  for (const p of pois) {
    const s = String(p.id ?? "");
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (n > max) max = n;
    }
  }
  return String(max + 1);
};


type Step = 0 | 1 | 2 | 3 | 4;
type EditorMode = "easy" | "csv";
type MarkerType = Category["markerType"];

const MARKER_TYPES: MarkerType[] = ["pin", "dot", "badge", "ring", "square", "hex", "flag"];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Fix #6: Wraps compressImage with user-friendly error handling. Returns null on failure. */
async function safeCompressImage(
  file: File,
  maxWidthOrHeight: number,
  uiLang: "ja" | "en"
): Promise<File | null> {
  try {
    return await compressImage(file, maxWidthOrHeight);
  } catch (err: any) {
    if (err instanceof ImageTooLargeError) {
      toast.error(uiLang === "ja"
        ? `画像が大きすぎます（${formatBytes(err.sizeBytes)}）。最大サイズは${formatBytes(err.maxBytes)}です。`
        : `Image too large (${formatBytes(err.sizeBytes)}). Maximum is ${formatBytes(err.maxBytes)}.`);
    } else {
      toast.error(uiLang === "ja"
        ? `画像の処理に失敗しました: ${err?.message || err}`
        : `Failed to process image: ${err?.message || err}`);
    }
    return null;
  }
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}

function csvEscape(v: string): string {
  const s = String(v ?? "");
  if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function poisToCsv(pois: Poi[], cfgSupportedLangs: string[], defaultLang: string): string {
  const extra = cfgSupportedLangs.filter(l => l !== defaultLang);
  const headers = [
    "id",
    "name",
    "description",
    ...extra.map(l => `name_${l}`),
    ...extra.map(l => `description_${l}`),
    "category",
    "image",
    "lat",
    "lng",
    "x",
    "y",
    "url",
    "hours",
    "closed",
    "floor"
  ];
  const rows = pois.map(p => {
    const cols: string[] = [];
    cols.push(p.id ?? "");
    cols.push(p.name ?? "");
    cols.push(p.description ?? "");
    for (const l of extra) cols.push((p.nameI18n ?? {})[l] ?? "");
    for (const l of extra) cols.push((p.descriptionI18n ?? {})[l] ?? "");
    cols.push(p.category ?? "");
    cols.push(p.image ?? "");
    cols.push(p.lat !== undefined ? String(p.lat) : "");
    cols.push(p.lng !== undefined ? String(p.lng) : "");
    cols.push(p.x !== undefined ? String(p.x) : "");
    cols.push(p.y !== undefined ? String(p.y) : "");
    cols.push(p.url ?? "");
    cols.push(p.hours ?? "");
    cols.push(p.closed ?? "");
    cols.push(p.floor ?? "");
    return cols.map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function categoriesToCsv(cats: Category[], cfgSupportedLangs: string[], defaultLang: string): string {
  const extra = cfgSupportedLangs.filter(l => l !== defaultLang);
  const headers = [
    "category",
    "label",
    ...extra.map(l => `label_${l}`),
    "icon",
    "order",
    "markerType",
    "markerColor"
  ];
  const rows = cats.map(c => {
    const cols: string[] = [];
    cols.push(c.category ?? "");
    cols.push(c.label ?? "");
    for (const l of extra) cols.push((c.labelI18n ?? {})[l] ?? "");
    cols.push(c.icon ?? "");
    cols.push(c.order !== undefined ? String(c.order) : "");
    cols.push(c.markerType ?? "");
    cols.push(c.markerColor ?? "");
    return cols.map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function ensureDefaultCategory(uiLang: UiLang, cats: Category[]): Category[] {
  if (cats.length) return cats;
  return [{
    category: "general",
    label: uiLang === "ja" ? "一般" : "General",
    labelI18n: { ja: "一般", en: "General" },
    icon: "📍",
    order: 1,
    markerType: "pin",
    markerColor: "#d4b87a"
  }];
}



function hashString(s: string): string {
  // fast non-crypto hash (djb2-ish) for UI state tracking
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function BuilderPage() {
  const loc = useLocation();
  const importFlow = useMemo(() => {
    try {
      const sp = new URLSearchParams(loc.search);
      return sp.get("mode") === "import";
    } catch {
      return false;
    }
  }, [loc.search]);

  const {
    isLoaded,
    loadFromPublic,

    builderConfig,
    builderPois,
    builderCategories,
    builderAssets,

    setBuilderConfig,
    setBuilderData,
    updateBuilderPoi,

    setBuilderAsset,
    removeBuilderAsset,

    previewBuilder,

    uiLang,
    setUiLang,
    contentLang,
    setContentLang,

    builderUndo,

    undoBuilder,


    builderEpoch,
  } = useAppStore(s => ({
    isLoaded: s.isLoaded,
    loadFromPublic: s.loadFromPublic,

    builderConfig: s.builderConfig,
    builderPois: s.builderPois,
    builderCategories: s.builderCategories,
    builderAssets: s.builderAssets,

    setBuilderConfig: s.setBuilderConfig,
    setBuilderData: s.setBuilderData,
    updateBuilderPoi: s.updateBuilderPoi,

    setBuilderAsset: s.setBuilderAsset,
    removeBuilderAsset: s.removeBuilderAsset,

    previewBuilder: s.previewBuilder,

    uiLang: s.uiLang,
    setUiLang: s.setUiLang,
    contentLang: s.contentLang,
    setContentLang: s.setContentLang,

    builderUndo: s.builderUndo,

    undoBuilder: s.undoBuilder,


    builderEpoch: s.builderEpoch,
  }));


const canUndo = !!builderUndo;
const [undoTick, setUndoTick] = useState(0);

const onUndo = useCallback(() => {
  if (!canUndo) return;
  undoBuilder();
  setUndoTick((v) => v + 1);
}, [canUndo, undoBuilder]);

  const [step, setStep] = useState<Step>(() => (importFlow ? 0 : 1));
  // Step3 has two sub-views: map preview and issue list
  const [previewTab, setPreviewTab] = useState<"map" | "issues">("map");
  const [editorMode, setEditorMode] = useState<EditorMode>("easy");

  // ① チュートリアルウォークスルー
  const [tutorialStep, setTutorialStep] = useState<number>(() => {
    try { return localStorage.getItem("atlaskobo_tutorial_done") === "1" ? -1 : 0; } catch { return 0; }
  });
  const dismissTutorial = () => {
    try { localStorage.setItem("atlaskobo_tutorial_done", "1"); } catch {}
    setTutorialStep(-1);
  };
  const tutorialSteps = [
    {
      ja: { title: "AtlasKoboへようこそ 🗺️", body: "このツールでは、地図サイトを3ステップで作れます。まずはテンプレート（目的）を選びましょう。" },
      en: { title: "Welcome to AtlasKobo 🗺️", body: "Build a map site in 3 steps. First, pick a template that fits your purpose." },
      target: 1,
    },
    {
      ja: { title: "地点を追加しよう 📍", body: "「2.データ・画像」でスポット（マーカー）を追加します。「地点を追加」ボタンを押してみましょう。" },
      en: { title: "Add places 📍", body: "Go to '2.Data & images' and press 'Add place' to add your first spot." },
      target: 2,
    },
    {
      ja: { title: "完成イメージを確認 👀", body: "「3.できあがり確認」で公開サイトのプレビューが見られます。OKなら「4.公開」でZIPをダウンロードして完成！" },
      en: { title: "Preview & publish 👀", body: "Check '3.Check' to preview the published site. When ready, go to '4.Publish' to download the ZIP." },
      target: 3,
    },
  ] as const;

  // ② テンプレートプレビュー
  /**
   * Template presets. Each defines:
   * - ja/en: display label
   * - icon: preview emoji
   * - needs: recommended category keys (for "reco" feature)
   * - categories: full category objects to auto-create when user picks the template
   */
  const TEMPLATE_PREVIEWS: Record<string, {
    ja: string;
    en: string;
    needs: string[];
    icon: string;
    categories: Array<{ category: string; label: string; labelEn?: string; icon: string; color: string }>
  }> = {
    tourism: {
      ja: "観光マップ", en: "Tourism", icon: "🏯",
      needs: ["お土産", "駅", "飯屋"],
      categories: [
        { category: "お土産", label: "お土産", labelEn: "Souvenir", icon: "🎁", color: "#e67e22" },
        { category: "駅", label: "駅", labelEn: "Station", icon: "🚉", color: "#3498db" },
        { category: "飯屋", label: "飯屋", labelEn: "Restaurant", icon: "🍽️", color: "#e74c3c" },
        { category: "観光地", label: "観光地", labelEn: "Sightseeing", icon: "🏯", color: "#9b59b6" },
      ],
    },
    live: {
      ja: "ライブ", en: "Live event", icon: "🎤",
      needs: ["ホテル", "駅", "飯屋"],
      categories: [
        { category: "会場", label: "会場", labelEn: "Venue", icon: "🎤", color: "#e74c3c" },
        { category: "ホテル", label: "ホテル", labelEn: "Hotel", icon: "🏨", color: "#3498db" },
        { category: "駅", label: "駅", labelEn: "Station", icon: "🚉", color: "#2ecc71" },
        { category: "飯屋", label: "飯屋", labelEn: "Restaurant", icon: "🍽️", color: "#f39c12" },
      ],
    },
    convenience: {
      ja: "便利マップ", en: "Convenience", icon: "🗺️",
      needs: [],
      categories: [
        { category: "一般", label: "一般", labelEn: "General", icon: "📍", color: "#6ea8fe" },
      ],
    },
    festival: {
      ja: "祭り", en: "Festival", icon: "🎆",
      needs: ["駐車場", "トイレ", "救護"],
      categories: [
        { category: "屋台", label: "屋台", labelEn: "Food stall", icon: "🍡", color: "#e74c3c" },
        { category: "駐車場", label: "駐車場", labelEn: "Parking", icon: "🅿️", color: "#3498db" },
        { category: "トイレ", label: "トイレ", labelEn: "Toilet", icon: "🚻", color: "#95a5a6" },
        { category: "救護", label: "救護", labelEn: "First aid", icon: "🚑", color: "#e74c3c" },
      ],
    },
    school_festival: {
      ja: "文化祭", en: "School fest", icon: "🏫",
      needs: ["スケジュール", "展示", "食べ物"],
      categories: [
        { category: "展示", label: "展示", labelEn: "Exhibit", icon: "🎨", color: "#9b59b6" },
        { category: "食べ物", label: "食べ物", labelEn: "Food", icon: "🍱", color: "#e67e22" },
        { category: "ステージ", label: "ステージ", labelEn: "Stage", icon: "🎭", color: "#e74c3c" },
        { category: "トイレ", label: "トイレ", labelEn: "Toilet", icon: "🚻", color: "#95a5a6" },
      ],
    },
    disaster: {
      ja: "防災", en: "Disaster", icon: "🚨",
      needs: ["AED", "避難所", "給水所"],
      categories: [
        { category: "避難所", label: "避難所", labelEn: "Shelter", icon: "🏫", color: "#2ecc71" },
        { category: "AED", label: "AED", labelEn: "AED", icon: "❤️", color: "#e74c3c" },
        { category: "給水所", label: "給水所", labelEn: "Water station", icon: "💧", color: "#3498db" },
        { category: "医療", label: "医療", labelEn: "Medical", icon: "🏥", color: "#e74c3c" },
      ],
    },
    outdoor_activity: {
      ja: "アウトドア", en: "Outdoor", icon: "🏕️",
      needs: ["給水所", "コンビニ", "駐車場"],
      categories: [
        { category: "キャンプ場", label: "キャンプ場", labelEn: "Campsite", icon: "🏕️", color: "#27ae60" },
        { category: "コンビニ", label: "コンビニ", labelEn: "Convenience", icon: "🏪", color: "#3498db" },
        { category: "駐車場", label: "駐車場", labelEn: "Parking", icon: "🅿️", color: "#95a5a6" },
        { category: "給水所", label: "給水所", labelEn: "Water", icon: "💧", color: "#3498db" },
      ],
    },
  };

  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    builderConfig?.template ?? "tourism"
  );

  // Fix #3: Sync selectedTemplate when config template changes (e.g., ZIP import)
  useEffect(() => {
    const cfgTmpl = builderConfig?.template;
    if (cfgTmpl && cfgTmpl !== selectedTemplate) {
      setSelectedTemplate(cfgTmpl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderConfig?.template]);

  const applyTemplate = (tmpl: string) => {
    setSelectedTemplate(tmpl);
    const info = TEMPLATE_PREVIEWS[tmpl];
    if (!info) return;

    // Auto-create categories from the template if current categories are empty
    // or the user confirms replacement
    const hasExistingCats = builderCategories.length > 0;
    let applyCategories = !hasExistingCats;
    if (hasExistingCats && info.categories.length > 0) {
      applyCategories = window.confirm(uiLang === "ja"
        ? `「${info.ja}」テンプレートのカテゴリを追加しますか？\n既存のカテゴリは残ります。`
        : `Add categories from the "${info.en}" template?\nExisting categories will be kept.`);
    }

    if (applyCategories) {
      const existingKeys = new Set(builderCategories.map(c => c.category));
      let orderBase = builderCategories.length;
      const newCats = info.categories
        .filter(c => !existingKeys.has(c.category))
        .map((c, idx) => ({
          category: c.category,
          label: c.label,
          labelI18n: c.labelEn ? { ja: c.label, en: c.labelEn } : { ja: c.label },
          icon: c.icon,
          order: orderBase + idx + 1,
          markerType: "pin" as const,
          markerColor: c.color,
        }));
      const mergedCats = [...builderCategories, ...newCats];
      setBuilderData(builderPois, mergedCats);
      setCatsCsv(categoriesToCsv(mergedCats, supportedLangs, defaultLang));
    }

    setBuilderConfig({ ...cfg, template: tmpl as AppConfig["template"], reco: { needs: info.needs, rules: (cfg.reco?.rules ?? {}) } });
  };

  // Keep step in sync when switching between normal / import flow.
  useEffect(() => {
    if (importFlow) {
      setStep(0);
    } else {
      setStep((s) => (s === 0 ? 1 : s));
    }
  }, [importFlow]);

  // When a new map is started, reset local UI state (step, tabs, etc.)
  useEffect(() => {
    setStep(importFlow ? 0 : 1);
    setPreviewTab("map");
    setEditorMode("easy");

    // reset import state
    setImportState("idle");
    setImportError("");
    setImportedName("");

    // reset CSV apply state tracking
    setCsvApplyState("idle");
    csvBaselineRef.current = "";
    csvEverApplied.current = false;
    baselineInitOnce.current = false;
  }, [builderEpoch, importFlow]);

  type ApplyState = "idle" | "pending" | "applied";
  const [csvApplyState, setCsvApplyState] = useState<ApplyState>("idle");

  // Warn users before reloading/closing the tab when there are edits that are not applied to CSV.
  // (Modern browsers show a generic confirmation message; the custom string may be ignored.)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (csvApplyState !== "pending") return;
      e.preventDefault();
      // Some browsers require returnValue to be set.
      e.returnValue = t(uiLang, "reload_warn_unsaved");
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [csvApplyState, uiLang]);

  const csvBaselineRef = useRef<string>("");
  const csvEverApplied = useRef(false);
  const baselineInitOnce = useRef(false);

  const builderHash = useMemo(() => {
    if (!builderConfig) return "";
    const cfgKey = JSON.stringify({
      mode: builderConfig.mode,
      theme: builderConfig.theme,
      i18n: builderConfig.i18n,
      title: builderConfig.title,
      subtitle: builderConfig.subtitle,
      titleI18n: builderConfig.titleI18n,
      subtitleI18n: builderConfig.subtitleI18n,
      indoor: builderConfig.indoor,
      outdoor: builderConfig.outdoor,
    });
    const poisKey = JSON.stringify(builderPois);
    const catsKey = JSON.stringify(builderCategories);
    const assetsKey = JSON.stringify({
      floor: builderAssets.floorFile ? builderAssets.floorFile.name : "",
      images: Object.keys(builderAssets.images || {}).sort(),
    });
    return hashString(cfgKey + "|" + poisKey + "|" + catsKey + "|" + assetsKey);
  }, [builderConfig, builderPois, builderCategories, builderAssets]);

  // Keep button state in sync with whether the current edits are already reflected in the CSV text.
  useEffect(() => {
    if (!builderConfig) return;
    if (!baselineInitOnce.current) {
      baselineInitOnce.current = true;
      csvBaselineRef.current = builderHash;
      setCsvApplyState("idle");
      return;
    }

    if (builderHash !== csvBaselineRef.current) {
      if (csvApplyState !== "pending") setCsvApplyState("pending");
    } else if (csvApplyState === "pending") {
      setCsvApplyState(csvEverApplied.current ? "applied" : "idle");
    }
  }, [builderConfig, builderHash, csvApplyState]);

  const [poisCsv, setPoisCsv] = useState<string>("");
  const [catsCsv, setCatsCsv] = useState<string>("");

  const [activeCategory, setActiveCategory] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const [selectedPoiId, setSelectedPoiId] = useState<string>("");
  const [selectedCatKey, setSelectedCatKey] = useState<string>("");

  // Easy editor: allow editing POI ID safely (unique)
  const [poiIdDraft, setPoiIdDraft] = useState<string>("");
  const [poiIdError, setPoiIdError] = useState<string>("");

  const [picked, setPicked] = useState<Poi | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Import flow
  const [importOk, setImportOk] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");
  // Publish (step 4): color template for the full site zip
  const [publishTheme, setPublishTheme] = useState<ThemePreset>(
    (cfg?.ui?.themePreset ?? "blue") as ThemePreset
  );

  // Fix #2: Sync publishTheme when config changes (e.g., ZIP import loaded new theme)
  useEffect(() => {
    const cfgTheme = cfg?.ui?.themePreset;
    if (cfgTheme && cfgTheme !== publishTheme) {
      setPublishTheme(cfgTheme as ThemePreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.ui?.themePreset]);
  const [exportLoading, setExportLoading] = useState<string>(""); // "" = idle, else = loading message

  // Apply selected publish color template globally (persists to config & viewer).
  useEffect(() => {
    const dark: Record<string, string> = {
      blue:   "#9eb4d4",
      green:  "#a3c4a1",
      orange: "#d4b87a",
      purple: "#b8a3c8",
      red:    "#c97862",
    };
    const light: Record<string, string> = {
      blue:   "#3d5a85",
      green:  "#3a6e45",
      orange: "#8a6a20",
      purple: "#6d4f8a",
      red:    "#8a3d28",
    };
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    const map = theme === "light" ? light : dark;
    const accent = map[publishTheme] || map.orange;
    document.documentElement.style.setProperty("--accent", accent, "important");
    // Do NOT remove the property on cleanup — we want the theme to persist
    // across navigation between builder and viewer.
  }, [publishTheme]);

  // Persist theme choice to the config so it survives reloads and applies in viewer
  useEffect(() => {
    if (!cfg) return;
    if (cfg.ui?.themePreset === publishTheme) return;
    setBuilderConfig({
      ...cfg,
      ui: { ...(cfg.ui ?? { tabTitle: "AtlasKobo — 地図サイト制作キット" }), themePreset: publishTheme }
    });
  }, [publishTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local preview URLs for uploaded images (so changes are visible immediately)
  const [floorPreviewUrl, setFloorPreviewUrl] = useState<string>("");
  const [builderActiveFloor, setBuilderActiveFloor] = useState<string>("");
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const [floorPreviewUrls, setFloorPreviewUrls] = useState<Record<string, string>>({});

  // indoor position picking
  const [pickPos, setPickPos] = useState(false);
  const [addOnMapClick, setAddOnMapClick] = useState(false);

  // Import (edit exported zip) state
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importError, setImportError] = useState<string>("");
  const [importedName, setImportedName] = useState<string>("");

  const clearAllBuilderAssets = useCallback(() => {
    if (builderAssets.floorFile) removeBuilderAsset("floor", "");
    for (const k of Object.keys(builderAssets.floorFiles || {})) {
      removeBuilderAsset("floorMulti", k);
    }
    for (const k of Object.keys(builderAssets.images)) {
      removeBuilderAsset("image", k);
    }
  }, [builderAssets, removeBuilderAsset]);

  const importZipIntoBuilder = useCallback(async (file: File) => {
    if (!window.confirm(t(uiLang, "confirm_overwrite"))) return;
    setImportError("");
    setImportState("loading");
    setImportedName(file.name);

    const zip = await JSZip.loadAsync(file);
    const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir && !p.startsWith("__MACOSX/"));
    const cfgPath = paths.find(p => p.endsWith("data/config.json"));
    if (!cfgPath) throw new Error("data/config.json が見つかりませんでした（site.zip / content-pack.zip を選んでください）");
    const prefix = cfgPath.slice(0, cfgPath.length - "data/config.json".length);

    async function readJson<T>(rel: string): Promise<T> {
      const p = prefix + rel;
      const f = zip.file(p);
      if (!f) throw new Error(`${rel} が見つかりませんでした`);
      const txt = await f.async("text");
      return JSON.parse(txt) as T;
    }

    const rawCfg = await readJson<any>("data/config.json");
    const rawPois = await readJson<any>("data/pois.json");
    const rawCats = await readJson<any>("data/categories.json");

    const nextCfg = ConfigSchema.parse(rawCfg);
    const nextPois = z.array(PoiSchema).parse(rawPois);
    const nextCats = z.array(CategorySchema).parse(rawCats);

    // Replace working data
    setBuilderConfig(nextCfg);
    setBuilderData(nextPois, nextCats);

    // Replace assets (floor + images)
    clearAllBuilderAssets();

    const floorUrl = nextCfg.mode === "indoor" ? (nextCfg.indoor?.imageUrl || "") : "";
    const floorPath = floorUrl.replace(/^\//, "");
    if (floorPath) {
      const floorEntry = zip.file(prefix + floorPath);
      if (floorEntry) {
        const blob = await floorEntry.async("blob");
        const name = floorPath.split("/").pop() || "floor.png";
        const floorFile = new File([blob], name, { type: blob.type || "image/png" });
        setBuilderAsset("floor", floorUrl, floorFile);
      }
    }

    // Multi-floor images
    if (nextCfg.mode === "indoor" && nextCfg.indoor?.floors?.length) {
      for (const floor of nextCfg.indoor.floors) {
        const fUrl = (floor.imageUrl || "").replace(/^\//, "");
        if (!fUrl) continue;
        const fEntry = zip.file(prefix + fUrl);
        if (fEntry) {
          const blob = await fEntry.async("blob");
          const name = fUrl.split("/").pop() || `floor_${floor.id}.png`;
          const file = new File([blob], name, { type: blob.type || "image/png" });
          setBuilderAsset("floorMulti", floor.id, file);
        }
      }
    }

    const imageEntries = paths.filter(p => p.startsWith(prefix + "images/"));
    for (const p of imageEntries) {
      const entry = zip.file(p);
      if (!entry) continue;
      const blob = await entry.async("blob");
      const name = p.split("/").pop() || "image";
      const key = "/" + p.slice(prefix.length);
      const imgFile = new File([blob], name, { type: blob.type || "" });
      setBuilderAsset("image", key, imgFile);
    }

    // Set language to the imported map default
    setContentLang(nextCfg.i18n.defaultLang);
    setUiLang(nextCfg.i18n.defaultLang.toLowerCase().startsWith("en") ? "en" : "ja");

    previewBuilder();
    setImportState("done");
  }, [uiLang, setBuilderConfig, setBuilderData, clearAllBuilderAssets, setBuilderAsset, setContentLang, setUiLang, previewBuilder]);

  // Initialize from public sample data only when there is no working draft.
  // This prevents accidental resets when switching between "見る" and "作る".
  useEffect(() => {
    if (builderConfig) return;
    if (isLoaded) return;
    loadFromPublic().catch(() => {});
  }, [builderConfig, isLoaded, loadFromPublic]);

  // Initialize csv strings when builder data first becomes available
  useEffect(() => {
    if (!builderConfig) return;
    const supported = builderConfig.i18n?.supportedLangs ?? ["ja", "en"];
    const def = builderConfig.i18n?.defaultLang ?? "ja";
    setPoisCsv(poisToCsv(builderPois, supported, def));
    setCatsCsv(categoriesToCsv(builderCategories, supported, def));
  }, [builderConfig]); // only once per config load

  const cfg = builderConfig;
  const supportedLangs = cfg?.i18n?.supportedLangs ?? ["ja", "en"];
  const defaultLang = cfg?.i18n?.defaultLang ?? "ja";
  const effectiveContentLang = contentLang || defaultLang;

  // Create / revoke object URLs for immediate preview of uploaded assets
  useEffect(() => {
    if (!builderAssets.floorFile) { setFloorPreviewUrl(""); return; }
    const url = URL.createObjectURL(builderAssets.floorFile);
    setFloorPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [builderAssets.floorFile]);

  // Auto-detect indoor floor image size from the uploaded file
  useEffect(() => {
    if (!cfg || cfg.mode !== "indoor") return;
    if (!floorPreviewUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return;
      if (cfg.indoor.imageWidthPx === w && cfg.indoor.imageHeightPx === h) return;
      setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, imageWidthPx: w, imageHeightPx: h } });
    };
    img.src = floorPreviewUrl;
    return () => { cancelled = true; };
  }, [cfg?.mode, cfg?.indoor?.imageWidthPx, cfg?.indoor?.imageHeightPx, floorPreviewUrl, setBuilderConfig]);


  useEffect(() => {
    const entries = Object.entries(builderAssets.images ?? {});
    if (!entries.length) { setImagePreviewUrls({}); return; }
    const next: Record<string, string> = {};
    for (const [k, f] of entries) {
      try { next[k] = URL.createObjectURL(f); } catch {}
    }
    setImagePreviewUrls(next);
    return () => {
      for (const u of Object.values(next)) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    };
  }, [builderAssets.images]);

  // Multi-floor image preview URLs (with proper cleanup to avoid memory leaks)
  useEffect(() => {
    const entries = Object.entries(builderAssets.floorFiles ?? {});
    if (!entries.length) { setFloorPreviewUrls({}); return; }
    const next: Record<string, string> = {};
    for (const [k, f] of entries) {
      try { next[k] = URL.createObjectURL(f); } catch {}
    }
    setFloorPreviewUrls(next);
    return () => {
      for (const u of Object.values(next)) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    };
  }, [builderAssets.floorFiles]);

  // Keep the preset selector in sync with current indoor image size (optional UI sugar)

  const issues = useMemo(() => (cfg ? validateAll(cfg, builderPois, builderCategories) : []), [cfg, builderPois, builderCategories]);
  const hasError = issues.some(i => i.level === "error");

  const canNext3 = !!cfg && !hasError;
  const canNext4 = canNext3;

  // Always keep a valid selectedPoiId if possible
  useEffect(() => {
    if (!builderPois.length) { setSelectedPoiId(""); return; }
    if (!selectedPoiId) { setSelectedPoiId(builderPois[0].id); return; }
    if (!builderPois.some(p => p.id === selectedPoiId)) setSelectedPoiId(builderPois[0].id);
  }, [builderPois, selectedPoiId]);

  // Keep POI category non-empty (beginner safety)
  useEffect(() => {
    if (!selectedPoiId) return;
    const p = builderPois.find(pp => pp.id === selectedPoiId);
    if (!p) return;
    if (p.category) return;
    const cats = ensureDefaultCategory(uiLang, builderCategories);
    if (!builderCategories.length) {
      setBuilderData(builderPois, cats);
      setCatsCsv(categoriesToCsv(cats, supportedLangs, defaultLang));
    }
    updateBuilderPoi({ ...p, category: cats[0].category });
  }, [selectedPoiId, builderPois, builderCategories, uiLang, setBuilderData, setCatsCsv, supportedLangs, defaultLang, updateBuilderPoi]);

  const selectedPoi = useMemo(() => builderPois.find(p => p.id === selectedPoiId) ?? null, [builderPois, selectedPoiId]);
  const selectedCat = useMemo(() => builderCategories.find(c => c.category === selectedCatKey) ?? null, [builderCategories, selectedCatKey]);

  // Keep the POI id draft input in sync when selection changes
  useEffect(() => {
    if (!selectedPoiId) { setPoiIdDraft(""); setPoiIdError(""); return; }
    const p = builderPois.find(pp => pp.id === selectedPoiId);
    if (!p) return;
    setPoiIdDraft(p.id);
    setPoiIdError("");
  }, [selectedPoiId, builderPois]);

  const imageChoices = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(builderAssets.images ?? {})) set.add(k);
    for (const p of builderPois) if (p.image) set.add(p.image);
    return Array.from(set).sort();
  }, [builderAssets.images, builderPois]);

  const applyCsv = useCallback(() => {
    if (!cfg) return;
    const nextPois = parsePoisFromCsv(poisCsv);
    let nextCats = parseCategoriesFromCsv(catsCsv);

    nextCats = ensureDefaultCategory(uiLang, nextCats);
    // Ensure every POI has a category
    const catKey = nextCats[0]?.category ?? "general";
    const fixedPois = nextPois.map(p => ({ ...p, category: p.category || catKey }));

    setBuilderData(fixedPois, nextCats);
    // normalize csv view to canonical form
    setPoisCsv(poisToCsv(fixedPois, supportedLangs, defaultLang));
    setCatsCsv(categoriesToCsv(nextCats, supportedLangs, defaultLang));
  }, [cfg, poisCsv, catsCsv, setBuilderData, uiLang, supportedLangs, defaultLang]);

  const updatePoi = useCallback((id: string, patch: Partial<Poi>) => {
    if (!cfg) return;
    const nextPois = builderPois.map(p => p.id === id ? { ...p, ...patch } : p);
    setBuilderData(nextPois, builderCategories);
    setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
  }, [cfg, builderPois, builderCategories, setBuilderData, supportedLangs, defaultLang]);

  const commitPoiId = useCallback(() => {
    if (!cfg) return;
    if (!selectedPoi) return;

    const oldId = selectedPoi.id;
    const nextId = (poiIdDraft || "").trim();
    if (!nextId) {
      setPoiIdError(uiLang === "ja" ? "IDを入力してください" : "Please enter an ID.");
      setPoiIdDraft(oldId);
      return;
    }
    if (nextId === oldId) return;
    if (builderPois.some(p => p.id === nextId)) {
      setPoiIdError(uiLang === "ja" ? "このIDはすでに使われています" : "This ID is already in use.");
      setPoiIdDraft(oldId);
      return;
    }

    const nextPois = builderPois.map(p => (p.id === oldId ? { ...p, id: nextId } : p));
    setBuilderData(nextPois, builderCategories);
    setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
    setSelectedPoiId(nextId);
    setPoiIdError("");

    // Avoid stale details modal pointing to the old id
    if (picked && picked.id === oldId) setPicked(null);
  }, [cfg, selectedPoi, poiIdDraft, builderPois, builderCategories, setBuilderData, supportedLangs, defaultLang, uiLang, picked]);

  const addPoi = useCallback(() => {
    if (!cfg) return;
    const nextCats = ensureDefaultCategory(uiLang, builderCategories);
    if (!builderCategories.length) {
      setBuilderData(builderPois, nextCats);
      setCatsCsv(categoriesToCsv(nextCats, supportedLangs, defaultLang));
    }
    const id = nextSequentialPoiId(builderPois);

    // Give beginners a reasonable starting coordinate near the sample.
    // Outdoor: lat/lng near the configured center.
    // Indoor: x/y near the center of the floor image.
    const n = builderPois.length + 1;
    const s = n % 2 === 0 ? 1 : -1;
    const [baseLat, baseLng] = (cfg.outdoor?.center ?? [35.681236, 139.767125]) as [number, number];
    const dLat = s * 0.00012 * (1 + (n % 5));
    const dLng = -s * 0.00012 * (1 + ((n + 2) % 5));
    const lat = baseLat + dLat;
    const lng = baseLng + dLng;
    const clamp01 = (v: number) => Math.max(0.02, Math.min(0.98, v));
    const x = clamp01(0.5 + s * 0.06 * (1 + (n % 3)));
    const y = clamp01(0.5 - s * 0.05 * (1 + ((n + 1) % 3)));
    const next: Poi = {
      id,
      name: uiLang === "ja" ? "新しい地点" : "New place",
      description: "",
      category: nextCats[0].category,
      image: "",
      url: "",
      nameI18n: {},
      descriptionI18n: {},
      // We always set both pairs so the user doesn't have to understand the fields.
      lat,
      lng,
      x,
      y,
      // Multi-floor: assign to the currently active floor in the builder preview
      floor: (cfg.mode === "indoor" && (cfg.indoor.floors ?? []).length >= 2 && builderActiveFloor)
        ? builderActiveFloor : "",
    };
    const nextPois = [next, ...builderPois];
    setBuilderData(nextPois, nextCats);
    setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
    setSelectedPoiId(id);
  }, [cfg, uiLang, builderCategories, builderPois, builderActiveFloor, setBuilderData, setPoisCsv, setCatsCsv, supportedLangs, defaultLang]);

  const deletePoi = useCallback((id: string) => {
    if (!cfg) return;
    const nextPois = builderPois.filter(p => p.id !== id);
    setBuilderData(nextPois, builderCategories);
    setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
    if (selectedPoiId === id) setSelectedPoiId(nextPois[0]?.id ?? "");
  }, [cfg, builderPois, builderCategories, selectedPoiId, setBuilderData, supportedLangs, defaultLang]);

  const updateCategory = useCallback((key: string, patch: Partial<Category>) => {
    if (!cfg) return;
    const nextCats = builderCategories.map(c => c.category === key ? { ...c, ...patch } : c);
    setBuilderData(builderPois, nextCats);
    setCatsCsv(categoriesToCsv(nextCats, supportedLangs, defaultLang));
  }, [cfg, builderPois, builderCategories, setBuilderData, supportedLangs, defaultLang]);

  const addCategory = useCallback(() => {
    if (!cfg) return;
    const base = "cat";
    let n = builderCategories.length + 1;
    let key = `${base}${n}`;
    while (builderCategories.some(c => c.category === key)) { n++; key = `${base}${n}`; }
    const next: Category = {
      category: key,
      label: uiLang === "ja" ? "新しいカテゴリ" : "New category",
      labelI18n: { ja: "新しいカテゴリ", en: "New category" },
      icon: "📍",
      order: n,
      markerType: "pin",
      markerColor: "#d4b87a",
    };
    const nextCats = [next, ...builderCategories];
    setBuilderData(builderPois, nextCats);
    setCatsCsv(categoriesToCsv(nextCats, supportedLangs, defaultLang));
    setSelectedCatKey(key);
  }, [cfg, builderCategories, builderPois, uiLang, setBuilderData, supportedLangs, defaultLang]);

  const deleteCategory = useCallback((key: string) => {
    if (!cfg) return;
    const nextCats = builderCategories.filter(c => c.category !== key);
    const safeCats = ensureDefaultCategory(uiLang, nextCats);
    const catKey = safeCats[0].category;
    const nextPois = builderPois.map(p => (p.category === key || !p.category) ? { ...p, category: catKey } : p);
    setBuilderData(nextPois, safeCats);
    setCatsCsv(categoriesToCsv(safeCats, supportedLangs, defaultLang));
    setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
    if (selectedCatKey === key) setSelectedCatKey(safeCats[0]?.category ?? "");
  }, [cfg, builderCategories, builderPois, uiLang, selectedCatKey, setBuilderData, supportedLangs, defaultLang]);

  // Sync current easy-editor state into the CSV text areas (useful when switching to CSV mode)
  const syncCsvFromBuilder = useCallback(() => {
    if (!cfg) return;
    setPoisCsv(poisToCsv(builderPois, supportedLangs, defaultLang));

    setCatsCsv(categoriesToCsv(builderCategories, supportedLangs, defaultLang));
  }, [cfg, builderPois, builderCategories, supportedLangs, defaultLang]);

  // After undo, refresh CSV text areas to match the restored builder state.
  useEffect(() => {
    if (undoTick === 0) return;
    syncCsvFromBuilder();
  }, [undoTick, syncCsvFromBuilder]);


  const onPreviewMapClick = useCallback((latlng: L.LatLng) => {
    if (!cfg) return;

    // Resolve floor-specific dimensions for indoor mode
    const resolveIndoorSize = () => {
      let w = cfg.indoor.imageWidthPx;
      let h = cfg.indoor.imageHeightPx;
      const floors = cfg.indoor.floors ?? [];
      if (floors.length >= 2 && builderActiveFloor) {
        const fd = floors.find(f => f.id === builderActiveFloor);
        if (fd) { w = fd.imageWidthPx || w; h = fd.imageHeightPx || h; }
      }
      return { w, h };
    };

    // Add new POI by clicking the map (requested UX improvement)
    if (addOnMapClick) {
      const nextCats = ensureDefaultCategory(uiLang, builderCategories);
      const cats = builderCategories.length ? builderCategories : nextCats;

      const defaultCat = (cats[0]?.category ?? "default") as string;
      const id = nextSequentialPoiId(builderPois);
      const n = builderPois.length + 1;
      const s = n % 2 === 0 ? 1 : -1;

      // Default x/y (used for indoor, and kept filled for outdoor too)
      let x = clamp01(0.5 + s * 0.06 * (1 + (n % 3)));
      let y = clamp01(0.5 - s * 0.05 * (1 + ((n + 1) % 3)));

      let lat = (cfg.outdoor?.center?.[0] ?? 35.681236) + s * 0.0002;
      let lng = (cfg.outdoor?.center?.[1] ?? 139.767125) + s * 0.0002;

      if (cfg.mode === "indoor") {
        const { w, h } = resolveIndoorSize();
        x = clamp01(latlng.lng / w);
        y = clamp01(latlng.lat / h);
      } else {
        lat = latlng.lat;
        lng = latlng.lng;
      }

      // Assign active floor for multi-floor indoor
      const floorVal = (cfg.mode === "indoor" && (cfg.indoor.floors ?? []).length >= 2 && builderActiveFloor)
        ? builderActiveFloor : "";

      const next: Poi = PoiSchema.parse({
        id,
        category: defaultCat,
        name: uiLang === "ja" ? "新しい地点" : "New place",
        description: "",
        image: "",
        lat: round6(lat),
        lng: round6(lng),
        x: round4(x),
        y: round4(y),
        url: "",
        hours: "",
        closed: "",
        floor: floorVal,
      });

      const nextPois = [next, ...builderPois];
      setBuilderData(nextPois, cats);
      setPoisCsv(poisToCsv(nextPois, supportedLangs, defaultLang));
      if (!builderCategories.length) {
        setCatsCsv(categoriesToCsv(cats, supportedLangs, defaultLang));
      }
      setSelectedPoiId(id);
      return;
    }

    if (!pickPos) return;
    if (!selectedPoiId) return;

    if (cfg.mode === "indoor") {
      const { w, h } = resolveIndoorSize();
      const x = clamp01(latlng.lng / w);
      const y = clamp01(latlng.lat / h);

      // Update through the same path as the easy editor so CSV stays in sync.
      updatePoi(selectedPoiId, { x: round4(x), y: round4(y) });
      return;
    }

    // Outdoor: use lat/lng
    updatePoi(selectedPoiId, { lat: round6(latlng.lat), lng: round6(latlng.lng) });
  }, [cfg, pickPos, selectedPoiId, updatePoi, addOnMapClick, builderActiveFloor, uiLang, builderCategories, builderPois, setBuilderData, setPoisCsv, setCatsCsv, supportedLangs, defaultLang]);

  // Keyboard shortcuts: even if focus is inside textarea
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd+Z: one-step undo (avoid interfering with native undo inside inputs)
      if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
        const el = e.target as HTMLElement;
        const tag = (el?.tagName || "").toLowerCase();
        const isTyping = tag === "input" || tag === "textarea" || !!el?.isContentEditable;
        if (!isTyping && canUndo) {
          e.preventDefault();
          onUndo();
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        applyCsv();
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        previewBuilder();
        setStep(3);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [applyCsv, previewBuilder, canUndo, onUndo]);

  // When entering Step 3, default to the map tab
  useEffect(() => {
    if (step === 3) setPreviewTab("map");
  }, [step]);

  const filteredPois = useMemo(() => {
    const q = query.trim().toLowerCase();
    return builderPois.filter(p => {
      if (activeCategory && p.category !== activeCategory) return false;
      const name = pickPoiName(p, effectiveContentLang).toLowerCase();
      if (!q) return true;
      return name.includes(q) || (p.id ?? "").toLowerCase().includes(q);
    });
  }, [builderPois, activeCategory, query, cfg, effectiveContentLang]);

  if (!cfg) {
    // In import flow we want to show the import screen even before sample data finishes loading.
    if (importFlow && step === 0) {
      return (
        <main className="layout layoutSingle">
          <section className="pane">
            <div className="paneHeader">
              <div className="sectionTitleOnly">{t(uiLang, "builder")}</div>
              <div className="row gap6w">
                <button className="btn primary" onClick={() => setStep(0)}>{t(uiLang, "step_import")}</button>
              </div>
            </div>
            <div className="paneBody">
              <div className="cards">
                <div className="card">
                  <div className="sectionTitle">{t(uiLang, "import_title")}</div>
                  <div className="hint mb12">{t(uiLang, "import_hint")}</div>
                  <DropZone
                    title={t(uiLang, "import_choose_zip")}
                    accept=".zip"
                    multiple={false}
                    onFiles={(files) => {
                      const f = files.item(0);
                      if (!f) return;
                      importZipIntoBuilder(f).catch((e: any) => {
                        setImportError(String(e?.message ?? e));
                        setImportState("error");
                      });
                    }}
                    buttonLabel={t(uiLang, "import_choose_zip")}
                  />
                  {importedName ? <div className="hint mt8">{importedName}</div> : null}
                  {importState === "loading" ? <div className="hint mt8">{uiLang === "ja" ? "読み込み中…" : "Importing…"}</div> : null}
                  {importState === "done" ? <div className="hint mt8">{t(uiLang, "import_loaded")}</div> : null}
                  {importState === "error" && importError ? <div className="hint errorTextSm">{importError}</div> : null}
                </div>
              </div>
            </div>
          </section>
        </main>
      );
    }
    return <main className="layout"><section className="pane"><div className="card">{uiLang === "ja" ? "読み込み中…" : "Loading…"}</div></section></main>;
  }

  // In the builder, show the field for the current language without falling back.
  // (If we fallback, beginners may think they're editing Japanese but actually edit English, etc.)
  const titleEditing = (effectiveContentLang === defaultLang)
    ? cfg.title
    : ((cfg.titleI18n ?? {})[effectiveContentLang] ?? "");
  const subtitleEditing = (effectiveContentLang === defaultLang)
    ? (cfg.subtitle ?? "")
    : ((cfg.subtitleI18n ?? {})[effectiveContentLang] ?? "");

  const editingLangLabel = langLabel(effectiveContentLang, uiLang);


  const csvApplyBtnClass =
    "btn " + (csvApplyState === "idle" ? "soft" : csvApplyState === "pending" ? "primary" : "success");

  const onApplyToCsv = () => {
    // Reflect current edits into the CSV text (and also update preview data).
    syncCsvFromBuilder();
    previewBuilder();
    csvEverApplied.current = true;
    csvBaselineRef.current = builderHash;
    setCsvApplyState("applied");
  };

  // ─────────────────────────────────────────────
  // CRITICAL: Auto-initialize builderConfig if user navigates directly to /builder
  // without going through "新規作成" / "編集" flow first.
  // Without this, the BuilderPage crashes (cfg.mode on null) → blank screen.
  // ─────────────────────────────────────────────
  const startNewMap = useAppStore(s => s.startNewMap);
  useEffect(() => {
    if (!builderConfig) {
      startNewMap();
    }
  }, [builderConfig, startNewMap]);

  // Defensive: if builderConfig is still null on first render (before useEffect runs),
  // show a minimal loading state instead of crashing on cfg.mode access.
  if (!builderConfig) {
    return (
      <main className="layout layoutSingle" style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          {uiLang === "ja" ? "読み込み中…" : "Loading…"}
        </div>
      </main>
    );
  }

  return (
    <main className="layout layoutSingle">

      {/* ① チュートリアルウォークスルー */}
      {tutorialStep >= 0 && tutorialStep < tutorialSteps.length ? (() => {
        const ts = tutorialSteps[tutorialStep];
        const txt = uiLang === "ja" ? ts.ja : ts.en;
        const isLast = tutorialStep === tutorialSteps.length - 1;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div style={{
              background: "var(--card)", borderRadius: 20, padding: "28px 28px 22px",
              maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              border: "1px solid var(--line)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{txt.title}</div>
                <button onClick={dismissTutorial}
                  aria-label={uiLang === "ja" ? "閉じる" : "Close"}
                  title={uiLang === "ja" ? "閉じる" : "Close"}
                  style={{
                  background: "transparent", border: "none", color: "var(--muted)",
                  fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px",
                }}><span aria-hidden="true">✕</span></button>
              </div>
              <div style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 20, fontSize: 14 }}>{txt.body}</div>
              {/* progress dots */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                {tutorialSteps.map((_, i) => (
                  <div key={i} style={{
                    width: i === tutorialStep ? 20 : 8, height: 8, borderRadius: 999,
                    background: i === tutorialStep ? "var(--accent)" : "var(--line)",
                    transition: "all .2s",
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="btn soft fs13" onClick={dismissTutorial}>
                  {uiLang === "ja" ? "スキップ" : "Skip"}
                </button>
                <button className="btn primary" onClick={() => {
                  if (isLast) { dismissTutorial(); setStep(ts.target as Step); }
                  else { setTutorialStep(t => t + 1); setStep(ts.target as Step); }
                }}>
                  {isLast
                    ? (uiLang === "ja" ? "はじめる 🚀" : "Let's go 🚀")
                    : (uiLang === "ja" ? "次へ →" : "Next →")}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

      <section className="pane">
        <div className="paneHeader">
          <div className="sectionTitleOnly">{t(uiLang, "builder")}</div>

          <div className="row gap6w">
            {importFlow ? (
              <button className={"btn " + (step === 0 ? "primary" : "")} onClick={() => setStep(0)}>{t(uiLang, "step_import")}</button>
            ) : null}
            <button className={"btn " + (step === 1 ? "primary" : "")} onClick={() => setStep(1)}>{t(uiLang, importFlow ? "step_template_2" : "step_template")}</button>
            <button className={"btn " + (step === 2 ? "primary" : "")} onClick={() => setStep(2)}>{t(uiLang, importFlow ? "step_assets_3" : "step_assets")}</button>
            <button className={"btn " + (step === 3 ? "primary" : "")} onClick={() => setStep(3)} disabled={!canNext3}>{t(uiLang, importFlow ? "step_preview_4" : "step_preview")}</button>
            <button className={"btn " + (step === 4 ? "primary" : "")} onClick={() => setStep(4)} disabled={!canNext4}>{t(uiLang, importFlow ? "step_publish_5" : "step_publish")}</button>

<button className={"btn soft"} onClick={onUndo} disabled={!canUndo} title={uiLang === "ja" ? "Ctrl+Z: 元に戻す" : "Ctrl+Z: Undo"} aria-label={t(uiLang, "undo")} style={{ width: 44, padding: 0, fontSize: 20, lineHeight: "44px" }}>↰</button>
<span className={"savePill " + (csvApplyState === "pending" ? "unsaved" : "saved")} title={uiLang === "ja" ? "CSVに反映されていない変更があるかを表示します" : "Shows whether there are changes not written to CSV"}>
  {csvApplyState === "pending" ? "⚠️" : "✅"} {t(uiLang, csvApplyState === "pending" ? "unsaved" : "saved")}
</span>
          </div>
        </div>

        <div className="paneBody">

        {/* STEP 0 (Import exported zip) */}
        {importFlow && step === 0 ? (
          <div className="cards">
            <div className="card">
              <div className="sectionTitle">{t(uiLang, "import_title")}</div>
              <div className="hint mb12">{t(uiLang, "import_hint")}</div>
              <DropZone
                title={t(uiLang, "import_choose_zip")}
                accept=".zip"
                multiple={false}
                onFiles={(files) => {
                  const f = files.item(0);
                  if (!f) return;
                  importZipIntoBuilder(f).catch((e: any) => {
                    setImportError(String(e?.message ?? e));
                    setImportState("error");
                  });
                }}
                buttonLabel={t(uiLang, "import_choose_zip")}
              />
              {importedName ? <div className="hint mt8">{importedName}</div> : null}
              {importState === "loading" ? <div className="hint mt8">{uiLang === "ja" ? "読み込み中…" : "Importing…"}</div> : null}
              {importState === "done" ? <div className="hint mt8">{t(uiLang, "import_loaded")}</div> : null}
              {importState === "error" && importError ? <div className="hint errorTextSm">{importError}</div> : null}

              <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <button className={"btn " + (importState === "done" ? "primary" : "soft")} onClick={() => setStep(1)} disabled={importState !== "done"}>
                  {t(uiLang, "next_template")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* STEP 1 */}
        {step === 1 ? (
          <div className="cards">
            <div className="card">
              <div className="sectionTitle">{t(uiLang, "template_title")}</div>
              <div className="grid2">
                <label>
                  {t(uiLang, "mode")}
                  <select
                    value={cfg.mode}
                    onChange={(e) => {
                      const mode = e.target.value as AppConfig["mode"];
                      if (mode === "indoor") setBuilderConfig({ ...cfg, mode: "indoor", indoor: { ...cfg.indoor } });
                      else setBuilderConfig({ ...cfg, mode: "outdoor" });
                    }}
                  >
                    <option value="outdoor">{t(uiLang, "mode_outdoor")}</option>
                    <option value="indoor">{t(uiLang, "mode_indoor")}</option>
                  </select>
                </label>

                <label>
                  {t(uiLang, "default_lang")}
                  <select
                    value={cfg.i18n.defaultLang}
                    onChange={(e) => setBuilderConfig({ ...cfg, i18n: { ...cfg.i18n, defaultLang: e.target.value } })}
                  >
                    {supportedLangs.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>

                <label>
                  {t(uiLang, "title")} <span className="badge">({editingLangLabel})</span>
                  <input value={titleEditing} onChange={(e) => {
                    const v = e.target.value;
                    if (effectiveContentLang === cfg.i18n.defaultLang) setBuilderConfig({ ...cfg, title: v });
                    else setBuilderConfig({ ...cfg, titleI18n: { ...(cfg.titleI18n ?? {}), [effectiveContentLang]: v } });
                  }} />
                </label>

                <label>
                  {t(uiLang, "subtitle")} <span className="badge">({editingLangLabel})</span>
                  <input value={subtitleEditing} onChange={(e) => {
                    const v = e.target.value;
                    if (effectiveContentLang === cfg.i18n.defaultLang) setBuilderConfig({ ...cfg, subtitle: v });
                    else setBuilderConfig({ ...cfg, subtitleI18n: { ...(cfg.subtitleI18n ?? {}), [effectiveContentLang]: v } });
                  }} />
                </label>


                <label>
                  {t(uiLang, "tab_title")}
                  <input
                    value={cfg.ui?.tabTitle ?? "AtlasKobo — 地図サイト制作キット"}
                    onChange={(e) => setBuilderConfig({ ...cfg, ui: { ...(cfg.ui ?? {}), tabTitle: e.target.value } })}
                  />
                </label>

                {cfg.mode === "indoor" ? (
                  <div className="hint fullSpan">
                    {uiLang === "ja"
                      ? "屋内画像のサイズ（横幅/縦幅）は、フロア画像をアップロードしたときに自動で読み取ります。"
                      : "Indoor image size (width/height) will be detected automatically when you upload the floor image."}
                  </div>
                ) : null}
              </div>

              <div className="row" style={{ marginTop: 10, justifyContent: importFlow ? "space-between" : "flex-end" }}>
                {importFlow ? (
                  <button className="btn soft" onClick={() => setStep(0)}>{t(uiLang, "back")}（{t(uiLang, "step_import")}）</button>
                ) : <span />}
                <button className="btn primary" onClick={() => setStep(2)}>{t(uiLang, "next_assets")}</button>
              </div>
            </div>

            <div className="card">
              <div className="sectionTitle">{t(uiLang, "template_hint_title")}</div>
              <div className="hint">{t(uiLang, "template_hint_body")}</div>
            </div>

            {/* ② テンプレートプレビューカード */}
            <div className="card">
              <div className="sectionTitleSm">
                {uiLang === "ja" ? "用途テンプレートを選ぶ" : "Choose a purpose template"}
              </div>
              <div className="hint mb12">
                {uiLang === "ja"
                  ? "テンプレートを選ぶと、おすすめ表示の初期設定が自動で入ります。あとから変更できます。"
                  : "Selecting a template auto-fills the recommended spots settings. You can change them later."}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {Object.entries(TEMPLATE_PREVIEWS).map(([key, info]) => {
                  const label = uiLang === "ja" ? info.ja : info.en;
                  const isActive = selectedTemplate === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyTemplate(key)}
                      style={{
                        border: `2px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
                        background: isActive ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--card)",
                        borderRadius: 14,
                        padding: "14px 10px 12px",
                        cursor: "pointer",
                        textAlign: "center",
                        color: "var(--text)",
                        transition: "all .15s",
                      }}
                    >
                      <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{info.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? "var(--accent)" : "var(--text)" }}>{label}</div>
                      {info.needs.length > 0 ? (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                          {info.needs.slice(0, 2).join(" · ")}{info.needs.length > 2 ? " …" : ""}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {selectedTemplate && TEMPLATE_PREVIEWS[selectedTemplate] ? (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--card2)", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    {uiLang === "ja" ? "このテンプレートのおすすめ表示:" : "Recommended spots for this template:"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {TEMPLATE_PREVIEWS[selectedTemplate].needs.length > 0
                      ? TEMPLATE_PREVIEWS[selectedTemplate].needs.map(n => (
                          <span key={n} className="badge">{n}</span>
                        ))
                      : <span style={{ fontSize: 12, color: "var(--muted)" }}>{uiLang === "ja" ? "（なし）" : "(none)"}</span>
                    }
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── おすすめ（reco）設定 ── */}
            <div className="card">
              <div className="sectionTitleSm">
                {uiLang === "ja" ? "おすすめ表示の設定" : "Recommended Spots Settings"}
              </div>
              <div className="hint mb10">
                {uiLang === "ja"
                  ? "公開サイトの上部に「おすすめ」セクションを表示します。カテゴリ名をカンマ区切りで入力してください。カテゴリ名と一致するスポットが自動的に表示されます。"
                  : "Shows a 'Recommended' section at the top of the published site. Enter category names separated by commas."}
              </div>
              <label>
                {uiLang === "ja" ? "おすすめカテゴリ（カンマ区切り）" : "Recommended categories (comma-separated)"}
                <input
                  placeholder={uiLang === "ja" ? "例: お土産, 駅, 飯屋" : "e.g. souvenir, station, restaurant"}
                  value={(cfg.reco?.needs ?? []).join(", ")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const needs = raw.split(/[,、，]/).map((s: string) => s.trim()).filter(Boolean);
                    setBuilderConfig({ ...cfg, reco: { needs, rules: (cfg.reco?.rules ?? {}) } });
                  }}
                />
              </label>
              {(cfg.reco?.needs ?? []).length > 0 ? (
                <div className="hint mt8">
                  {uiLang === "ja" ? "設定済み: " : "Set: "}
                  {(cfg.reco?.needs ?? []).map((n: string) => (
                    <span key={n} className="badge" style={{ marginRight: 4 }}>{n}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* STEP 2 */}
        {step === 2 ? (
          <div className="cards">
            <div className="card">
              <div className="row btnBetween">
                <div>
                  <div className="sectionTitleOnly">{t(uiLang, "edit_data_title")}</div>
                  <div className="hint">{t(uiLang, "edit_data_hint")}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className={"btn " + (editorMode === "easy" ? "primary" : "")} onClick={() => setEditorMode("easy")}>{t(uiLang, "easy_editor")}</button>
                  <button className={"btn " + (editorMode === "csv" ? "primary" : "")} onClick={() => setEditorMode("csv")}>{t(uiLang, "advanced_csv")}</button>
                </div>
              </div>

              {editorMode === "easy" ? (
                <>
                <div className="grid2 mt10">
                  {/* POI list + form */}
                  <div className="card p12">
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{t(uiLang, "pois_easy_title")}</div>

                    <div className="row" style={{ gap: 8 }}>
                      <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
                        <option value="">{t(uiLang, "all")}</option>
                        {builderCategories.map(c => (
                          <option key={c.category} value={c.category}>
                            {(c.icon ? `${c.icon} ` : "") + pickCategoryLabel(c, effectiveContentLang)}
                          </option>
                        ))}
                      </select>
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(uiLang, "search_placeholder")} />
                      <button className="btn" onClick={addPoi}>{t(uiLang, "add_poi")}</button>
                    </div>

                    <div className="list" style={{ marginTop: 10, maxHeight: 260, overflow: "auto" }}>
                      {filteredPois.map(p => (
                        <button
                          key={p.id}
                          className={"listItem " + (p.id === selectedPoiId ? "active" : "")}
                          onClick={() => setSelectedPoiId(p.id)}
                          type="button"
                        >
                          <div className="fw800">{pickPoiName(p, effectiveContentLang)}</div>
                          <div className="hint">{p.id}</div>
                        </button>
                      ))}
                      {!filteredPois.length ? <div className="hint" style={{ padding: 10 }}>{t(uiLang, "select_item_hint")}</div> : null}
                    </div>
                  </div>

                  <div className="card p12">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div className="sectionTitleOnly">{uiLang === "ja" ? "地点の編集" : "Edit place"}</div>
                      {selectedPoi ? (
                        <button className="btn danger" onClick={() => deletePoi(selectedPoi.id)}>{t(uiLang, "delete_poi")}</button>
                      ) : null}
                    </div>

                    {selectedPoi ? (
                      <div className="grid2 mt10">
                        <label>
                          {t(uiLang, "field_id")}
                          <input
                            value={poiIdDraft}
                            tabIndex={9}
                            onChange={(e) => { setPoiIdDraft(e.target.value); setPoiIdError(""); }}
                            onBlur={commitPoiId}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.currentTarget as HTMLInputElement).blur();
                              }
                            }}
                          />
                          {poiIdError ? <div className="hint dangerText">{poiIdError}</div> : null}
                        </label>

                        <label>
                          {t(uiLang, "field_category")}
                          <select tabIndex={3} value={selectedPoi.category} onChange={(e) => updatePoi(selectedPoi.id, { category: e.target.value })}>
                            {ensureDefaultCategory(uiLang, builderCategories).map(c => (
                              <option key={c.category} value={c.category}>
                                {(c.icon ? `${c.icon} ` : "") + pickCategoryLabel(c, effectiveContentLang)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          {t(uiLang, "field_name_ja")}
                          <input
                            tabIndex={1}
                            value={selectedPoi.name}
                            onChange={(e) => updatePoi(selectedPoi.id, { name: e.target.value })}
                          />
                        </label>

                        <label>
                          {t(uiLang, "field_name_en")}
                          <input
                            tabIndex={2}
                            value={(selectedPoi.nameI18n ?? {}).en ?? ""}
                            onChange={(e) => updatePoi(selectedPoi.id, { nameI18n: { ...(selectedPoi.nameI18n ?? {}), en: e.target.value } })}
                          />
                        </label>

                        <label>
                          {t(uiLang, "field_desc_ja")}
                          <textarea
                            value={selectedPoi.description ?? ""}
                            onChange={(e) => updatePoi(selectedPoi.id, { description: e.target.value })}
                            rows={3}
                          />
                        </label>

                        <label>
                          {t(uiLang, "field_desc_en")}
                          <textarea
                            value={(selectedPoi.descriptionI18n ?? {}).en ?? ""}
                            onChange={(e) => updatePoi(selectedPoi.id, { descriptionI18n: { ...(selectedPoi.descriptionI18n ?? {}), en: e.target.value } })}
                            rows={3}
                          />
                        </label>

                        <label>
                          {t(uiLang, "field_image")}
                          <select value={selectedPoi.image ?? ""} onChange={(e) => updatePoi(selectedPoi.id, { image: e.target.value })}>
                            <option value="">{uiLang === "ja" ? "なし" : "None"}</option>
                            {imageChoices.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </label>

                        <label>
                          {t(uiLang, "field_url")}
                          <input value={selectedPoi.url ?? ""} onChange={(e) => updatePoi(selectedPoi.id, { url: e.target.value })} placeholder="https://..." />
                        </label>

{cfg.mode === "outdoor" ? (
  <>
    <label>
      {t(uiLang, "field_hours")}
      <input
        value={selectedPoi.hours ?? ""}
        onChange={(e) => updatePoi(selectedPoi.id, { hours: e.target.value })}
        placeholder={uiLang === "ja" ? "例: 10:00-18:00" : "e.g. 10:00-18:00"}
        title={uiLang === "ja"
          ? "書き方: 10:00-18:00 / 月-金 10:00-20:00、土日 11:00-18:00 / 24時間"
          : "Format: 10:00-18:00 / Mon-Fri 10:00-20:00, Sat-Sun 11:00-18:00 / 24h"}
      />
    </label>
    <label>
      {t(uiLang, "field_closed")}
      <input
        value={selectedPoi.closed ?? ""}
        onChange={(e) => updatePoi(selectedPoi.id, { closed: e.target.value })}
        placeholder={uiLang === "ja" ? "例: 水 （なければ空欄）" : "e.g. Wed (blank if none)"}
        title={uiLang === "ja"
          ? "書き方: 水 / 月,火 / 月-金 / 不定休 ／ 定休日なしは空欄または「無休」"
          : "Format: Wed / Mon,Tue / Mon-Fri / Irregular. Leave blank or write 'None' if no closing day."}
      />
    </label>
    <div className="hint" style={{ gridColumn: "1 / -1", background: "var(--card2)", borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>
        {uiLang === "ja" ? "📝 営業時間の書き方" : "📝 Hours format guide"}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
        {uiLang === "ja" ? (
          <>
            <span className="dispBlock">• 通常: <code>10:00-18:00</code></span>
            <span className="dispBlock">• 曜日別: <code>月-金 10:00-20:00、土日 11:00-18:00</code></span>
            <span className="dispBlock">• 24時間: <code>24時間</code></span>
            <span className="dispBlock">• 定休日: <code>水</code> / <code>月,火</code> / <code>月-金</code> / 定休なし→空欄</span>
          </>
        ) : (
          <>
            <span className="dispBlock">• Regular: <code>10:00-18:00</code></span>
            <span className="dispBlock">• By day: <code>Mon-Fri 10:00-20:00, Sat-Sun 11:00-18:00</code></span>
            <span className="dispBlock">• 24h: <code>24h</code></span>
            <span className="dispBlock">• Closed day: <code>Wed</code> / <code>Mon,Tue</code> / no closed day → leave blank</span>
          </>
        )}
      </div>
    </div>
  </>
) : null}


                        {cfg.mode === "outdoor" ? (
                          <div className="hint fullSpan">
                            {uiLang === "ja"
                              ? "屋外の位置（緯度・経度）は「3.できあがり確認」で地図をクリックして調整できます。"
                              : "You can adjust outdoor position (lat/lng) by clicking the map in Step 3 (Preview)."}
                          </div>
                        ) : (
                          <>
                            <label>
                              x (0〜1)
                              <input
                                type="number"
                                step="0.0001"
                                value={selectedPoi.x ?? ""}
                                onChange={(e) => updatePoi(selectedPoi.id, { x: clamp01(Number(e.target.value)) })}
                              />
                            </label>
                            <label>
                              y (0〜1)
                              <input
                                type="number"
                                step="0.0001"
                                value={selectedPoi.y ?? ""}
                                onChange={(e) => updatePoi(selectedPoi.id, { y: clamp01(Number(e.target.value)) })}
                              />
                            </label>
                            {/* Floor selector for multi-floor indoor */}
                            {(cfg.indoor.floors ?? []).length >= 2 ? (
                              <label>
                                {t(uiLang, "floor_select")}
                                <select
                                  value={selectedPoi.floor || (cfg.indoor.floors ?? [])[0]?.id || ""}
                                  onChange={(e) => updatePoi(selectedPoi.id, { floor: e.target.value })}
                                >
                                  {(cfg.indoor.floors ?? []).map(f => (
                                    <option key={f.id} value={f.id}>{f.label || f.id}</option>
                                  ))}
                                </select>
                              </label>
                            ) : null}
                            <div className="hint fullSpan">
                              {uiLang === "ja"
                                ? "屋内の位置は「できあがり確認」で地図をクリックして調整できます。ここでは数値（0〜1）でも調整できます。"
                                : "You can adjust indoor position by clicking the map in Preview. You can also edit numbers here (0–1)."}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="hint mt10">{t(uiLang, "select_item_hint")}</div>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="card" style={{ padding: 12, gridColumn: "1 / -1" }}>
                    <div className="row btnBetween">
                      <div>
                        <div className="sectionTitleOnly">{t(uiLang, "cats_easy_title")}</div>
                        <div className="hint">{uiLang === "ja" ? "マーカーの形や色もここで選べます。" : "Choose marker type and color here."}</div>
                      </div>
                      <button className="btn" onClick={addCategory}>{t(uiLang, "add_category")}</button>
                    </div>

                    <div className="list mt10">
                      {builderCategories.map(c => {
                        // Category.label is the *default language* label. For beginners, we always show explicit
                        // fields for ja/en, regardless of which is default.
                        const labelJa = (c.labelI18n?.ja ?? (defaultLang === "ja" ? (c.label ?? "") : "")) ?? "";
                        const labelEn = (c.labelI18n?.en ?? (defaultLang === "en" ? (c.label ?? "") : "")) ?? "";
                        const color = c.markerColor || "";  // empty = default (handled by ColorButton)
                        return (
                          <div key={c.category} className="row" style={{ justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ minWidth: 240 }}>
                              <div className="fw800">{(c.icon ? `${c.icon} ` : "")}{labelJa || c.category}</div>
                              <div className="hint">{c.category}</div>
                            </div>

                            <div className="row" style={{ flexWrap: "wrap", gap: 10, justifyContent: "end" }}>
                              <label className="row" style={{ gap: 6 }}>
                                {uiLang === "ja" ? "表示名" : "Label"}
                                <input
                                  value={labelJa}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const nextI18n = { ...(c.labelI18n ?? {}), ja: v };
                                    if (defaultLang === "ja") updateCategory(c.category, { label: v, labelI18n: nextI18n });
                                    else updateCategory(c.category, { labelI18n: nextI18n });
                                  }}
                                  className="w160"
                                />
                              </label>
                              <label className="row" style={{ gap: 6 }}>
                                en
                                <input
                                  value={labelEn}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const nextI18n = { ...(c.labelI18n ?? {}), en: v };
                                    if (defaultLang === "en") updateCategory(c.category, { label: v, labelI18n: nextI18n });
                                    else updateCategory(c.category, { labelI18n: nextI18n });
                                  }}
                                  className="w160"
                                />
                              </label>
                              <label className="row" style={{ gap: 6 }}>
                                icon
                                <input value={c.icon ?? ""} onChange={(e) => updateCategory(c.category, { icon: e.target.value })} style={{ width: 70 }} />
                              </label>
                              <label className="row" style={{ gap: 6 }}>
                                {uiLang === "ja" ? "形" : "Type"}
                                <select value={c.markerType ?? "pin"} onChange={(e) => updateCategory(c.category, { markerType: e.target.value as Category["markerType"] })}>
                                  {MARKER_TYPES.map(mt => <option key={mt} value={mt}>{mt}</option>)}
                                </select>
                              </label>
                              <ColorButton value={color} onChange={(v) => updateCategory(c.category, { markerColor: v })} />
                              <button className="btn danger" onClick={() => deleteCategory(c.category)}>{uiLang === "ja" ? "削除" : "Delete"}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              
                <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
                  <button className={csvApplyBtnClass} onClick={onApplyToCsv}>{t(uiLang, "apply_to_csv")}</button>
                </div>
                </>
              ) : (
                <div className="mt10">
                  <div className="hint">{uiLang === "ja" ? "Ctrl/⌘+Enter: CSVに反映 / Ctrl/⌘+Shift+Enter: プレビュー更新" : "Ctrl/⌘+Enter: Write to CSV / Ctrl/⌘+Shift+Enter: Update preview"}</div>
                  <div className="grid2 mt10">
                    <div>
                      <div className="row btnBetween">
                        <div className="sectionTitleOnly">{t(uiLang, "pois_csv")}</div>
                        <button className="btn" onClick={() => setPoisCsv(examplePoisCsv())}>{t(uiLang, "fill_sample")}</button>
                      </div>
                      <textarea value={poisCsv} onChange={(e) => setPoisCsv(e.target.value)} rows={16} />
                      <div className="hint">{t(uiLang, "poi_csv_hint")}</div>
                    </div>

                    <div>
                      <div className="row btnBetween">
                        <div className="sectionTitleOnly">{t(uiLang, "cats_csv")}</div>
                        <button className="btn" onClick={() => setCatsCsv(exampleCategoriesCsv())}>{t(uiLang, "fill_sample")}</button>
                      </div>
                      <textarea value={catsCsv} onChange={(e) => setCatsCsv(e.target.value)} rows={16} />
                      <div className="hint">{t(uiLang, "cat_csv_hint")}</div>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn primary" onClick={applyCsv}>{t(uiLang, "apply_csv")}</button>
                  </div>
                </div>
              )}
            </div>

            {/* GeoJSON import/export (outdoor mode) */}
            {cfg.mode === "outdoor" ? (
              <div className="card">
                <div className="sectionTitleSm">{uiLang === "ja" ? "GeoJSON 読み込み / 書き出し" : "GeoJSON import / export"}</div>
                <div className="hint mb10">{t(uiLang, "geojson_hint")}</div>
                <div className="row gap8w">
                  <label className="btn" style={{ cursor: "pointer" }}>
                    {t(uiLang, "import_geojson")}
                    <input
                      type="file"
                      accept=".geojson,.json"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const text = await f.text();
                          const geojson = JSON.parse(text);
                          const imported = geoJsonToPois(geojson);
                          if (!imported.length) {
                            toast.error(uiLang === "ja" ? "地点が見つかりませんでした。" : "No places found in the file.");
                            return;
                          }
                          const merged = [...imported, ...builderPois];
                          const cats = ensureDefaultCategory(uiLang, builderCategories);
                          setBuilderData(merged, cats);
                          setPoisCsv(poisToCsv(merged, supportedLangs, defaultLang));
                          toast.success(
                            (uiLang === "ja" ? `${imported.length}件の地点を読み込みました。` : `Imported ${imported.length} places.`)
                          );
                        } catch (err: any) {
                          toast.error(uiLang === "ja" ? `読み込みエラー: ${err.message}` : `Import error: ${err.message}`);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="btn"
                    onClick={() => {
                      const geojson = poisToGeoJson(builderPois, builderCategories);
                      const str = geoJsonToString(geojson);
                      const blob = new Blob([str], { type: "application/geo+json" });
                      downloadBlob(blob, "pois.geojson");
                    }}
                    disabled={!builderPois.length}
                  >
                    {t(uiLang, "export_geojson")}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Assets */}
            <div className="card">
              <div className="sectionTitle">{t(uiLang, "assets_title")}</div>

              {cfg.mode === "indoor" ? (
                <div className="card mt8">
                  <div className="sectionTitleSm">{t(uiLang, "floor_manage_title")}</div>

                  {/* Mode toggle: single floor vs multi-floor */}
                  <div className="row mb10" style={{ gap: 6, padding: 4, background: "var(--card2)", borderRadius: 10, border: "1px solid var(--line)", display: "inline-flex" }}>
                    <button
                      type="button"
                      className={"btn btnMd " + ((cfg.indoor.floors ?? []).length === 0 ? "primary" : "soft")}
                      onClick={() => {
                        if ((cfg.indoor.floors ?? []).length > 0) {
                          if (!window.confirm(uiLang === "ja"
                            ? "1フロアモードに切替えますか？追加したフロアは削除されます。"
                            : "Switch to single-floor mode? Added floors will be removed.")) return;
                          for (const k of Object.keys(builderAssets.floorFiles || {})) {
                            removeBuilderAsset("floorMulti", k);
                          }
                          const cleared = builderPois.map(p => p.floor ? { ...p, floor: "" } : p);
                          setBuilderData(cleared, builderCategories);
                          setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors: [] } });
                        }
                      }}
                    >
                      {uiLang === "ja" ? "🏢 1フロアのみ" : "🏢 Single floor"}
                    </button>
                    <button
                      type="button"
                      className={"btn btnMd " + ((cfg.indoor.floors ?? []).length > 0 ? "primary" : "soft")}
                      onClick={() => {
                        if ((cfg.indoor.floors ?? []).length === 0) {
                          const floors = [
                            { id: "1F", label: "1F", labelI18n: {}, imageUrl: cfg.indoor.imageUrl || "", imageWidthPx: cfg.indoor.imageWidthPx || 2000, imageHeightPx: cfg.indoor.imageHeightPx || 1200 },
                            { id: "2F", label: "2F", labelI18n: {}, imageUrl: "", imageWidthPx: cfg.indoor.imageWidthPx || 2000, imageHeightPx: cfg.indoor.imageHeightPx || 1200 },
                          ];
                          if (builderAssets.floorFile) {
                            setBuilderAsset("floorMulti", "1F", builderAssets.floorFile);
                          }
                          const withFloor = builderPois.map(p => ({ ...p, floor: "1F" }));
                          setBuilderData(withFloor, builderCategories);
                          setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                        }
                      }}
                    >
                      {uiLang === "ja" ? "🏬 複数フロア" : "🏬 Multi-floor"}
                    </button>
                  </div>

                  {/* Single-floor mode */}
                  {(cfg.indoor.floors ?? []).length === 0 ? (
                    <div style={{ padding: "10px 12px", background: "var(--card2)", borderRadius: 12, border: "1px solid var(--line)" }}>
                      <div className="hint mb8">
                        {uiLang === "ja" ? "1枚のフロア画像を使います。フロア切替UIは表示されません。" : "Use a single floor image. No floor switcher will be shown."}
                      </div>
                      {(floorPreviewUrl || cfg.indoor.imageUrl) ? (
                        <img
                          src={floorPreviewUrl || publicUrl(cfg.indoor.imageUrl)}
                          alt="floor preview"
                          style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, border: "1px solid var(--line)", marginBottom: 8 }}
                        />
                      ) : null}
                      <DropZone
                        title={t(uiLang, "assets_floor_drop")}
                        accept="image/*"
                        onFiles={async (files) => {
                          const f = files[0];
                          if (!f) return;
                          const out = await safeCompressImage(f, 2200, uiLang);
                          if (!out) return;
                          setBuilderAsset("floor", "floor", out);
                          let objUrl: string | null = null;
                          try {
                            objUrl = URL.createObjectURL(out);
                            const img = new Image();
                            const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
                              img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
                              img.onerror = () => reject(new Error("failed to read image size"));
                              img.src = objUrl!;
                            });
                            setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, imageWidthPx: size.w, imageHeightPx: size.h } });
                          } catch {} finally { if (objUrl) URL.revokeObjectURL(objUrl); }
                        }}
                      />
                      {builderAssets.floorFile ? (
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                          <div className="hint">{builderAssets.floorFile.name} ({cfg.indoor.imageWidthPx}×{cfg.indoor.imageHeightPx}px)</div>
                          <button className="btn danger" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => removeBuilderAsset("floor")}>{t(uiLang, "remove_floor")}</button>
                        </div>
                      ) : <div className="hint" style={{ marginTop: 6 }}>{t(uiLang, "assets_floor_hint")}</div>}
                    </div>
                  ) : (
                    <>
                      <div className="hint mb10">
                        {uiLang === "ja"
                          ? "複数フロアを管理します。各フロアごとに画像をアップロードしてください。"
                          : "Manage multiple floors. Upload a separate image for each floor."}
                      </div>

                      {(cfg.indoor.floors ?? []).map((floor, fi) => {
                        const floorFileForThis = builderAssets.floorFiles?.[floor.id];
                        const previewUrl = floorPreviewUrls[floor.id] || "";
                        return (
                          <div key={floor.id} style={{
                            padding: "10px 12px", background: "var(--card2)", borderRadius: 12,
                            border: "1px solid var(--line)", marginBottom: 8,
                          }}>
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>
                                {floor.label || floor.id}
                              </div>
                              <div className="row" style={{ gap: 4 }}>
                                {fi > 0 ? (
                                  <button className="btn soft btnSm" onClick={() => {
                                    const floors = [...(cfg.indoor.floors ?? [])];
                                    [floors[fi - 1], floors[fi]] = [floors[fi], floors[fi - 1]];
                                    setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                  }}>{t(uiLang, "floor_move_up")}</button>
                                ) : null}
                                {fi < (cfg.indoor.floors ?? []).length - 1 ? (
                                  <button className="btn soft btnSm" onClick={() => {
                                    const floors = [...(cfg.indoor.floors ?? [])];
                                    [floors[fi], floors[fi + 1]] = [floors[fi + 1], floors[fi]];
                                    setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                  }}>{t(uiLang, "floor_move_down")}</button>
                                ) : null}
                                {(cfg.indoor.floors ?? []).length > 1 ? (
                                  <button className="btn danger btnSm" onClick={() => {
                                    const floors = (cfg.indoor.floors ?? []).filter((_, i) => i !== fi);
                                    setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                    removeBuilderAsset("floorMulti", floor.id);
                                  }}>{t(uiLang, "remove_floor")}</button>
                                ) : null}
                              </div>
                            </div>
                            <div className="grid2" style={{ gap: 8 }}>
                              <label className="fs12">
                                {t(uiLang, "floor_id")}
                                <input value={floor.id} onChange={(e) => {
                                  const newId = e.target.value.trim();
                                  if (!newId) return;
                                  const floors = [...(cfg.indoor.floors ?? [])];
                                  const oldId = floors[fi].id;
                                  if (newId === oldId) return;
                                  // Fix #9: Reject duplicate floor IDs to prevent data loss
                                  if (floors.some((f, i) => i !== fi && f.id === newId)) {
                                    toast.info(uiLang === "ja"
                                      ? `フロアID「${newId}」は既に使われています。`
                                      : `Floor ID "${newId}" is already used.`);
                                    return;
                                  }
                                  floors[fi] = { ...floors[fi], id: newId };
                                  setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                  // Migrate file reference (zustand setters run synchronously in sequence here)
                                  const existingFile = builderAssets.floorFiles?.[oldId];
                                  if (existingFile) {
                                    removeBuilderAsset("floorMulti", oldId);
                                    setBuilderAsset("floorMulti", newId, existingFile);
                                  }
                                  // Update POIs that reference oldId
                                  const updated = builderPois.map(p => p.floor === oldId ? { ...p, floor: newId } : p);
                                  if (updated.some((p, i) => p !== builderPois[i])) {
                                    setBuilderData(updated, builderCategories);
                                  }
                                }} className="fs13" />
                              </label>
                              <label className="fs12">
                                {t(uiLang, "floor_label_field")}
                                <input value={floor.label ?? ""} onChange={(e) => {
                                  const floors = [...(cfg.indoor.floors ?? [])];
                                  floors[fi] = { ...floors[fi], label: e.target.value };
                                  setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                }} placeholder={uiLang === "ja" ? "例: 1F, 2F, B1" : "e.g. 1F, 2F, B1"} className="fs13" />
                              </label>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              {previewUrl ? (
                                <img src={previewUrl} alt={floor.label || floor.id} style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 6 }} />
                              ) : floor.imageUrl ? (
                                <img src={publicUrl(floor.imageUrl)} alt={floor.label || floor.id} style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 6 }} />
                              ) : null}
                              <label className="btn soft" style={{ cursor: "pointer", fontSize: 12 }}>
                                {floorFileForThis ? t(uiLang, "floor_image_set") : t(uiLang, "floor_image_upload")}
                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (ev) => {
                                  const f = ev.target.files?.[0];
                                  if (!f) return;
                                  const out = await safeCompressImage(f, 2200, uiLang);
                                  if (!out) return;
                                  setBuilderAsset("floorMulti", floor.id, out);
                                  let objUrl: string | null = null;
                                  try {
                                    objUrl = URL.createObjectURL(out);
                                    const img = new Image();
                                    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
                                      img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
                                      img.onerror = () => reject(new Error("failed"));
                                      img.src = objUrl!;
                                    });
                                    const floors = [...(cfg.indoor.floors ?? [])];
                                    floors[fi] = { ...floors[fi], imageWidthPx: size.w, imageHeightPx: size.h };
                                    setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                                  } catch {} finally { if (objUrl) URL.revokeObjectURL(objUrl); }
                                  ev.target.value = "";
                                }} />
                              </label>
                              {floorFileForThis ? (
                                <span className="hint ml8">{floorFileForThis.name}</span>
                              ) : !floor.imageUrl ? (
                                <span className="hint ml8">{t(uiLang, "floor_image_none")}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}

                      <button className="btn" style={{ marginTop: 4 }} onClick={() => {
                        const floors = [...(cfg.indoor.floors ?? [])];
                        const existingIds = new Set(floors.map(f => f.id));
                        let nextNum = floors.length + 1;
                        while (existingIds.has(`${nextNum}F`)) nextNum++;
                        const id = `${nextNum}F`;
                        floors.push({
                          id,
                          label: id,
                          labelI18n: {},
                          imageUrl: "",
                          imageWidthPx: cfg.indoor.imageWidthPx || 2000,
                          imageHeightPx: cfg.indoor.imageHeightPx || 1200,
                        });
                        setBuilderConfig({ ...cfg, indoor: { ...cfg.indoor, floors } });
                      }}>{t(uiLang, "add_floor")}</button>
                    </>
                  )}
                </div>
              ) : null}

              <div className="card mt10">
                <div className="sectionTitle">{t(uiLang, "assets_images_title")}</div>
                <DropZone
                  title={t(uiLang, "assets_images_drop")}
                  accept="image/*"
                  multiple
                  onFiles={async (files) => {
                    for (const f of files) {
                      const out = await safeCompressImage(f, 1800, uiLang);
                      if (!out) return;
                      const key = guessImagePath(out.name);
                      setBuilderAsset("image", key, out);
                    }
                  }}
                />
                <div className="hint mt8">{t(uiLang, "assets_images_hint")}</div>

                {Object.keys(builderAssets.images ?? {}).length ? (
                  <div className="mt10">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      {uiLang === "ja" ? "アップロード済みの画像" : "Uploaded images"}
                    </div>
                    <div className="thumbGrid">
                      {Object.entries(builderAssets.images ?? {}).map(([key, file]) => (
                        <div key={key} className="thumbItem">
                          {imagePreviewUrls[key] ? (
                            <img src={imagePreviewUrls[key]} alt={key} />
                          ) : (
                            <div className="thumbFallback">IMG</div>
                          )}
                          <div className="thumbMeta">
                            <div className="thumbName">{file.name}</div>
                            <div className="hint m0">{key}</div>
                          </div>
                          <button className="btn danger" onClick={() => removeBuilderAsset("image", key)}>
                            {uiLang === "ja" ? "削除" : "Remove"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="row" style={{ marginTop: 10, justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setStep(1)}>{t(uiLang, "back")}（{t(uiLang, importFlow ? "step_template_2" : "step_template")}）</button>
                <button className="btn primary" onClick={() => { previewBuilder(); setStep(3); }} disabled={hasError}>{t(uiLang, "next_preview")}</button>
              </div>
            </div>

          </div>
        ) : null}

        {/* STEP 3 */}
        {step === 3 ? (
          <div className="cards">
            <div className="card">
              <div className="sectionTitle">{t(uiLang, "preview_title")}</div>
              <div className="hint">{t(uiLang, "preview_hint")}</div>

              {/* Tabs (map / issues). Placed above the Leaflet map so it never gets hidden. */}
              <div
                className="row"
                style={{
                  gap: 8,
                  marginTop: 10,
                  position: "relative",
                  zIndex: 1200,
                  background: "var(--card)",
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                <button
                  className={"btn " + (previewTab === "map" ? "primary" : "")}
                  onClick={() => setPreviewTab("map")}
                >
                  {uiLang === "ja" ? "地図" : "Map"}
                </button>
                <button
                  className={"btn " + (previewTab === "issues" ? "primary" : "")}
                  onClick={() => setPreviewTab("issues")}
                >
                  {t(uiLang, "detect_errors_title")}{issues.length ? ` (${issues.length})` : ""}
                </button>
              </div>

              {previewTab === "map" ? (
                <>
                  <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <label className="row" style={{ gap: 8 }}>
                      {uiLang === "ja" ? "移動する地点" : "Move place"}
                      <select value={selectedPoiId} onChange={(e) => setSelectedPoiId(e.target.value)}>
                        {builderPois.map(p => (
                          <option key={p.id} value={p.id}>{pickPoiName(p, effectiveContentLang)}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={"btn " + (pickPos ? "primary" : "")}
                      onClick={() => setPickPos(v => {
                        const next = !v;
                        if (next) setAddOnMapClick(false);
                        return next;
                      })}
                    >
                      {t(uiLang, "set_position")} {pickPos ? "ON" : "OFF"}
                    </button>
                    <button
                      className={"btn " + (addOnMapClick ? "primary" : "")}
                      onClick={() => setAddOnMapClick(v => {
                        const next = !v;
                        if (next) setPickPos(false);
                        return next;
                      })}
                    >
                      {t(uiLang, "add_on_map_click")} {addOnMapClick ? "ON" : "OFF"}
                    </button>
                    <div className="hint">
                      {addOnMapClick
                        ? t(uiLang, "add_on_map_click_hint")
                        : (uiLang === "ja"
                            ? (cfg.mode === "indoor"
                                ? "ON の間はクリックして屋内の位置（x/y）を調整します（詳細は開きません）"
                                : "ON の間はクリックして屋外の位置（緯度・経度）を設定します（詳細は開きません）")
                            : (cfg.mode === "indoor"
                                ? "When ON, click to adjust indoor position (x/y). (Details won't open.)"
                                : "When ON, click to set outdoor position (lat/lng). (Details won't open.)"))}
                    </div>
                  </div>

                  <div className="mapWrap" style={{ height: 520, marginTop: 10, position: "relative" }}>
                    {cfg.mode === "indoor" && (cfg.indoor.floors ?? []).length >= 2 ? (
                      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 500 }}>
                        <FloorSelector
                          config={cfg}
                          activeFloor={builderActiveFloor || (cfg.indoor.floors?.[0]?.id ?? "")}
                          onChange={setBuilderActiveFloor}
                          contentLang={effectiveContentLang}
                          uiLang={uiLang}
                        />
                      </div>
                    ) : null}
                    <MapView
                      config={cfg}
                      pois={builderPois}
                      categories={builderCategories}
                      contentLang={effectiveContentLang}
                      uiLang={uiLang}
                      activeFloor={builderActiveFloor || undefined}
                      onPickPoi={(pickPos || addOnMapClick) ? undefined : (p) => setPicked(p)}
                      onMapClick={onPreviewMapClick}
                      indoorImageOverrideUrl={(() => {
                        // Multi-floor: resolve image URL for active floor
                        const floors = cfg.indoor.floors ?? [];
                        if (floors.length >= 2 && builderActiveFloor) {
                          // Use cached blob URL (managed by useEffect cleanup)
                          const cached = floorPreviewUrls[builderActiveFloor];
                          if (cached) return cached;
                          const floorDef = floors.find(f => f.id === builderActiveFloor);
                          if (floorDef?.imageUrl) return undefined; // let MapView resolve it
                        }
                        return floorPreviewUrl || undefined;
                      })()}
                    />
                  </div>
                </>
              ) : null}

              {previewTab === "issues" ? (
                <div className={(hasError ? "danger" : "ok") + " mt10"}>
                  <div className="sectionTitle">{t(uiLang, "detect_errors_title")}</div>
                  {issues.length ? (
                    <ul className="hint m0">
                      {issues.slice(0, 40).map((i, idx) => (
                        <li key={idx}>{i.level.toUpperCase()}: {i.poiId ? `[${i.poiId}] ` : ""}{i.message[uiLang]}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="hint">{t(uiLang, "validation_ok")}</div>
                  )}
                </div>
              ) : null}

              <div className="row" style={{ gap: 10, marginTop: 12, width: "100%", justifyContent: "space-between" }}>
                <button className="btn" onClick={() => setStep(2)}>{t(uiLang, "back")}</button>
                <div className="row" style={{ gap: 10 }}>
                <button className={csvApplyBtnClass} onClick={onApplyToCsv}>
                  {t(uiLang, "apply_to_csv")}
                </button>
                <button className="btn primary" onClick={() => setStep(4)} disabled={!canNext4}>{t(uiLang, "next_publish")}</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* STEP 4 */}
        {step === 4 ? (
          <div className="cards">
            <div className="card">
              <div className="sectionTitle">{t(uiLang, "publish_title")}</div>
              <div className="hint">{t(uiLang, "publish_hint")}</div>

              <div style={{ marginTop: 14 }}>
                <div className="sectionTitle">{t(uiLang, "publish_color_templates")}</div>
                <div className="row gap8w">
                  {([
                    { key: "blue", label: t(uiLang, "theme_blue"), color: "#9eb4d4" },
                    { key: "green", label: t(uiLang, "theme_green"), color: "#a3c4a1" },
                    { key: "orange", label: t(uiLang, "theme_orange"), color: "#d4b87a" },
                    { key: "purple", label: t(uiLang, "theme_purple"), color: "#b8a3c8" },
                    { key: "red", label: t(uiLang, "theme_red"), color: "#c97862" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      className={"btn " + (publishTheme === p.key ? "primary" : "")}
                      type="button"
                      onClick={() => setPublishTheme(p.key as ThemePreset)}
                    >
                      <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, background: p.color, marginRight: 8 }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "flex-start" }}>
                <button
                  className="btn primary"
                  disabled={!!exportLoading}
                  onClick={async () => {
                    setExportLoading(t(uiLang, "generating_zip"));
                    try {
                      const blob = await exportSiteZip({
                        config: cfg,
                        pois: builderPois,
                        categories: builderCategories,
                        floorFile: builderAssets.floorFile,
                        floorFiles: builderAssets.floorFiles,
                        images: builderAssets.images,
                        themePreset: publishTheme,
                      });
                      downloadBlob(blob, "site.zip");
                    } finally {
                      setExportLoading("");
                    }
                  }}
                >
                  {t(uiLang, "download_site_zip")}
                </button>

                <button className="btn" onClick={() => setQrOpen(true)}>{t(uiLang, "qr_title")}</button>
                <button className="btn" onClick={() => setStep(3)}>{t(uiLang, "back")}</button>
              </div>

              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                <button
                  className="btn"
                  disabled={!!exportLoading}
                  onClick={async () => {
                    setExportLoading(t(uiLang, "generating_zip"));
                    try {
                      const blob = await exportContentZip({
                        config: cfg,
                        pois: builderPois,
                        categories: builderCategories,
                        floorFile: builderAssets.floorFile,
                        floorFiles: builderAssets.floorFiles,
                        images: builderAssets.images,
                      });
                      downloadBlob(blob, "content-pack.zip");
                    } finally {
                      setExportLoading("");
                    }
                  }}
                >
                  {t(uiLang, "download_content_pack")}
                </button>
              </div>

              {exportLoading ? (
                <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
                  <div className="msf-spinner" style={{ width: 20, height: 20 }} />
                  <span className="hint">{exportLoading}</span>
                </div>
              ) : null}

              {/* Embed code helper */}
              <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--card2)", borderRadius: 12, border: "1px solid var(--line)" }}>
                <div className="sectionTitleSm">{t(uiLang, "embed_title")}</div>
                <div className="hint mb8">{t(uiLang, "embed_hint")}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{
                    flex: 1, fontSize: 11, padding: "6px 10px",
                    background: "var(--input-bg)", borderRadius: 8,
                    border: "1px solid var(--line)", color: "var(--muted)",
                    overflow: "auto", whiteSpace: "nowrap",
                  }}>
                    {`<iframe src="YOUR_URL/#/" width="100%" height="600" frameborder="0" allow="geolocation"></iframe>`}
                  </code>
                  <button
                    className="btn soft"
                    onClick={() => {
                      const code = `<iframe src="YOUR_URL/#/" width="100%" height="600" frameborder="0" allow="geolocation"></iframe>`;
                      navigator.clipboard?.writeText(code).then(() => {
                        toast.success(t(uiLang, "copied"));
                      }).catch(() => {});
                    }}
                  >
                    {t(uiLang, "copy_embed_code")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </section>

      {picked ? (
        <DetailsModal
          poi={picked}
          category={builderCategories.find(c => c.category === picked.category)}
          contentLang={effectiveContentLang}
          uiLang={uiLang}
          mode={cfg.mode}
          now={Date.now()}
          onClose={() => setPicked(null)}
        />
      ) : null}

      {qrOpen ? (
        <QrModal
          onClose={() => setQrOpen(false)}
          uiLang={uiLang}
          url={location.href.replace(/#\/builder.*/, "#/" )}
        />
      ) : null}
    </main>
  );
}

// Color button that shows selected color
function ColorButton(props: { value: string; onChange: (v: string) => void }) {
  const { value, onChange } = props;
  const isCustom = /^#[0-9a-fA-F]{6}$/.test(value);
  const safe = isCustom ? value : "#d4b87a";
  return (
    <label
      className="colorBtn"
      style={{
        background: safe,
        border: isCustom ? "2px solid var(--text)" : "2px dashed var(--muted)",
      }}
      title={isCustom ? safe : "default"}
    >
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        aria-label="marker color"
      />
    </label>
  );
}