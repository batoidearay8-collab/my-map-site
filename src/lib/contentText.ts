import type { AppConfig, Poi, Category } from "./schema";

/**
 * Pick translated content text with fallback.
 * `lang` is a content language code (e.g. "ja", "en", "zh-Hans").
 */

export function pickConfigTitle(cfg: AppConfig, lang: string): string {
  return (cfg.titleI18n?.[lang] ?? "").trim() || cfg.title;
}

export function pickConfigSubtitle(cfg: AppConfig, lang: string): string {
  const base = cfg.subtitle ?? "";
  return (cfg.subtitleI18n?.[lang] ?? "").trim() || base;
}

export function pickPoiName(p: Poi, lang: string): string {
  return (p.nameI18n?.[lang] ?? "").trim() || p.name;
}

export function pickPoiDescription(p: Poi, lang: string): string {
  const base = p.description ?? "";
  return (p.descriptionI18n?.[lang] ?? "").trim() || base;
}

export function pickCategoryLabel(c: Category, lang: string): string {
  const base = (c.label ?? "").trim() || c.category;
  return (c.labelI18n?.[lang] ?? "").trim() || base;
}


// Backward-compatible aliases (older code used getConfigTitle/getConfigSubtitle)
export function getConfigTitle(cfg: AppConfig, lang: string): string {
  return pickConfigTitle(cfg, lang);
}

export function getConfigSubtitle(cfg: AppConfig, lang: string): string {
  return pickConfigSubtitle(cfg, lang);
}
