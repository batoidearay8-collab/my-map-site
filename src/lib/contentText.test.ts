import { describe, it, expect } from "vitest";
import { pickPoiName, pickPoiDescription, pickCategoryLabel, pickConfigTitle } from "./contentText";
import { ConfigSchema, PoiSchema, CategorySchema } from "./schema";

describe("pickPoiName", () => {
  const poi = PoiSchema.parse({
    id: "1", name: "デフォルト名",
    nameI18n: { en: "English Name", zh: "中文名" },
  });

  it("returns i18n name for matching lang", () => {
    expect(pickPoiName(poi, "en")).toBe("English Name");
    expect(pickPoiName(poi, "zh")).toBe("中文名");
  });

  it("falls back to default name for missing lang", () => {
    expect(pickPoiName(poi, "fr")).toBe("デフォルト名");
  });

  it("falls back to default name for empty i18n entry", () => {
    const p2 = PoiSchema.parse({ id: "2", name: "Base", nameI18n: { en: "  " } });
    expect(pickPoiName(p2, "en")).toBe("Base");
  });
});

describe("pickPoiDescription", () => {
  it("returns i18n description", () => {
    const poi = PoiSchema.parse({ id: "1", name: "N", description: "日本語説明", descriptionI18n: { en: "English desc" } });
    expect(pickPoiDescription(poi, "en")).toBe("English desc");
    expect(pickPoiDescription(poi, "ja")).toBe("日本語説明");
  });
});

describe("pickCategoryLabel", () => {
  it("returns i18n label", () => {
    const cat = CategorySchema.parse({ category: "food", label: "食べ物", labelI18n: { en: "Food" } });
    expect(pickCategoryLabel(cat, "en")).toBe("Food");
    expect(pickCategoryLabel(cat, "ja")).toBe("食べ物");
  });

  it("falls back to category key when label is empty", () => {
    const cat = CategorySchema.parse({ category: "mycat" });
    expect(pickCategoryLabel(cat, "en")).toBe("mycat");
  });
});

describe("pickConfigTitle", () => {
  it("returns i18n title", () => {
    const cfg = ConfigSchema.parse({
      title: "マップ", titleI18n: { en: "Map" },
      template: "event", mode: "outdoor",
      privacy: { stripImageMetadata: true, roundOutdoorLatLngDecimals: 5, hideExactOutdoorLocationByDefault: false },
      outdoor: { center: [35, 139], zoom: 10 },
      indoor: { imageUrl: "", imageWidthPx: 1, imageHeightPx: 1 },
    });
    expect(pickConfigTitle(cfg, "en")).toBe("Map");
    expect(pickConfigTitle(cfg, "ja")).toBe("マップ");
  });
});
