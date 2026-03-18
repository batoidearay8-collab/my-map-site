import { type AppConfig, type Poi, type Category } from "./schema";

export type I18nText = { ja: string; en: string };
export type ValidationIssue = { level: "error" | "warn"; message: I18nText; poiId?: string };

function msg(ja: string, en: string): I18nText {
  return { ja, en };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNormalized01(v: number): boolean {
  return v >= 0 && v <= 1;
}

function isPixelWithin(v: number, max: number): boolean {
  return v >= 0 && v <= max;
}

export function validateAll(cfg: AppConfig, pois: Poi[], categories: Category[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catSet = new Set(categories.map(c => c.category));

  const w = cfg.indoor.imageWidthPx;
  const h = cfg.indoor.imageHeightPx;

  if (!pois.length) {
    issues.push({
      level: "error",
      message: msg(
        "POIが0件です（CSVを投入してください）",
        "No POIs found. Please import POI CSV."
      )
    });
  }

  for (const p of pois) {
    if (!p.name.trim()) {
      issues.push({ level: "error", message: msg("nameが空です", "POI name is empty."), poiId: p.id });
    }

    if (cfg.mode === "outdoor") {
      if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lng)) {
        issues.push({
          level: "error",
          message: msg("屋外モードなのに lat/lng がありません", "Outdoor mode requires lat/lng."),
          poiId: p.id
        });
      }
    } else {
      if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) {
        issues.push({
          level: "error",
          message: msg(
            "屋内モードなのに x/y がありません（0〜1 または px）",
            "Indoor mode requires x/y (0..1 normalized or pixel coordinates)."
          ),
          poiId: p.id
        });
      } else {
        const x = p.x;
        const y = p.y;
        const okNormalized = isNormalized01(x) && isNormalized01(y);
        const okPixels = isPixelWithin(x, w) && isPixelWithin(y, h);
        if (!okNormalized && !okPixels) {
          issues.push({
            level: "warn",
            message: msg(
              "x/y が範囲外です（0〜1 か 画像サイズpx以内）",
              "x/y out of range (expected 0..1 or within image pixel bounds)."
            ),
            poiId: p.id
          });
        }
      }
    }

    if (p.category && !catSet.has(p.category)) {
      issues.push({
        level: "warn",
        message: msg(
          `カテゴリ「${p.category}」が categories にありません`,
          `Category "${p.category}" is not defined in categories.`
        ),
        poiId: p.id
      });
    }

    if (p.image) {
      const img = p.image.trim();
      const ok = img.startsWith("/images/") || img.startsWith("images/") || img.startsWith("./images/");
      if (!ok) {
        issues.push({
          level: "warn",
          message: msg(
            "image は images/...（または /images/...）を推奨（公開時に画像を同梱します）",
            "For `image`, we recommend images/... (or /images/...) so it can be bundled on export."
          ),
          poiId: p.id
        });
      }
    }

    if (p.url && !/^https?:\/\//.test(p.url)) {
      issues.push({
        level: "warn",
        message: msg("url は http(s) で始まるのを推奨", "For `url`, we recommend starting with http(s)."),
        poiId: p.id
      });
    }
  }

  if (cfg.mode === "outdoor" && cfg.privacy.hideExactOutdoorLocationByDefault) {
    issues.push({
      level: "warn",
      message: msg(
        "プライバシー: 屋外の正確な地点を隠す設定です（公開用途に応じて切替）",
        "Privacy: 'hide exact outdoor location by default' is enabled."
      )
    });
  }

  return issues;
}
