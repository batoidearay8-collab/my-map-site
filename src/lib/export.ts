import JSZip from "jszip";
import { type AppConfig, type Poi, type Category } from "./schema";
import { applyPrivacyForExport } from "./privacy";
import { publicUrl } from "./publicUrl";

// Bundled as raw text at build time (so Builder can export without extra fetches).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import publishAppJs from "./publish/app.js?raw";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import publishCss from "./publish/site.css?raw";

export type ThemePreset = "blue" | "green" | "orange" | "purple" | "red";

export type ExportInput = {
  config: AppConfig;
  pois: Poi[];
  categories: Category[];
  floorFile?: File;
  floorFiles?: Record<string, File>;  // Multi-floor: keyed by floor ID
  images: Record<string, File>; // key: /images/xxx.jpg
};

export type ExportSiteInput = ExportInput & {
  themePreset: ThemePreset;
};

function themeCss(preset: ThemePreset): string {
  const map: Record<ThemePreset, string> = {
    blue: "#4db87a",
    green: "#2fd4a3",
    orange: "#ffb020",
    purple: "#b39ddb",
    red: "#ff6b6b",
  };
  const accent = map[preset] || map.blue;
  return `:root{--accent:${accent};}\n`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function indexHtml(opts: { tabTitle: string; title: string; subtitle?: string }): string {
  const { tabTitle, title, subtitle } = opts;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(tabTitle || "AtlasKobo — 地図サイト制作キット")}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./theme.css" />
  </head>
  <body>
    <header class="topbar">
      <img
        class="logo"
        src="./logo.png"
        alt="logo"
        onerror="if(!this.dataset.triedBrand){this.dataset.triedBrand='1';this.src='./brand/logo.png';}else if(!this.dataset.triedSvg){this.dataset.triedSvg='1';this.src='./brand/logo.svg';}else{this.style.display='none';}"
      />
      <div class="titles">
        <div class="title" id="siteTitle">${escapeHtml(title || "")}</div>
        <div class="subtitle" id="siteSubtitle">${escapeHtml(subtitle || "")}</div>
      </div>
      <button class="iconbtn" id="copyUrl" type="button" aria-label="copy url" title="Copy URL">🔗</button>
      <button class="iconbtn" id="nativeShare" type="button" aria-label="share" title="Share">📤</button>
      <button class="iconbtn" id="openOnlyToggle" type="button" aria-label="open only" title="Open now">🟢</button>
      <button class="iconbtn" id="mapOnlyToggle" type="button" aria-label="map only" title="Map only">🗺️</button>
      <button class="iconbtn" id="themeToggle" type="button" aria-label="toggle theme">🌓</button>
    </header>

    <main class="main">
      <div class="controls">
        <select id="langSelect" aria-label="language"></select>
        <input id="searchInput" type="search" placeholder="Search" />
      </div>
      <div id="chips" class="chips"></div>
      <div id="recoSection" class="recoSection" style="display:none"></div>
      <div id="map" class="map"></div>
      <div id="list" class="list"></div>
    </main>

    <div id="sheet" class="sheet hidden" role="dialog" aria-modal="true">
      <div class="sheetBackdrop" id="sheetBackdrop"></div>
      <div class="sheetCard">
        <div class="sheetHeader">
          <div class="sheetTitle" id="sheetTitle"></div>
          <button class="iconbtn" id="sheetClose" type="button" aria-label="close">✕</button>
        </div>
        <div class="sheetBody" id="sheetBody"></div>
      </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="./app.js"></script>
  </body>
</html>`;
}

async function addPublicFile(zip: JSZip, srcPath: string, destPath?: string) {
  try {
    const res = await fetch(publicUrl(srcPath));
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    zip.file(destPath || srcPath, buf);
  } catch {
    // ignore
  }
}

function cloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

async function tryAddPublicFile(zip: JSZip, srcPath: string, destPath?: string) {
  try {
    const url = publicUrl(srcPath);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    zip.file(destPath || srcPath, await res.arrayBuffer());
  } catch {
    // ignore (optional asset)
  }
}

function normalizeI18nForExport(cfg: AppConfig, categories: Category[], pois: Poi[]) {
  const nextCfg: AppConfig = cloneJson(cfg);
  const defaultLang = nextCfg?.i18n?.defaultLang || "ja";

  // Ensure ui.tabTitle exists
  nextCfg.ui = nextCfg.ui || ({ tabTitle: "AtlasKobo — 地図サイト制作キット" } as any);
  if (!nextCfg.ui.tabTitle) nextCfg.ui.tabTitle = "AtlasKobo — 地図サイト制作キット";

  // If the default language text is stored in *I18n maps* (common after import), promote it to base fields.
  if (nextCfg.titleI18n && nextCfg.titleI18n[defaultLang]) {
    const v = nextCfg.titleI18n[defaultLang];
    if (!String(nextCfg.title || "").trim() && typeof v === "string" && v.trim()) {
      nextCfg.title = v.trim();
    }
    delete nextCfg.titleI18n[defaultLang];
  }
  if (nextCfg.subtitleI18n && nextCfg.subtitleI18n[defaultLang]) {
    const v = nextCfg.subtitleI18n[defaultLang];
    if (!String(nextCfg.subtitle || "").trim() && typeof v === "string" && v.trim()) {
      nextCfg.subtitle = v.trim();
    }
    delete nextCfg.subtitleI18n[defaultLang];
  }

  const nextCats: Category[] = cloneJson(categories).map((c) => {
    const x: any = { ...c };
    if (x.labelI18n && x.labelI18n[defaultLang]) {
      const v = x.labelI18n[defaultLang];
      if (!String(x.label || "").trim() && typeof v === "string" && v.trim()) {
        x.label = v.trim();
      }
      delete x.labelI18n[defaultLang];
    }
    return x;
  });

  const nextPois: Poi[] = cloneJson(pois).map((p) => {
    const x: any = { ...p };
    if (x.nameI18n && x.nameI18n[defaultLang]) {
      const v = x.nameI18n[defaultLang];
      if (!String(x.name || "").trim() && typeof v === "string" && v.trim()) {
        x.name = v.trim();
      }
      delete x.nameI18n[defaultLang];
    }
    if (x.descriptionI18n && x.descriptionI18n[defaultLang]) {
      const v = x.descriptionI18n[defaultLang];
      if (!String(x.description || "").trim() && typeof v === "string" && v.trim()) {
        x.description = v.trim();
      }
      delete x.descriptionI18n[defaultLang];
    }
    return x;
  });

  return { cfg: nextCfg, categories: nextCats, pois: nextPois };
}

export async function exportSiteZip(input: ExportSiteInput): Promise<Blob> {
  const zip = new JSZip();

  const normalized = normalizeI18nForExport(input.config, input.categories, input.pois);
  const cfg = normalized.cfg;
  const cats = normalized.categories;
  const pois = applyPrivacyForExport(cfg, normalized.pois);

  // Assets
  if (input.floorFile) {
    zip.file("assets/" + input.floorFile.name, await input.floorFile.arrayBuffer());
    cfg.indoor.imageUrl = `/assets/${input.floorFile.name}`;
  }
  // Multi-floor images
  if (input.floorFiles && cfg.indoor.floors) {
    for (const floor of cfg.indoor.floors) {
      const file = input.floorFiles[floor.id];
      if (file) {
        const fileName = `floor_${floor.id}_${file.name}`;
        zip.file("assets/" + fileName, await file.arrayBuffer());
        floor.imageUrl = `/assets/${fileName}`;
      }
    }
  }
  for (const [pathKey, file] of Object.entries(input.images)) {
    const rel = pathKey.startsWith("/") ? pathKey.slice(1) : pathKey;
    zip.file(rel, await file.arrayBuffer());
  }

  // Data
  zip.file("data/config.json", JSON.stringify(cfg, null, 2));
  zip.file("data/pois.json", JSON.stringify(pois, null, 2));
  zip.file("data/categories.json", JSON.stringify(cats, null, 2));

  // Site runtime
  const tabTitle = cfg.ui?.tabTitle || "AtlasKobo — 地図サイト制作キット";
  zip.file(
    "index.html",
    indexHtml({ tabTitle, title: cfg.title || "", subtitle: cfg.subtitle || "" })
  );
  zip.file("app.js", publishAppJs);
  zip.file("styles.css", publishCss);
  zip.file("theme.css", themeCss(input.themePreset));

  // Brand assets (optional but recommended): logo & favicon.
  // These live under /public in the Builder app, so we fetch them at runtime.
  await tryAddPublicFile(zip, "brand/logo.png");
  await tryAddPublicFile(zip, "brand/logo.png", "logo.png");
  await tryAddPublicFile(zip, "brand/logo.svg");
  await tryAddPublicFile(zip, "brand/logo.svg", "logo.svg");
  await tryAddPublicFile(zip, "favicon.ico");
  await tryAddPublicFile(zip, "favicon.svg");
  await tryAddPublicFile(zip, "favicon-16x16.png");
  await tryAddPublicFile(zip, "favicon-32x32.png");
  await tryAddPublicFile(zip, "apple-touch-icon.png");
  await tryAddPublicFile(zip, "icons/icon-192.png");
  await tryAddPublicFile(zip, "icons/icon-512.png");

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

export async function exportContentZip(input: ExportInput): Promise<Blob> {
  const zip = new JSZip();

  const normalized = normalizeI18nForExport(input.config, input.categories, input.pois);
  const cfg = normalized.cfg;
  const cats = normalized.categories;
  const pois = applyPrivacyForExport(cfg, normalized.pois);

  if (input.floorFile) {
    zip.file("assets/" + input.floorFile.name, await input.floorFile.arrayBuffer());
    cfg.indoor.imageUrl = `/assets/${input.floorFile.name}`;
  }
  // Multi-floor images
  if (input.floorFiles && cfg.indoor.floors) {
    for (const floor of cfg.indoor.floors) {
      const file = input.floorFiles[floor.id];
      if (file) {
        const fileName = `floor_${floor.id}_${file.name}`;
        zip.file("assets/" + fileName, await file.arrayBuffer());
        floor.imageUrl = `/assets/${fileName}`;
      }
    }
  }

  for (const [pathKey, file] of Object.entries(input.images)) {
    const rel = pathKey.startsWith("/") ? pathKey.slice(1) : pathKey;
    zip.file(rel, await file.arrayBuffer());
  }

  zip.file("data/config.json", JSON.stringify(cfg, null, 2));
  zip.file("data/pois.json", JSON.stringify(pois, null, 2));
  zip.file("data/categories.json", JSON.stringify(cats, null, 2));

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
