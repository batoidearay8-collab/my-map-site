import { create } from "zustand";
import { z } from "zod";
import { ConfigSchema, PoiSchema, CategorySchema, type AppConfig, type Poi, type Category } from "../lib/schema";
import { detectUiLang, normalizeUiLang, type UiLang } from "../lib/i18n";
import { publicUrl } from "../lib/publicUrl";

type BuilderAssets = {
  floorFile?: File;
  images: Record<string, File>; // key: relative path (/images/xxx.png)
};

type BuilderUndoSnapshot = {
  builderConfig: AppConfig | null;
  builderPois: Poi[];
  builderCategories: Category[];
  builderAssets: BuilderAssets;
};

function cloneBuilderAssets(assets: BuilderAssets): BuilderAssets {
  return {
    floorFile: assets.floorFile,
    images: { ...(assets.images || {}) },
  };
}


export type UiTheme = "dark" | "light" | "system";

type AppState = {
  // viewer data
  config: AppConfig | null;
  pois: Poi[];
  categories: Category[];
  isLoaded: boolean;

  // builder working copy
  builderConfig: AppConfig | null;
  builderPois: Poi[];
  builderCategories: Category[];
  builderAssets: BuilderAssets;

  // increments when the builder should reset its local UI state
  builderEpoch: number;

  // One-step undo for builder edits
  builderUndo: BuilderUndoSnapshot | null;

  // UI / language
  uiLang: UiLang;          // UI label language (ja/en)
  contentLang: string;     // content language code (e.g. ja/en/zh-Hans)
  uiTheme: UiTheme;

  // actions
  loadFromPublic: () => Promise<void>;
  setBuilderTemplate: (template: AppConfig["template"]) => void;
  setBuilderMode: (mode: AppConfig["mode"]) => void;
  setBuilderConfig: (cfg: AppConfig) => void;
  setBuilderData: (pois: Poi[], categories: Category[]) => void;
  updateBuilderPoi: (poi: Poi) => void;

  setBuilderAsset: (kind: "floor" | "image", key: string, file: File) => void;
  removeBuilderAsset: (kind: "floor" | "image", key?: string) => void;

  // UI actions
  setUiLang: (lang: UiLang) => void;
  setContentLang: (lang: string) => void;
  setUiTheme: (theme: UiTheme) => void;

  // promote builder -> viewer preview
  previewBuilder: () => void;

  // start a new map (clear current work)
  startNewMap: () => void;
  undoBuilder: () => void;
};

function makeUndoSnapshot(s: AppState): BuilderUndoSnapshot {
  return {
    builderConfig: s.builderConfig ? structuredClone(s.builderConfig) : null,
    builderPois: structuredClone(s.builderPois),
    builderCategories: structuredClone(s.builderCategories),
    builderAssets: cloneBuilderAssets(s.builderAssets),
  };
}


async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load: ${url}`);
  return await res.json();
}

function initUiLang(): UiLang {
  try {
    const v = localStorage.getItem("msf.uiLang");
    if (v) return normalizeUiLang(v);
  } catch {}
  return detectUiLang();
}

function initContentLang(): string {
  try {
    const v = localStorage.getItem("msf.contentLang");
    if (v) return v;
  } catch {}
  // not set yet
  return "";
}

function initTheme(): UiTheme {
  try {
    const v = localStorage.getItem("msf.theme") as UiTheme | null;
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {}
  return "system";
}

function makeNewMapConfig(): AppConfig {
  // Reasonable defaults (Tokyo) — user can change in Step 1.
  return ConfigSchema.parse({
    title: "Map Site",
    subtitle: "",
    template: "event",
    mode: "outdoor",
    privacy: {
      stripImageMetadata: true,
      roundOutdoorLatLngDecimals: 5,
      hideExactOutdoorLocationByDefault: false,
    },
    outdoor: { center: [35.681236, 139.767125], zoom: 15 },
    indoor: {
      imageUrl: "/assets/floor.png",
      imageWidthPx: 2000,
      imageHeightPx: 1200,
      minZoom: -2,
      maxZoom: 2,
    },
    i18n: { defaultLang: "ja", supportedLangs: ["ja", "en"] },
    ui: { tabTitle: "AtlasKobo — 地図サイト制作キット" },
    titleI18n: { ja: "新しいマップ", en: "New map" },
    subtitleI18n: { ja: "", en: "" },
    theme: "dark",
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  pois: [],
  categories: [],
  isLoaded: false,

  builderConfig: null,
  builderPois: [],
  builderCategories: [],
  builderAssets: { images: {} },

  builderEpoch: 0,

  builderUndo: null,

  uiLang: initUiLang(),
  contentLang: initContentLang(),
  uiTheme: initTheme(),

  loadFromPublic: async () => {
    const [cfg, pois, cats] = await Promise.all([
      fetchJson(publicUrl("/data/config.json")),
      fetchJson(publicUrl("/data/pois.json")),
      fetchJson(publicUrl("/data/categories.json"))
    ]);

    const parsedCfg = ConfigSchema.parse(cfg);
    const parsedPois = z.array(PoiSchema).parse(pois);
    const parsedCats = z.array(CategorySchema).parse(cats);

    set({
      config: parsedCfg,
      pois: parsedPois,
      categories: parsedCats,
      isLoaded: true,

      contentLang: (get().contentLang || parsedCfg.i18n.defaultLang),

      builderConfig: structuredClone(parsedCfg),
      builderPois: structuredClone(parsedPois),
      builderCategories: structuredClone(parsedCats),
      builderAssets: { images: {} }
    });

    // If language/theme is not explicitly chosen by user, prefer config defaults
    try {
      const hasContent = localStorage.getItem("msf.contentLang");
      if (!hasContent && parsedCfg.i18n?.defaultLang) set({ contentLang: parsedCfg.i18n.defaultLang });

      const hasTheme = localStorage.getItem("msf.theme");
      if (!hasTheme && parsedCfg.theme) set({ uiTheme: parsedCfg.theme });
    } catch {}
  },

  setBuilderTemplate: (template) => {
    const cur = get().builderConfig ?? get().config;
    if (!cur) return;
    const next: AppConfig = { ...cur, template };
    // テンプレに応じた初期値（最低限）
    if (template === "tourism") {
      next.mode = "outdoor";
      next.privacy.hideExactOutdoorLocationByDefault = false;
    } else if (template === "event") {
      next.mode = "indoor";
      next.privacy.hideExactOutdoorLocationByDefault = true;
    } else {
      next.mode = "outdoor";
      next.privacy.hideExactOutdoorLocationByDefault = true;
    }
    set({ builderUndo: makeUndoSnapshot(get()), builderConfig: next });
  },

  setBuilderMode: (mode) => {
    const cur = get().builderConfig ?? get().config;
    if (!cur) return;
    set({ builderUndo: makeUndoSnapshot(get()), builderConfig: { ...cur, mode } });
  },

  setBuilderConfig: (cfg) => {
    set({ builderUndo: makeUndoSnapshot(get()), builderConfig: cfg });
  },

  setBuilderData: (pois, categories) => {
    set({ builderUndo: makeUndoSnapshot(get()), builderPois: pois, builderCategories: categories });
  },

  updateBuilderPoi: (poi) => {
    const list = get().builderPois;
    const idx = list.findIndex(p => p.id === poi.id);
    if (idx < 0) return;
    const next = list.slice();
    next[idx] = poi;
    set({ builderUndo: makeUndoSnapshot(get()), builderPois: next });
  },

  setBuilderAsset: (kind, key, file) => {
    const assets = get().builderAssets;
    if (kind === "floor") {
      set({ builderUndo: makeUndoSnapshot(get()), builderAssets: { ...assets, floorFile: file } });
    } else {
      set({ builderUndo: makeUndoSnapshot(get()), builderAssets: { ...assets, images: { ...assets.images, [key]: file } } });
    }
  },

  removeBuilderAsset: (kind, key) => {
    const assets = get().builderAssets;
    if (kind === "floor") {
      set({ builderUndo: makeUndoSnapshot(get()), builderAssets: { ...assets, floorFile: undefined } });
    } else {
      if (!key) return;
      const next = { ...assets.images };
      delete next[key];
      set({ builderAssets: { ...assets, images: next } });
    }
  },

  setUiLang: (lang) => {
    set({ uiLang: lang });
    try { localStorage.setItem("msf.uiLang", lang); } catch {}
  },

  setContentLang: (lang) => {
    set({ contentLang: lang });
    try { localStorage.setItem("msf.contentLang", lang); } catch {}
  },

  setUiTheme: (theme) => {
    set({ uiTheme: theme });
    try { localStorage.setItem("msf.theme", theme); } catch {}
  },

  previewBuilder: () => {
    const cfg = get().builderConfig;
    if (!cfg) return;
    set({
      config: structuredClone(cfg),
      pois: structuredClone(get().builderPois),
      categories: structuredClone(get().builderCategories)
    });
  },

  startNewMap: () => {
    const newCfg = makeNewMapConfig();

    const newCats: Category[] = [{
      category: "general",
      label: "一般",
      labelI18n: { ja: "一般", en: "General" },
      icon: "📍",
      order: 1,
      markerType: "pin",
      markerColor: "#6ea8fe"
    }];

    set({
      builderUndo: makeUndoSnapshot(get()),
      // viewer data becomes the fresh map as well (so "見る" shows the same work)
      config: structuredClone(newCfg),
      pois: [],
      categories: structuredClone(newCats),
      isLoaded: true,

      builderConfig: structuredClone(newCfg),
      builderPois: [],
      builderCategories: structuredClone(newCats),
      builderAssets: { images: {} },

      contentLang: newCfg.i18n.defaultLang || "ja",
      uiLang: (newCfg.i18n.defaultLang || "ja").toLowerCase().startsWith("en") ? "en" : "ja",

      builderEpoch: get().builderEpoch + 1
    });
},

undoBuilder: () => {
  const snap = get().builderUndo;
  if (!snap) return;
  set({
    builderConfig: snap.builderConfig ? structuredClone(snap.builderConfig) : null,
    builderPois: structuredClone(snap.builderPois),
    builderCategories: structuredClone(snap.builderCategories),
    builderAssets: cloneBuilderAssets(snap.builderAssets),
    builderUndo: null
  });
}
}));
