/**
 * Shared utility functions for the Builder.
 */
import type { Poi, Category } from "../../lib/schema";
import type { UiLang } from "../../lib/i18n";

/* ── Sequential ID generator ── */

export function nextSequentialPoiId(pois: { id: string }[]): string {
  let max = 0;
  for (const p of pois) {
    const s = String(p.id ?? "");
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (n > max) max = n;
    }
  }
  return String(max + 1);
}

/* ── Coordinate helpers ── */

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}

/* ── CSV helpers ── */

export function csvEscape(v: string): string {
  const s = String(v ?? "");
  if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function poisToCsv(pois: Poi[], cfgSupportedLangs: string[], defaultLang: string): string {
  const extra = cfgSupportedLangs.filter(l => l !== defaultLang);
  const headers = [
    "id", "name", "description",
    ...extra.map(l => `name_${l}`),
    ...extra.map(l => `description_${l}`),
    "category", "image", "lat", "lng", "x", "y", "url", "hours", "closed", "floor"
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
    cols.push((p as any).hours ?? "");
    cols.push((p as any).closed ?? "");
    cols.push(p.floor ?? "");
    return cols.map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function categoriesToCsv(cats: Category[], cfgSupportedLangs: string[], defaultLang: string): string {
  const extra = cfgSupportedLangs.filter(l => l !== defaultLang);
  const headers = [
    "category", "label",
    ...extra.map(l => `label_${l}`),
    "icon", "order", "markerType", "markerColor"
  ];
  const rows = cats.map(c => {
    const cols: string[] = [];
    cols.push(c.category ?? "");
    cols.push(c.label ?? "");
    for (const l of extra) cols.push((c.labelI18n ?? {})[l] ?? "");
    cols.push(c.icon ?? "");
    cols.push(c.order !== undefined ? String(c.order) : "");
    cols.push((c.markerType ?? "") as any);
    cols.push(c.markerColor ?? "");
    return cols.map(csvEscape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function ensureDefaultCategory(uiLang: UiLang, cats: Category[]): Category[] {
  if (cats.length) return cats;
  return [{
    category: "general",
    label: uiLang === "ja" ? "一般" : "General",
    labelI18n: { ja: "一般", en: "General" },
    icon: "📍",
    order: 1,
    markerType: "pin",
    markerColor: "#6ea8fe"
  }];
}

/* ── Hash for change tracking ── */

export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

/* ── Marker type list ── */

export const MARKER_TYPES: Category["markerType"][] = [
  "pin", "dot", "badge", "ring", "square", "hex", "flag"
];

/* ── Template previews ── */

export const TEMPLATE_PREVIEWS: Record<string, { ja: string; en: string; needs: string[]; icon: string }> = {
  tourism:          { ja: "観光マップ",   en: "Tourism",       needs: ["お土産", "駅", "飯屋"],             icon: "🏯" },
  live:             { ja: "ライブ",       en: "Live event",    needs: ["ホテル", "駅", "飯屋"],             icon: "🎤" },
  convenience:      { ja: "便利マップ",   en: "Convenience",   needs: [],                                   icon: "🗺️" },
  festival:         { ja: "祭り",         en: "Festival",      needs: ["駐車場", "トイレ", "救護"],         icon: "🎆" },
  school_festival:  { ja: "文化祭",       en: "School fest",   needs: ["スケジュール", "展示", "食べ物"],   icon: "🏫" },
  disaster:         { ja: "防災",         en: "Disaster",      needs: ["AED", "避難所", "給水所"],          icon: "🚨" },
  outdoor_activity: { ja: "アウトドア",   en: "Outdoor",       needs: ["給水所", "コンビニ", "駐車場"],     icon: "🏕️" },
};
