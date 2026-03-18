import React, { useMemo } from "react";
import * as L from "leaflet";
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { type AppConfig, type Poi, type Category } from "../lib/schema";
import { pickPoiName, pickPoiDescription, pickCategoryLabel } from "../lib/contentText";
import { publicUrl } from "../lib/publicUrl";
import { t, type UiLang } from "../lib/i18n";
import { getOpenStatus, hasBusinessInfo, type OpenStatus } from "../lib/openStatus";

function LocateControl({ enabled, uiLang }: { enabled: boolean; uiLang: UiLang }) {
  const map = useMap();
  const [busy, setBusy] = React.useState(false);

  const markerRef = React.useRef<L.Marker | null>(null);
  const circleRef = React.useRef<L.Circle | null>(null);

  const clear = React.useCallback(() => {
    try { markerRef.current?.remove(); } catch {}
    try { circleRef.current?.remove(); } catch {}
    markerRef.current = null;
    circleRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => clear();
  }, [clear]);

  const onLocate = React.useCallback(() => {
    if (!enabled) return;

    if (!("geolocation" in navigator) || !navigator.geolocation) {
      alert(t(uiLang, "locate_not_supported"));
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.max(0, pos.coords.accuracy || 0);

        clear();

        const zoom = Math.max(map.getZoom(), 16);
        map.flyTo([lat, lng], zoom, { duration: 0.8 });

        // Location marker (no external image assets)
        const icon = L.divIcon({
          className: "msf-mypos-icon",
          html: '<div class="msf-mypos-dot" aria-hidden="true"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);

        if (Number.isFinite(acc) && acc > 0) {
          circleRef.current = L.circle([lat, lng], {
            radius: acc,
            color: "var(--accent)",
            fillColor: "var(--accent)",
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map);
        }
      },
      (err) => {
        setBusy(false);
        if (err?.code === 1) alert(t(uiLang, "locate_permission_denied"));
        else alert(t(uiLang, "locate_failed"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [enabled, uiLang, map, clear]);

  if (!enabled) return null;

  return (
    <div
      className="msf-locateWrap"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        className={"btn soft msf-locateBtn" + (busy ? " isBusy" : "")}
        type="button"
        title={t(uiLang, "locate_me")}
        aria-label={t(uiLang, "locate_me")}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate(); }}
        disabled={busy}
      >
        {busy ? "…" : "📍"}
      </button>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds.pad(0.2));
  }, [map, bounds]);
  return null;
}


function ZoomControlPosition({ position }: { position: L.ControlPosition }) {
  const map = useMap();
  React.useEffect(() => {
    try { (map as any).zoomControl?.setPosition?.(position); } catch {}
  }, [map, position]);
  return null;
}

function MapClick({ onClick }: { onClick?: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click: (e) => onClick?.(e.latlng)
  });
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PALETTE = ["#6ea8fe", "#ff6b6b", "#f0ad4e", "#5cb85c", "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function resolveColor(catKey: string, explicit?: string, order?: number): string {
  const c = (explicit ?? "").trim();
  if (c) return c;
  const idx = (order ?? 0) + (hashString(catKey) % 97);
  return PALETTE[idx % PALETTE.length];
}

type MarkerType = "pin" | "dot" | "badge" | "ring" | "square" | "hex" | "flag";

const iconCache = new Map<string, L.DivIcon>();

function makeDivIcon(type: MarkerType, color: string, glyph: string, title?: string, status?: OpenStatus): L.DivIcon {
  const g = (glyph ?? "").trim() || "•";
  const stKey = status ? `|${status}` : "";
  const key = `${type}|${color}|${g}${stKey}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const safeGlyph = escapeHtml(g);

  // icon geometry (px)
  const iconSize: [number, number] =
    type === "pin" ? [36, 48]
    : type === "badge" ? [44, 28]
    : type === "flag" ? [38, 46]
    : [22, 22];
  const iconAnchor: [number, number] =
    type === "pin" ? [18, 46]
    : type === "badge" ? [22, 14]
    : type === "flag" ? [10, 44]
    : [11, 11];
  const popupAnchor: [number, number] =
    type === "pin" ? [0, -46]
    : type === "badge" ? [0, -16]
    : type === "flag" ? [0, -40]
    : [0, -10];

  const closedClass = status === "closed" ? " isClosed" : "";

  const inner =
    type === "pin"
      ? `<div class="msf-marker msf-marker--pin${closedClass}" style="--mc:${escapeHtml(color)}">
          <svg class="msf-marker__svg" width="36" height="48" viewBox="0 0 36 48" aria-hidden="true">
            <path d="M18 47C18 47 4 32 4 19C4 10.163 10.163 4 18 4C25.837 4 32 10.163 32 19C32 32 18 47 18 47Z" fill="var(--mc)"/>
            <circle cx="18" cy="19" r="10.5" fill="white" opacity="0.92"/>
          </svg>
          <div class="msf-marker__glyph">${safeGlyph}</div>
        </div>`
      : type === "badge"
      ? `<div class="msf-marker msf-marker--badge${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__badge">${safeGlyph}</div>
        </div>`
      : type === "ring"
      ? `<div class="msf-marker msf-marker--ring${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__ring">${safeGlyph}</div>
        </div>`
      : type === "square"
      ? `<div class="msf-marker msf-marker--square${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__square">${safeGlyph}</div>
        </div>`
      : type === "hex"
      ? `<div class="msf-marker msf-marker--hex${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__hex">${safeGlyph}</div>
        </div>`
      : type === "flag"
      ? `<div class="msf-marker msf-marker--flag${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__pole"></div>
          <div class="msf-marker__flag">${safeGlyph}</div>
        </div>`
      : `<div class="msf-marker msf-marker--dot${closedClass}" style="--mc:${escapeHtml(color)}">
          <div class="msf-marker__dot">${safeGlyph}</div>
        </div>`;

  const html = status
    ? `<div class="msf-markerWrap" title="${escapeHtml(title ?? "")}">
         ${inner}
         <div class="msf-statusDot msf-statusDot--${escapeHtml(status)}" aria-hidden="true"></div>
       </div>`
    : `<div class="msf-markerWrap" title="${escapeHtml(title ?? "")}">${inner}</div>`;

  const icon = L.divIcon({
    className: "msf-divicon",
    html,
    iconSize,
    iconAnchor,
    popupAnchor
  });

  iconCache.set(key, icon);
  return icon;
}

function markerLatLng(cfg: AppConfig, poi: Poi): L.LatLngExpression | null {
  if (cfg.mode === "outdoor") {
    if (typeof poi.lat !== "number" || typeof poi.lng !== "number") return null;
    return [poi.lat, poi.lng];
  }

  if (typeof poi.x !== "number" || typeof poi.y !== "number") return null;
  const w = cfg.indoor.imageWidthPx;
  const h = cfg.indoor.imageHeightPx;

  // Allow both:
  // - normalized coordinates: 0..1
  // - pixel coordinates: 0..width / 0..height
  const isNorm = poi.x >= 0 && poi.x <= 1 && poi.y >= 0 && poi.y <= 1;
  const pxX = isNorm ? poi.x * w : poi.x;
  const pxY = isNorm ? poi.y * h : poi.y;

  if (!Number.isFinite(pxX) || !Number.isFinite(pxY)) return null;
  return [pxY, pxX]; // CRS.Simple: lat=y, lng=x
}

export function MapView(props: {
  config: AppConfig;
  pois: Poi[];
  categories: Category[];
  activeCategory?: string;
  query?: string;
  contentLang?: string;
  uiLang?: UiLang;
  /** Viewer helper: when true, move Leaflet zoom +/- to bottom-left (so top-left UI stays visible). */
  mapOnly?: boolean;
  /** When true, show only places that are "open now" (outdoor + business hours). */
  openOnly?: boolean;
  /** Optional timestamp to keep time-based indicators (e.g., "open" ) in sync. */
  now?: number;
  onPickPoi?: (poi: Poi) => void;

  // Builder helper: map click
  onMapClick?: (latlng: L.LatLng) => void;

  // Builder helper: allow previewing an uploaded floor image (blob/data URL) before export
  indoorImageOverrideUrl?: string;
}) {
  const { config, pois, categories } = props;
  const contentLang = props.contentLang ?? config.i18n.defaultLang;
  const uiLang: UiLang = props.uiLang ?? "ja";

  const now = useMemo(() => new Date(props.now ?? Date.now()), [props.now]);
  const openOnly = !!props.openOnly;

  const filtered = useMemo(() => {
    const q = (props.query ?? "").trim().toLowerCase();
    const cat = props.activeCategory ?? "";
    return pois.filter(p => {
      const okCat = !cat || p.category === cat;

      const name = pickPoiName(p, contentLang);
      const desc = pickPoiDescription(p, contentLang);

      // search in both default text and translated text (fallback-friendly)
      const txt = `${p.name} ${p.description} ${name} ${desc}`.toLowerCase();
      const okQ = !q || txt.includes(q);

if (openOnly) {
  const showBiz = config.mode === "outdoor" && hasBusinessInfo(p as any);
  if (!showBiz) return false;
  const st = getOpenStatus(p as any, now);
  if (st !== "open") return false;
}

return okCat && okQ;
    });
  }, [pois, props.query, props.activeCategory, contentLang, openOnly, config.mode, now]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.category, c);
    return m;
  }, [categories]);

  const bounds = useMemo(() => {
    const latlngs: L.LatLng[] = [];
    for (const p of filtered) {
      const ll = markerLatLng(config, p);
      if (!ll) continue;
      latlngs.push(L.latLng(ll as any));
    }
    if (!latlngs.length) return null;
    return L.latLngBounds(latlngs);
  }, [filtered, config]);

  const indoorBounds = useMemo(() => {
    const w = config.indoor.imageWidthPx;
    const h = config.indoor.imageHeightPx;
    return L.latLngBounds([0, 0], [h, w]);
  }, [config]);

  const indoorImageUrl = useMemo(() => {
    if (config.mode !== "indoor") return "";
    const u = (props.indoorImageOverrideUrl ?? "").trim();
    if (!u) {
      const raw = (config.indoor.imageUrl ?? "").trim();
      if (raw.startsWith("blob:") || raw.startsWith("data:") || /^https?:\/\//i.test(raw)) return raw;
      return publicUrl(raw);
    }
    // If it's already an absolute/blob/data URL, use it as-is.
    if (u.startsWith("blob:") || u.startsWith("data:") || /^https?:\/\//i.test(u)) return u;
    return publicUrl(u);
  }, [config.mode, config.indoor.imageUrl, props.indoorImageOverrideUrl]);

  const centerOutdoor = config.outdoor.center as [number, number];

  return (
    <div className="mapWrap">
      <MapContainer
        center={config.mode === "outdoor" ? centerOutdoor : [config.indoor.imageHeightPx / 2, config.indoor.imageWidthPx / 2]}
        zoom={config.mode === "outdoor" ? config.outdoor.zoom : 0}
        crs={config.mode === "indoor" ? L.CRS.Simple : L.CRS.EPSG3857}
        minZoom={config.mode === "indoor" ? (config.indoor.minZoom ?? -2) : undefined}
        maxZoom={config.mode === "indoor" ? (config.indoor.maxZoom ?? 2) : undefined}
        style={{ height: "100%", width: "100%" }}
      >
        {config.mode === "outdoor" ? (
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        ) : (
          <ImageOverlay url={indoorImageUrl} bounds={indoorBounds} />
        )}

        <ZoomControlPosition position={props.mapOnly ? "bottomleft" : "topleft"} />

        {/* Outdoor-only: jump to current location (GPS) */}
        <LocateControl enabled={config.mode === "outdoor"} uiLang={uiLang} />

        <MapClick onClick={props.onMapClick} />

        {filtered.map((p, idx) => {
          const ll = markerLatLng(config, p);
          if (!ll) return null;

          const cat = catMap.get(p.category);
          const catLabel = cat ? pickCategoryLabel(cat, contentLang) : p.category;

          const name = pickPoiName(p, contentLang);
          const desc = pickPoiDescription(p, contentLang);

          const markerType = (cat?.markerType ?? "pin") as MarkerType;
          const color = resolveColor(p.category, cat?.markerColor, cat?.order ?? idx);
          const glyph = (cat?.icon ?? "").trim() || "•";

          const bizStatus: OpenStatus | undefined =
            (config.mode === "outdoor" && hasBusinessInfo(p as any))
              ? getOpenStatus(p as any, now)
              : undefined;

          return (
            <Marker
              key={p.id}
              position={ll}
              icon={makeDivIcon(markerType, color, glyph, catLabel, bizStatus)}
            >
              <Popup>
                <div style={{ fontWeight: 900 }}>{cat?.icon ? `${cat.icon} ` : ""}{name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{catLabel}</div>
                {config.mode === "outdoor" && hasBusinessInfo(p as any) ? (() => {
                  const st = getOpenStatus(p as any, now);
                  const icon = st === "open" ? "🟢" : st === "closed" ? "🔴" : "⏰";
                  const label = st === "open" ? t(uiLang, "open_now") : st === "closed" ? t(uiLang, "closed_now") : t(uiLang, "hours_unknown");
                  return <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{icon} {label}</div>;
                })() : null}
                <div style={{ marginTop: 6, fontSize: 13 }}>{desc}</div>
                {props.onPickPoi ? (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn primary" onClick={() => props.onPickPoi?.(p)}>{t(uiLang, "open_details")}</button>
                  </div>
                ) : null}
              </Popup>
            </Marker>
          );
        })}

        {bounds ? <FitBounds bounds={bounds} /> : null}
      </MapContainer>
    </div>
  );
}
