import { type Poi, type Category, PoiSchema } from "./schema";

/**
 * GeoJSON ←→ POI conversion utilities.
 *
 * Enables interoperability with QGIS, uMap, geojson.io and other OSS geo tools.
 *
 * GeoJSON spec: https://datatracker.ietf.org/doc/html/rfc7946
 */

export type GeoJsonFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat] per GeoJSON spec
  };
  properties: Record<string, any>;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

/**
 * Convert POIs to a GeoJSON FeatureCollection.
 * Only outdoor POIs (with lat/lng) are included.
 */
export function poisToGeoJson(pois: Poi[], categories?: Category[]): GeoJsonFeatureCollection {
  const catMap = new Map<string, Category>();
  if (categories) {
    for (const c of categories) catMap.set(c.category, c);
  }

  const features: GeoJsonFeature[] = [];

  for (const p of pois) {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;

    const cat = catMap.get(p.category);
    const props: Record<string, any> = {
      id: p.id,
      name: p.name,
      description: p.description || "",
      category: p.category || "",
      image: p.image || "",
      url: p.url || "",
    };

    // Optional business hours
    if (p.hours) props.hours = p.hours;
    if (p.closed) props.closed = p.closed;
    if (p.floor) props.floor = p.floor;

    // i18n fields
    if (p.nameI18n && Object.keys(p.nameI18n).length > 0) {
      for (const [lang, val] of Object.entries(p.nameI18n)) {
        props[`name_${lang}`] = val;
      }
    }
    if (p.descriptionI18n && Object.keys(p.descriptionI18n).length > 0) {
      for (const [lang, val] of Object.entries(p.descriptionI18n)) {
        props[`description_${lang}`] = val;
      }
    }

    // Category metadata
    if (cat) {
      props.category_icon = cat.icon || "";
      props.category_label = cat.label || "";
      props.marker_type = cat.markerType || "pin";
      props.marker_color = cat.markerColor || "";
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [p.lng, p.lat], // GeoJSON: [lng, lat]
      },
      properties: props,
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Import POIs from a GeoJSON FeatureCollection.
 * Handles both [lng, lat] (spec) and auto-detects if someone accidentally used [lat, lng].
 */
export function geoJsonToPois(geojson: GeoJsonFeatureCollection): Poi[] {
  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("Invalid GeoJSON: expected a FeatureCollection");
  }

  const pois: Poi[] = [];

  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];
    if (!feature || feature.type !== "Feature") continue;
    if (!feature.geometry || feature.geometry.type !== "Point") continue;

    const coords = feature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    let [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Heuristic: if lat > 90, the user probably swapped lat/lng
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      [lat, lng] = [lng, lat];
    }

    const props = feature.properties || {};

    // Collect i18n fields
    const nameI18n: Record<string, string> = {};
    const descI18n: Record<string, string> = {};
    for (const key of Object.keys(props)) {
      const nameMatch = key.match(/^name_(.+)$/);
      if (nameMatch) {
        const lang = nameMatch[1];
        const val = String(props[key] ?? "").trim();
        if (val) nameI18n[lang] = val;
      }
      const descMatch = key.match(/^(?:description|desc)_(.+)$/);
      if (descMatch) {
        const lang = descMatch[1];
        const val = String(props[key] ?? "").trim();
        if (val) descI18n[lang] = val;
      }
    }

    const raw: any = {
      id: String(props.id ?? props.ID ?? props.fid ?? (i + 1)),
      name: String(props.name ?? props.Name ?? props.NAME ?? props.title ?? `Point ${i + 1}`),
      description: String(props.description ?? props.Description ?? props.desc ?? ""),
      category: String(props.category ?? props.Category ?? props.type ?? ""),
      image: String(props.image ?? props.Image ?? ""),
      url: String(props.url ?? props.URL ?? props.website ?? ""),
      hours: String(props.hours ?? props.Hours ?? props.business_hours ?? ""),
      closed: String(props.closed ?? props.Closed ?? props.holidays ?? ""),
      floor: String(props.floor ?? props.Floor ?? props.フロア ?? ""),
      lat,
      lng,
      nameI18n,
      descriptionI18n: descI18n,
    };

    const parsed = PoiSchema.safeParse(raw);
    if (parsed.success) pois.push(parsed.data);
  }

  return pois;
}

/**
 * Export GeoJSON as a downloadable string.
 */
export function geoJsonToString(geojson: GeoJsonFeatureCollection): string {
  return JSON.stringify(geojson, null, 2);
}
