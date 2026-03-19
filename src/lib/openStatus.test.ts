import { describe, it, expect } from "vitest";
import { getOpenStatus, hasBusinessInfo } from "./openStatus";

describe("hasBusinessInfo", () => {
  it("returns false for empty hours and closed", () => {
    expect(hasBusinessInfo({ hours: "", closed: "" })).toBe(false);
  });
  it("returns true when hours is set", () => {
    expect(hasBusinessInfo({ hours: "10:00-18:00", closed: "" })).toBe(true);
  });
  it("returns true when closed is set", () => {
    expect(hasBusinessInfo({ hours: "", closed: "水" })).toBe(true);
  });
});

describe("getOpenStatus", () => {
  it("returns unknown for empty inputs", () => {
    expect(getOpenStatus({ hours: "", closed: "" })).toBe("unknown");
  });

  it("detects open during business hours", () => {
    const wed14 = new Date("2025-01-15T14:00:00"); // Wednesday 14:00
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "" }, wed14)).toBe("open");
  });

  it("detects closed outside business hours", () => {
    const wed20 = new Date("2025-01-15T20:00:00"); // Wednesday 20:00
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "" }, wed20)).toBe("closed");
  });

  it("detects closed on a closed day", () => {
    const wed14 = new Date("2025-01-15T14:00:00"); // Wednesday 14:00
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "水" }, wed14)).toBe("closed");
  });

  it("handles 24h format", () => {
    const any = new Date("2025-01-15T03:00:00");
    expect(getOpenStatus({ hours: "24時間", closed: "" }, any)).toBe("open");
  });

  it("handles per-day hours (Japanese weekdays)", () => {
    const mon12 = new Date("2025-01-13T12:00:00"); // Monday 12:00
    expect(getOpenStatus({ hours: "月-金 10:00-20:00", closed: "" }, mon12)).toBe("open");
    const sat12 = new Date("2025-01-18T12:00:00"); // Saturday 12:00
    expect(getOpenStatus({ hours: "月-金 10:00-20:00", closed: "" }, sat12)).toBe("closed");
  });

  it("handles English weekdays", () => {
    const tue15 = new Date("2025-01-14T15:00:00"); // Tuesday 15:00
    expect(getOpenStatus({ hours: "Mon-Fri 09:00-17:00", closed: "" }, tue15)).toBe("open");
  });

  it("handles multiple closed days", () => {
    const sun = new Date("2025-01-19T12:00:00"); // Sunday
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "土,日" }, sun)).toBe("closed");
    const mon = new Date("2025-01-13T12:00:00"); // Monday
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "土,日" }, mon)).toBe("open");
  });

  it("handles irregular closed", () => {
    expect(getOpenStatus({ hours: "", closed: "不定休" })).toBe("unknown");
  });

  it("handles range closed days 月-金", () => {
    const wed = new Date("2025-01-15T12:00:00"); // Wednesday
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "月-金" }, wed)).toBe("closed");
    const sat = new Date("2025-01-18T12:00:00"); // Saturday
    expect(getOpenStatus({ hours: "10:00-18:00", closed: "月-金" }, sat)).toBe("open");
  });
});
