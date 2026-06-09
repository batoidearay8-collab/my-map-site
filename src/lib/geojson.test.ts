import { describe, it, expect } from "vitest";
import { poisToGeoJson, geoJsonToPois, type GeoJsonFeatureCollection } from "./geojson";
import type { Poi } from "./schema";

const samplePois: Poi[] = [
  {
    id: "1", name: "Tokyo Tower", description: "Landmark",
    category: "tourist", image: "", url: "",
    hours: "10:00-22:00", closed: "",
    nameI18n: { ja: "東京タワー" }, descriptionI18n: {},
    lat: 35.6586, lng: 139.7454,
  },
  {
    id: "2", name: "Indoor Only", description: "No lat/lng",
    category: "indoor", image: "", url: "",
    hours: "", closed: "",
    nameI18n: {}, descriptionI18n: {},
    x: 0.5, y: 0.3,
  },
];

describe("poisToGeoJson", () => {
  it("converts outdoor POIs to GeoJSON features", () => {
    const result = poisToGeoJson(samplePois);
    expect(result.type).toBe("FeatureCollection");
    // Only POI with lat/lng should be exported
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual([139.7454, 35.6586]); // [lng, lat]
    expect(result.features[0].properties.name).toBe("Tokyo Tower");
    expect(result.features[0].properties.name_ja).toBe("東京タワー");
    expect(result.features[0].properties.hours).toBe("10:00-22:00");
  });

  it("returns empty for no outdoor POIs", () => {
    const result = poisToGeoJson([samplePois[1]]);
    expect(result.features).toHaveLength(0);
  });
});

describe("geoJsonToPois", () => {
  it("converts GeoJSON features to POIs", () => {
    const geojson: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [139.7454, 35.6586] },
        properties: { id: "1", name: "Tokyo Tower", description: "Landmark", category: "tourist" },
      }],
    };
    const pois = geoJsonToPois(geojson);
    expect(pois).toHaveLength(1);
    expect(pois[0].lat).toBeCloseTo(35.6586);
    expect(pois[0].lng).toBeCloseTo(139.7454);
    expect(pois[0].name).toBe("Tokyo Tower");
  });

  it("handles swapped lat/lng heuristic", () => {
    const geojson: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [35.6586, 139.7454] }, // swapped!
        properties: { name: "Swapped" },
      }],
    };
    const pois = geoJsonToPois(geojson);
    expect(pois).toHaveLength(1);
    // Should auto-correct
    expect(pois[0].lat).toBeCloseTo(35.6586);
    expect(pois[0].lng).toBeCloseTo(139.7454);
  });

  it("collects i18n fields", () => {
    const geojson: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [139, 35] },
        properties: { name: "Place", name_ja: "場所", description_en: "A place" },
      }],
    };
    const pois = geoJsonToPois(geojson);
    expect(pois[0].nameI18n?.ja).toBe("場所");
    expect(pois[0].descriptionI18n?.en).toBe("A place");
  });

  it("throws on invalid input", () => {
    expect(() => geoJsonToPois({ type: "invalid" } as any)).toThrow("Invalid GeoJSON");
  });

  it("roundtrip: export then import preserves data", () => {
    const exported = poisToGeoJson([samplePois[0]]);
    const reimported = geoJsonToPois(exported);
    expect(reimported).toHaveLength(1);
    expect(reimported[0].name).toBe("Tokyo Tower");
    expect(reimported[0].lat).toBeCloseTo(35.6586);
    expect(reimported[0].lng).toBeCloseTo(139.7454);
    expect(reimported[0].nameI18n?.ja).toBe("東京タワー");
  });
});
