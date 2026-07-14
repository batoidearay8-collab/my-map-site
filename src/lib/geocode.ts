/**
 * Address geocoding via OpenStreetMap Nominatim.
 * Free, no API key required. Has usage policy: max 1 req/sec.
 *
 * https://nominatim.org/release-docs/latest/api/Search/
 */

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Search an address. Returns up to `limit` results sorted by relevance.
 * Pass an AbortSignal to cancel in-flight requests (debounced search).
 */
export async function geocode(
  query: string,
  options?: {
    limit?: number;
    countryCode?: string;  // e.g. "jp" to restrict to Japan
    lang?: string;          // accept-language header
    signal?: AbortSignal;
  }
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: String(options?.limit ?? 5),
    addressdetails: "1",
  });
  if (options?.countryCode) {
    params.set("countrycodes", options.countryCode);
  }

  const headers: Record<string, string> = {
    "Accept-Language": options?.lang ?? "ja",
  };

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers,
    signal: options?.signal,
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  return data.map(d => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    displayName: d.display_name,
  }));
}
