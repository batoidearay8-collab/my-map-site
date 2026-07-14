/**
 * Data-integrity tests for FloorPlanEditor presets (v10.21.0).
 * These import only module-level constants (no DOM / no rendering), so they
 * run in the same node environment as the other unit tests.
 */
import { describe, it, expect } from "vitest";
import { SYMBOLS, ROOM_COLORS, ROOM_TEMPLATES, SIZE_PRESETS } from "./FloorPlanEditor";

describe("FloorPlanEditor room templates", () => {
  it("has unique keys", () => {
    const keys = ROOM_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template colorKey exists in ROOM_COLORS", () => {
    const colorKeys = new Set(ROOM_COLORS.map((c) => c.key));
    for (const t of ROOM_TEMPLATES) {
      expect(colorKeys.has(t.colorKey), `colorKey "${t.colorKey}" of template "${t.key}"`).toBe(true);
    }
  });

  it("every template symbol (if any) exists in SYMBOLS", () => {
    const symbolKeys = new Set(SYMBOLS.map((s) => s.key));
    for (const t of ROOM_TEMPLATES) {
      if (t.symbol) {
        expect(symbolKeys.has(t.symbol), `symbol "${t.symbol}" of template "${t.key}"`).toBe(true);
      }
    }
  });

  it("every template fits inside every size preset", () => {
    for (const p of SIZE_PRESETS) {
      for (const t of ROOM_TEMPLATES) {
        expect(t.w, `template "${t.key}" width vs preset "${p.key}"`).toBeLessThanOrEqual(p.w);
        expect(t.h, `template "${t.key}" height vs preset "${p.key}"`).toBeLessThanOrEqual(p.h);
      }
    }
  });

  it("has ja/en labels for the button UI", () => {
    for (const t of ROOM_TEMPLATES) {
      expect(t.ja.length).toBeGreaterThan(0);
      expect(t.en.length).toBeGreaterThan(0);
    }
  });
});

describe("FloorPlanEditor size presets", () => {
  it("has unique keys and positive dimensions", () => {
    const keys = SIZE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of SIZE_PRESETS) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
    }
  });

  it("includes the historical default 2000×1400 as a preset", () => {
    expect(SIZE_PRESETS.some((p) => p.w === 2000 && p.h === 1400)).toBe(true);
  });

  it("keeps dimensions grid-aligned (multiples of 50)", () => {
    for (const p of SIZE_PRESETS) {
      expect(p.w % 50).toBe(0);
      expect(p.h % 50).toBe(0);
    }
  });
});
