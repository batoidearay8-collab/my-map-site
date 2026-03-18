import { type AppConfig, type Poi } from "./schema";

export function roundLatLng(pois: Poi[], decimals: number): Poi[] {
  const f = Math.pow(10, decimals);
  return pois.map(p => {
    if (typeof p.lat === "number" && typeof p.lng === "number") {
      return { ...p, lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
    }
    return p;
  });
}

export function applyPrivacyForExport(cfg: AppConfig, pois: Poi[]): Poi[] {
  // ここは「公開用エクスポート」にだけ適用する想定
  let out = structuredClone(pois);
  out = roundLatLng(out, cfg.privacy.roundOutdoorLatLngDecimals);

  if (cfg.mode === "outdoor" && cfg.privacy.hideExactOutdoorLocationByDefault) {
    // “完全に隠す” ではなく、公開時は viewer 側で「表示」ボタンにするため、
    // data自体は残す（運用に応じてここを変更可）
    return out;
  }
  return out;
}
