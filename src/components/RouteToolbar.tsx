import { useState, useRef, useEffect, useCallback } from "react";
import type { Poi } from "../lib/schema";
import { geocode, type GeocodeResult } from "../lib/geocode";
import { fetchRoute, formatDistance, formatDuration } from "../lib/route";
import { pickPoiName } from "../lib/contentText";
import { toast } from "./ToastHost";

type Endpoint =
  | { kind: "current" }                     // 現在地
  | { kind: "poi"; poi: Poi }               // POI
  | { kind: "address"; lat: number; lng: number; label: string };  // 住所

export type RouteToolbarProps = {
  uiLang: "ja" | "en";
  contentLang: string;
  pois: Poi[];
  /** Triggered when user requests a route. Parent does the actual routing + map drawing. */
  onRoute: (from: [number, number], to: [number, number], info: { from: string; to: string }) => Promise<void>;
  /** Called to clear the current route */
  onClear: () => void;
  /** Whether a route is currently displayed */
  hasRoute: boolean;
  /** Optional: route info to display */
  routeInfo?: { distance: string; duration: string } | null;
};

export function RouteToolbar(props: RouteToolbarProps) {
  const { uiLang, contentLang, pois, onRoute, onClear, hasRoute, routeInfo } = props;

  const [expanded, setExpanded] = useState(false);
  const [from, setFrom] = useState<Endpoint | null>({ kind: "current" });
  const [to, setTo] = useState<Endpoint | null>(null);
  const [loading, setLoading] = useState(false);

  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  const labelOf = useCallback((ep: Endpoint | null): string => {
    if (!ep) return "";
    if (ep.kind === "current") return t("現在地", "Current location");
    if (ep.kind === "poi") return pickPoiName(ep.poi, contentLang);
    return ep.label;
  }, [contentLang, uiLang]);

  const resolveEndpoint = async (ep: Endpoint): Promise<[number, number]> => {
    if (ep.kind === "current") {
      if (!navigator.geolocation) throw new Error(t("この端末ではGPSが利用できません", "Geolocation unavailable"));
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      return [pos.coords.latitude, pos.coords.longitude];
    }
    if (ep.kind === "poi") {
      if (typeof ep.poi.lat !== "number" || typeof ep.poi.lng !== "number") {
        throw new Error(t("地点に座標がありません", "POI has no coordinates"));
      }
      return [ep.poi.lat, ep.poi.lng];
    }
    return [ep.lat, ep.lng];
  };

  const handleSearch = async () => {
    if (!from || !to) {
      toast.warning(t("出発地と目的地を選んでください", "Select both from and to"));
      return;
    }
    setLoading(true);
    try {
      const fromCoord = await resolveEndpoint(from);
      const toCoord = await resolveEndpoint(to);
      await onRoute(fromCoord, toCoord, { from: labelOf(from), to: labelOf(to) });
      setExpanded(false);  // collapse on success
    } catch (err: any) {
      const code = err?.code;
      const msg = code === 1
        ? t("位置情報の取得が拒否されました", "Location access denied")
        : (err?.message || t("ルート取得に失敗しました", "Failed to get route"));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onClear();
    setExpanded(false);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="routeToolbar">
      {!expanded ? (
        <button
          className={"btn " + (hasRoute ? "primary" : "soft")}
          onClick={() => setExpanded(true)}
          aria-label={t("ルート検索を開く", "Open route search")}
          title={t("ルート検索", "Route")}
        >
          <span aria-hidden="true">🗺️</span>
          <span>{t("ルート", "Route")}</span>
          {routeInfo ? <span className="routeBadge">{routeInfo.duration}</span> : null}
        </button>
      ) : (
        <div className="routePanel">
          <div className="routePanelHeader">
            <strong>{t("ルート検索", "Find Route")}</strong>
            <button
              className="btn"
              onClick={() => setExpanded(false)}
              aria-label={t("閉じる", "Close")}
              style={{ padding: "2px 8px", fontSize: 12 }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div className="routeRow">
            <span className="routeRowLabel">{t("出発", "From")}</span>
            <EndpointPicker
              value={from}
              onChange={setFrom}
              pois={pois}
              uiLang={uiLang}
              contentLang={contentLang}
              placeholder={t("住所/地点", "Address/POI")}
            />
          </div>

          <button
            className="routeSwap"
            onClick={swap}
            aria-label={t("入れ替え", "Swap")}
            title={t("出発と目的地を入れ替える", "Swap from/to")}
          >
            <span aria-hidden="true">⇅</span>
          </button>

          <div className="routeRow">
            <span className="routeRowLabel">{t("目的", "To")}</span>
            <EndpointPicker
              value={to}
              onChange={setTo}
              pois={pois}
              uiLang={uiLang}
              contentLang={contentLang}
              placeholder={t("住所/地点", "Address/POI")}
            />
          </div>

          <div className="routeActions">
            {hasRoute ? (
              <button className="btn soft" onClick={handleClear}>
                {t("ルートをクリア", "Clear route")}
              </button>
            ) : null}
            <button
              className="btn primary"
              onClick={handleSearch}
              disabled={loading || !from || !to}
            >
              {loading ? t("検索中…", "Searching…") : t("ルートを表示", "Show route")}
            </button>
          </div>

          {routeInfo ? (
            <div className="routeInfo">
              <span>📏 {routeInfo.distance}</span>
              <span>⏱ {routeInfo.duration}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Endpoint picker (current / POI / address)
// ─────────────────────────────────────────────
function EndpointPicker(props: {
  value: Endpoint | null;
  onChange: (e: Endpoint | null) => void;
  pois: Poi[];
  uiLang: "ja" | "en";
  contentLang: string;
  placeholder: string;
}) {
  const { value, onChange, pois, uiLang, contentLang, placeholder } = props;
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ kind: "poi"; poi: Poi } | { kind: "address"; result: GeocodeResult }>>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const t = (ja: string, en: string) => uiLang === "ja" ? ja : en;

  // Click outside to close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced address geocoding
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    // Filter POIs synchronously
    const lc = q.toLowerCase();
    const poiMatches = pois
      .filter(p => {
        const name = pickPoiName(p, contentLang).toLowerCase();
        return name.includes(lc) || (p.id ?? "").toLowerCase().includes(lc);
      })
      .slice(0, 5)
      .map(p => ({ kind: "poi" as const, poi: p }));

    setSuggestions(poiMatches);

    // Debounce address geocoding
    debounceRef.current = window.setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      setSearching(true);
      try {
        const results = await geocode(q, {
          limit: 4,
          lang: uiLang,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        setSuggestions([
          ...poiMatches,
          ...results.map(r => ({ kind: "address" as const, result: r })),
        ]);
      } catch {
        // Ignore (network error, abort, etc.)
      } finally {
        setSearching(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, pois, contentLang, uiLang]);

  const displayValue = value
    ? (value.kind === "current" ? t("📍 現在地", "📍 Current location")
        : value.kind === "poi" ? pickPoiName(value.poi, contentLang)
        : value.label)
    : "";

  return (
    <div className="endpointPicker" ref={containerRef}>
      <input
        type="text"
        value={open ? query : displayValue}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        className="endpointInput"
      />
      {open ? (
        <div className="endpointDropdown">
          <button
            className="endpointOption endpointCurrent"
            onClick={() => { onChange({ kind: "current" }); setOpen(false); }}
          >
            <span className="endpointIcon" aria-hidden="true">📍</span>
            <span>{t("現在地を使う", "Use current location")}</span>
          </button>
          {suggestions.length > 0 ? (
            <>
              <div className="endpointDivider" />
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="endpointOption"
                  onClick={() => {
                    if (s.kind === "poi") {
                      onChange({ kind: "poi", poi: s.poi });
                    } else {
                      onChange({ kind: "address", lat: s.result.lat, lng: s.result.lng, label: s.result.displayName });
                    }
                    setOpen(false);
                  }}
                >
                  <span className="endpointIcon" aria-hidden="true">
                    {s.kind === "poi" ? "📌" : "🏠"}
                  </span>
                  <span className="endpointLabel">
                    {s.kind === "poi" ? pickPoiName(s.poi, contentLang) : s.result.displayName}
                  </span>
                </button>
              ))}
            </>
          ) : null}
          {searching ? (
            <div className="endpointLoading">{t("検索中…", "Searching…")}</div>
          ) : (query && suggestions.length === 0 ? (
            <div className="endpointEmpty">{t("該当なし", "No matches")}</div>
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}
