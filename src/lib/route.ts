/**
 * Route calculation using OSRM (Open Source Routing Machine).
 *
 * Uses the public demo server by default. For production, configure
 * your own OSRM server via config.routing.osrmUrl.
 *
 * ⚠️  The public demo server (router.project-osrm.org) is rate-limited
 *     and intended for testing only. See: https://github.com/Project-OSRM/osrm-backend
 *
 * 100% OSS — no Google/Apple APIs involved.
 */

export type RouteResult = {
  /** Decoded polyline coordinates [lat, lng][] */
  coordinates: [number, number][];
  /** Distance in meters */
  distanceMeters: number;
  /** Duration in seconds */
  durationSeconds: number;
};

const DEFAULT_OSRM_URL = "https://router.project-osrm.org";

/**
 * Fetch a walking route between two points.
 * Falls back to a straight line if OSRM is unreachable.
 */
export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  options?: {
    osrmUrl?: string;
    profile?: "foot" | "car" | "bike";
  }
): Promise<RouteResult> {
  const base = (options?.osrmUrl || DEFAULT_OSRM_URL).replace(/\/+$/, "");
  const profile = options?.profile ?? "foot";

  // OSRM expects coordinates as lng,lat (not lat,lng)
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const url = `${base}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);

    const data = await res.json();
    if (!data.routes || !data.routes.length) {
      throw new Error("No route found");
    }

    const route = data.routes[0];
    const geojsonCoords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] // GeoJSON [lng,lat] → [lat,lng]
    );

    return {
      coordinates: geojsonCoords,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch (err) {
    // Fallback: straight line
    console.warn("OSRM routing failed, using straight line:", err);
    return {
      coordinates: [from, to],
      distanceMeters: haversineDistance(from, to),
      durationSeconds: haversineDistance(from, to) / 1.2, // ~4.3 km/h walking
    };
  }
}

/** Haversine distance in meters between two [lat,lng] points. */
function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Format duration (seconds) as human-readable string. */
export function formatDuration(seconds: number, lang: "ja" | "en" = "ja"): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return lang === "ja" ? `約${mins}分` : `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return lang === "ja" ? `約${h}時間${m}分` : `~${h}h ${m}m`;
}

/** Format distance (meters) as human-readable string. */
export function formatDistance(meters: number, lang: "ja" | "en" = "ja"): string {
  if (meters < 1000) return lang === "ja" ? `${Math.round(meters)}m` : `${Math.round(meters)}m`;
  const km = (meters / 1000).toFixed(1);
  return lang === "ja" ? `${km}km` : `${km}km`;
}
