import { describe, it, expect } from "vitest";
import { validateAll } from "./validation";
import { roundLatLng, applyPrivacyForExport } from "./privacy";
import { ConfigSchema, PoiSchema, CategorySchema } from "./schema";

/* ── Schema parse tests ── */
describe("ConfigSchema", () => {
  it("parses minimal valid config", () => {
    const cfg = ConfigSchema.parse({
      title: "Test", template: "event", mode: "outdoor",
      privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 5, hideExactOutdoorLocationByDefault: false },
      outdoor: { center: [35.68, 139.77], zoom: 15 },
      indoor: { imageUrl: "/assets/floor.png", imageWidthPx: 2000, imageHeightPx: 1200 },
    });
    expect(cfg.title).toBe("Test");
    expect(cfg.reco?.needs).toEqual([]); // defaults
    expect(cfg.theme).toBe("dark"); // default
  });

  it("accepts new template types", () => {
    const cfg = ConfigSchema.parse({
      title: "T", template: "disaster", mode: "outdoor",
      privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 5, hideExactOutdoorLocationByDefault: false },
      outdoor: { center: [35, 139], zoom: 10 },
      indoor: { imageUrl: "", imageWidthPx: 1, imageHeightPx: 1 },
    });
    expect(cfg.template).toBe("disaster");
  });

  it("parses reco field", () => {
    const cfg = ConfigSchema.parse({
      title: "T", template: "tourism", mode: "outdoor",
      privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 5, hideExactOutdoorLocationByDefault: false },
      outdoor: { center: [35, 139], zoom: 10 },
      indoor: { imageUrl: "", imageWidthPx: 1, imageHeightPx: 1 },
      reco: { needs: ["駅", "お土産"] },
    });
    expect(cfg.reco?.needs).toEqual(["駅", "お土産"]);
  });
});

describe("PoiSchema", () => {
  it("parses outdoor POI", () => {
    const p = PoiSchema.parse({ id: "1", name: "Place", lat: 35.5, lng: 139.5 });
    expect(p.id).toBe("1");
    expect(p.lat).toBe(35.5);
    expect(p.hours).toBe(""); // default
  });

  it("parses indoor POI", () => {
    const p = PoiSchema.parse({ id: "2", name: "Room", x: 0.5, y: 0.3 });
    expect(p.x).toBe(0.5);
  });
});

/* ── Validation tests ── */
describe("validateAll", () => {
  const baseCfg = ConfigSchema.parse({
    title: "T", template: "event", mode: "outdoor",
    privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 5, hideExactOutdoorLocationByDefault: false },
    outdoor: { center: [35, 139], zoom: 10 },
    indoor: { imageUrl: "", imageWidthPx: 2000, imageHeightPx: 1200 },
  });

  it("reports error for zero POIs", () => {
    const issues = validateAll(baseCfg, [], []);
    expect(issues.some(i => i.level === "error")).toBe(true);
  });

  it("reports error for outdoor POI missing lat/lng", () => {
    const poi = PoiSchema.parse({ id: "1", name: "Test" });
    const issues = validateAll(baseCfg, [poi], []);
    expect(issues.some(i => i.level === "error" && i.poiId === "1")).toBe(true);
  });

  it("reports warning for undefined category", () => {
    const poi = PoiSchema.parse({ id: "1", name: "Test", lat: 35, lng: 139, category: "missing" });
    const cat = CategorySchema.parse({ category: "other" });
    const issues = validateAll(baseCfg, [poi], [cat]);
    expect(issues.some(i => i.level === "warn" && i.message.en.includes("missing"))).toBe(true);
  });

  it("passes for valid data", () => {
    const poi = PoiSchema.parse({ id: "1", name: "OK", lat: 35, lng: 139, category: "c1" });
    const cat = CategorySchema.parse({ category: "c1" });
    const issues = validateAll(baseCfg, [poi], [cat]);
    const errors = issues.filter(i => i.level === "error");
    expect(errors).toHaveLength(0);
  });
});

/* ── Privacy tests ── */
describe("roundLatLng", () => {
  it("rounds to specified decimals", () => {
    const pois = [PoiSchema.parse({ id: "1", name: "P", lat: 35.123456789, lng: 139.123456789 })];
    const rounded = roundLatLng(pois, 3);
    expect(rounded[0].lat).toBe(35.123);
    expect(rounded[0].lng).toBe(139.123);
  });

  it("leaves indoor POIs unchanged", () => {
    const pois = [PoiSchema.parse({ id: "1", name: "P", x: 0.555555, y: 0.333333 })];
    const rounded = roundLatLng(pois, 3);
    expect(rounded[0].x).toBe(0.555555);
  });
});

describe("applyPrivacyForExport", () => {
  it("rounds coordinates for export", () => {
    const cfg = ConfigSchema.parse({
      title: "T", template: "event", mode: "outdoor",
      privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 2, hideExactOutdoorLocationByDefault: false },
      outdoor: { center: [35, 139], zoom: 10 },
      indoor: { imageUrl: "", imageWidthPx: 1, imageHeightPx: 1 },
    });
    const pois = [PoiSchema.parse({ id: "1", name: "P", lat: 35.12345, lng: 139.67890 })];
    const result = applyPrivacyForExport(cfg, pois);
    expect(result[0].lat).toBe(35.12);
    expect(result[0].lng).toBe(139.68);
  });
});
