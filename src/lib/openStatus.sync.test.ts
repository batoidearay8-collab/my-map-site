import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Fix #15: Sync test — ensures the duplicated open-status logic in
 * publish/app.js and openStatus.ts stay synchronized.
 *
 * Both files contain the same business-hours parser. This test verifies
 * that key string patterns exist in both, so if one is updated and the
 * other isn't, this test fails as a reminder to sync.
 */

describe("openStatus / publish/app.js sync", () => {
  const reactSide = readFileSync(
    join(__dirname, "openStatus.ts"),
    "utf-8"
  );
  const publishSide = readFileSync(
    join(__dirname, "publish/app.js"),
    "utf-8"
  );

  it("both files contain getOpenStatus", () => {
    expect(reactSide).toContain("getOpenStatus");
    expect(publishSide).toContain("getOpenStatus");
  });

  it("both files contain hasBusinessInfo", () => {
    expect(reactSide).toContain("hasBusinessInfo");
    expect(publishSide).toContain("hasBizInfo");
  });

  it("both files handle the same Japanese day tokens", () => {
    const tokens = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
    for (const tok of tokens) {
      expect(reactSide).toContain(tok);
      expect(publishSide).toContain(tok);
    }
  });

  it("both files handle the same English day tokens (case-insensitive)", () => {
    const tokens = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    for (const tok of tokens) {
      expect(reactSide.toLowerCase()).toContain(tok);
      expect(publishSide.toLowerCase()).toContain(tok);
    }
  });

  it("both files declare SYNC WARNING comment", () => {
    expect(reactSide).toContain("SYNC WARNING");
    expect(publishSide).toContain("SYNC WARNING");
  });

  it("both files return the same status strings", () => {
    expect(reactSide).toMatch(/"open"|'open'/);
    expect(reactSide).toMatch(/"closed"|'closed'/);
    expect(reactSide).toMatch(/"unknown"|'unknown'/);
    expect(publishSide).toMatch(/"open"|'open'/);
    expect(publishSide).toMatch(/"closed"|'closed'/);
    expect(publishSide).toMatch(/"unknown"|'unknown'/);
  });
});
