/**
 * Unit tests for the builder metrics pure helpers (v10.22.0).
 * Only pure functions are tested here (no localStorage / DOM needed).
 */
import { describe, it, expect } from "vitest";
import {
  activeDelta,
  formatDuration,
  totalActiveMs,
  metricsToCsv,
  IDLE_MS,
  type MetricsData,
} from "./builderMetrics";

describe("activeDelta (idle-aware active time)", () => {
  it("counts short gaps as active time", () => {
    expect(activeDelta(1000, 6000)).toBe(5000);
  });

  it("counts a gap exactly at the idle threshold", () => {
    expect(activeDelta(0, IDLE_MS)).toBe(IDLE_MS);
  });

  it("does NOT count gaps longer than the idle threshold (breaks excluded)", () => {
    expect(activeDelta(0, IDLE_MS + 1)).toBe(0);
    expect(activeDelta(0, 30 * 60_000)).toBe(0); // 30-min break
  });

  it("ignores zero or negative gaps (clock skew safety)", () => {
    expect(activeDelta(5000, 5000)).toBe(0);
    expect(activeDelta(5000, 4000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats minutes:seconds under an hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("formats h:mm:ss above an hour", () => {
    expect(formatDuration(3600_000)).toBe("1:00:00");
    expect(formatDuration(2 * 3600_000 + 5 * 60_000 + 3_000)).toBe("2:05:03");
  });
});

const sample: MetricsData = {
  version: 1,
  participantId: "P01",
  consentTs: 1_700_000_000_000,
  sessions: [
    {
      id: "aabbccdd11223344",
      startTs: 1_700_000_000_000,
      endTs: 1_700_000_600_000,
      activeMsByContext: { step1: 120_000, step2: 240_500, floorEditor: 60_000 },
      counters: { undo_builder: 3, toast_error: 1 },
    },
    {
      id: "5566778899aabbcc",
      startTs: 1_700_001_000_000,
      endTs: 1_700_001_300_000,
      activeMsByContext: { step4: 90_000 },
      counters: {},
    },
  ],
};

describe("totalActiveMs", () => {
  it("sums across sessions and contexts", () => {
    expect(totalActiveMs(sample)).toBe(120_000 + 240_500 + 60_000 + 90_000);
  });

  it("is zero for no sessions", () => {
    expect(totalActiveMs({ ...sample, sessions: [] })).toBe(0);
  });
});

describe("metricsToCsv", () => {
  const csv = metricsToCsv(sample);
  const lines = csv.split("\n");

  it("has the expected header", () => {
    expect(lines[0]).toBe("participant,session_id,start_iso,end_iso,kind,key,value");
  });

  it("emits one row per context and per counter", () => {
    // 3 contexts + 2 counters in session 1, 1 context in session 2 = 6 rows
    expect(lines.length).toBe(1 + 6);
  });

  it("rounds active time to whole seconds", () => {
    const row = lines.find((l) => l.includes("active_seconds,step2"));
    expect(row).toBeDefined();
    expect(row!.endsWith(",241")).toBe(true); // 240_500 ms → 241 s (round)
  });

  it("includes counters with their values", () => {
    expect(lines.some((l) => l.includes("counter,undo_builder,3"))).toBe(true);
    expect(lines.some((l) => l.includes("counter,toast_error,1"))).toBe(true);
  });

  it("guards against CSV formula injection in the participant id", () => {
    const evil = metricsToCsv({ ...sample, participantId: "=cmd()" });
    expect(evil.split("\n")[1].startsWith("'=cmd()")).toBe(true);
  });
});
