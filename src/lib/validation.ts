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

  // Fix #4: Check for duplicate POI IDs
  const idSeen = new Map<string, number>();
  for (const p of pois) {
    const prev = idSeen.get(p.id) ?? 0;
    idSeen.set(p.id, prev + 1);
  }
  for (const [id, count] of idSeen.entries()) {
    if (count > 1) {
      issues.push({
        level: "error",
        message: msg(
          `ID「${id}」が${count}回使われています。IDは一意である必要があります。`,
          `ID "${id}" is used ${count} times. IDs must be unique.`
        ),
        poiId: id
      });
    }
  }

  // Also check for duplicate category keys
  const catSeen = new Map<string, number>();
  for (const c of categories) {
    const prev = catSeen.get(c.category) ?? 0;
    catSeen.set(c.category, prev + 1);
  }
  for (const [key, count] of catSeen.entries()) {
    if (count > 1) {
      issues.push({
        level: "error",
        message: msg(
          `カテゴリキー「${key}」が${count}回使われています。一意である必要があります。`,
          `Category key "${key}" is used ${count} times. Must be unique.`
        )
      });
    }
  }

  // Check connector groups: each group needs at least 2 POIs on different floors
  if (cfg.mode === "indoor" && (cfg.indoor.floors ?? []).length >= 2) {
    const groups = new Map<string, Poi[]>();
    for (const p of pois) {
      if (p.connectorGroup && p.connectorType) {
        const arr = groups.get(p.connectorGroup) ?? [];
        arr.push(p);
        groups.set(p.connectorGroup, arr);
      }
    }
    for (const [groupId, groupPois] of groups.entries()) {
      if (groupPois.length < 2) {
        issues.push({
          level: "warning",
          message: msg(
            `接続グループ「${groupId}」に1つしか地点がありません。フロア間移動には別フロアの同名グループが必要です。`,
            `Connector group "${groupId}" has only one POI. Cross-floor routing needs another POI in this group on a different floor.`
          )
        });
      } else {
        const floors = new Set(groupPois.map(p => p.floor || ""));
        if (floors.size < 2) {
          issues.push({
            level: "warning",
            message: msg(
              `接続グループ「${groupId}」の地点が全て同じフロアにあります。フロア間移動になりません。`,
              `Connector group "${groupId}" has all POIs on the same floor — won't enable cross-floor routing.`
            )
          });
        }
      }
    }
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

    // Multi-floor: check for orphaned floor references
    if (cfg.mode === "indoor" && p.floor && (cfg.indoor.floors ?? []).length >= 2) {
      const floorIds = new Set((cfg.indoor.floors ?? []).map(f => f.id));
      if (!floorIds.has(p.floor)) {
        issues.push({
          level: "warn",
          message: msg(
            `フロア「${p.floor}」はフロア一覧に存在しません`,
            `Floor "${p.floor}" is not defined in the floor list.`
          ),
          poiId: p.id
        });
      }
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
