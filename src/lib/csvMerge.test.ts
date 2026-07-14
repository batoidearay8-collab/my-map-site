/**
 * Tests for the CSV merge (upsert) helpers introduced in v10.23.0.
 * Semantics under test: append new keys, overwrite duplicates in place,
 * skip empty keys, last-wins for duplicates within the incoming batch.
 */
import { describe, it, expect } from "vitest";
import { mergeByKey, mergePois, mergeCategories } from "./csv";
import type { Poi, Category } from "./schema";

const poi = (id: string, name: string, extra: Partial<Poi> = {}): Poi =>
  ({ id, name, description: "", category: "展示", image: "", url: "", nameI18n: {}, descriptionI18n: {}, x: 0.5, y: 0.5, ...extra }) as Poi;

const cat = (category: string, label = category): Category =>
  ({ category, label }) as Category;

describe("mergePois (append new / overwrite same id)", () => {
  it("appends records with new ids at the end, in incoming order", () => {
    const res = mergePois([poi("1", "本部")], [poi("2", "ステージ"), poi("3", "トイレ")]);
    expect(res.merged.map(p => p.id)).toEqual(["1", "2", "3"]);
    expect(res.added).toBe(2);
    expect(res.updated).toBe(0);
  });

  it("overwrites a duplicate id IN PLACE (position preserved, whole record replaced)", () => {
    const existing = [poi("1", "本部"), poi("2", "ステージ", { description: "旧" }), poi("3", "トイレ")];
    const res = mergePois(existing, [poi("2", "ステージA", { description: "新" })]);
    expect(res.merged.map(p => p.id)).toEqual(["1", "2", "3"]);
    expect(res.merged[1].name).toBe("ステージA");
    expect(res.merged[1].description).toBe("新");
    expect(res.added).toBe(0);
    expect(res.updated).toBe(1);
  });

  it("handles a mixed batch (P02's CSV over P01's data)", () => {
    const p01 = [poi("101", "1年A組"), poi("102", "1年B組")];
    const p02 = [poi("102", "1年B組(修正)"), poi("201", "2年A組"), poi("202", "2年B組")];
    const res = mergePois(p01, p02);
    expect(res.merged.map(p => p.id)).toEqual(["101", "102", "201", "202"]);
    expect(res.merged[1].name).toBe("1年B組(修正)");
    expect(res.added).toBe(2);
    expect(res.updated).toBe(1);
  });

  it("skips records with an empty id and counts them", () => {
    const res = mergePois([poi("1", "本部")], [poi("", "名無し"), poi("2", "ステージ")]);
    expect(res.merged.map(p => p.id)).toEqual(["1", "2"]);
    expect(res.skipped).toBe(1);
    expect(res.added).toBe(1);
  });

  it("last-wins for duplicate ids within the incoming batch, without double counting", () => {
    const res = mergePois([], [poi("5", "初版"), poi("5", "最終版")]);
    expect(res.merged).toHaveLength(1);
    expect(res.merged[0].name).toBe("最終版");
    expect(res.added).toBe(1);
    expect(res.updated).toBe(0); // updating a record added in the same batch is not an "update"
  });

  it("does not mutate the existing array", () => {
    const existing = [poi("1", "本部")];
    mergePois(existing, [poi("1", "上書き"), poi("2", "追加")]);
    expect(existing).toHaveLength(1);
    expect(existing[0].name).toBe("本部");
  });
});

describe("mergeCategories (keyed by category)", () => {
  it("appends new categories and overwrites duplicates", () => {
    const res = mergeCategories(
      [cat("展示"), cat("食べ物", "たべもの")],
      [cat("食べ物", "フード"), cat("ステージ")],
    );
    expect(res.merged.map(c => c.category)).toEqual(["展示", "食べ物", "ステージ"]);
    expect(res.merged[1].label).toBe("フード");
    expect(res.added).toBe(1);
    expect(res.updated).toBe(1);
  });
});

describe("mergeByKey (generic)", () => {
  it("works with a custom key function", () => {
    type Row = { k: string; v: number };
    const res = mergeByKey<Row>([{ k: "a", v: 1 }], [{ k: "a", v: 9 }, { k: "b", v: 2 }], r => r.k);
    expect(res.merged).toEqual([{ k: "a", v: 9 }, { k: "b", v: 2 }]);
  });
});
