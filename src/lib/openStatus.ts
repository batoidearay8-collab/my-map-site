import { type Poi } from "./schema";

export type OpenStatus = "open" | "closed" | "unknown";

// Weekday index follows JS Date: 0=Sun ... 6=Sat
const DAY_ALIASES: Array<{ idx: number; tokens: string[] }> = [
  { idx: 0, tokens: ["sun", "sunday", "日", "日曜", "日曜日"] },
  { idx: 1, tokens: ["mon", "monday", "月", "月曜", "月曜日"] },
  { idx: 2, tokens: ["tue", "tues", "tuesday", "火", "火曜", "火曜日"] },
  { idx: 3, tokens: ["wed", "wednesday", "水", "水曜", "水曜日"] },
  { idx: 4, tokens: ["thu", "thur", "thurs", "thursday", "木", "木曜", "木曜日"] },
  { idx: 5, tokens: ["fri", "friday", "金", "金曜", "金曜日"] },
  { idx: 6, tokens: ["sat", "saturday", "土", "土曜", "土曜日"] },
];

function norm(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replaceAll("　", " ");
}

function parseTimeToMin(hhmm: string): number | null {
  const m = String(hhmm).trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? "0");
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 48) return null; // allow 24:00-ish
  if (mi < 0 || mi >= 60) return null;
  return h * 60 + mi;
}

function parseIntervals(part: string): Array<[number, number]> {
  const s = norm(part)
    .replaceAll("〜", "-")
    .replaceAll("~", "-")
    .replaceAll("–", "-")
    .replaceAll("―", "-")
    .replaceAll("−", "-");

  // Split on common separators for multiple ranges
  const pieces = s.split(/\s*(?:,|、|\/|\n|;|；)\s*/g).filter(Boolean);
  const out: Array<[number, number]> = [];
  for (const p of pieces) {
    const m = p.match(/(\d{1,2}:\d{2}|\d{1,2})\s*-\s*(\d{1,2}:\d{2}|\d{1,2})/);
    if (!m) continue;
    const a = parseTimeToMin(m[1]);
    const b = parseTimeToMin(m[2]);
    if (a == null || b == null) continue;
    out.push([a, b]);
  }
  return out;
}

function parseClosedDays(input: string): { days: Set<number>; irregular: boolean; hasAny: boolean } {
  const s = norm(input);
  const days = new Set<number>();
  if (!s) return { days, irregular: false, hasAny: false };

  const irregular = /(不定|irregular|varies)/i.test(s);

  // Day ranges like 月-金 / Mon-Fri
  const rangeRe = /(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s*(?:-|〜|~)\s*(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rangeRe.exec(s))) {
    const aTok = norm(rm[1]);
    const bTok = norm(rm[2]);
    const a = DAY_ALIASES.find(d => d.tokens.some(t => norm(t) === aTok))?.idx;
    const b = DAY_ALIASES.find(d => d.tokens.some(t => norm(t) === bTok))?.idx;
    if (a == null || b == null) continue;
    let cur = a;
    for (let i = 0; i < 7; i++) {
      days.add(cur);
      if (cur === b) break;
      cur = (cur + 1) % 7;
    }
  }

  // Single day tokens
  for (const d of DAY_ALIASES) {
    for (const tok of d.tokens) {
      if (!tok) continue;
      if (s.includes(norm(tok))) {
        days.add(d.idx);
        break;
      }
    }
  }

  const hasAny = days.size > 0 || irregular;
  return { days, irregular, hasAny };
}

function parseHoursSchedule(input: string): { byDay: Map<number, Array<[number, number]>>; hasAny: boolean } {
  const s = norm(input);
  const byDay = new Map<number, Array<[number, number]>>();
  if (!s) return { byDay, hasAny: false };

  // 24h patterns
  if (/(24\s*h|24時間|24hour)/i.test(s)) {
    for (let i = 0; i < 7; i++) byDay.set(i, [[0, 24 * 60]]);
    return { byDay, hasAny: true };
  }

  // If input contains explicit weekday tokens, try per-day parsing.
  const hasWeekday = DAY_ALIASES.some(d => d.tokens.some(tok => tok && s.includes(norm(tok))));

  if (hasWeekday) {
    // Split chunks by ; or newline — each chunk might start with a weekday / range.
    const chunks = s.split(/\s*(?:;|；|\n)\s*/g).filter(Boolean);
    for (const chunk of chunks) {
      // Identify all weekday tokens in the chunk, then parse intervals from the rest.
      const days: number[] = [];

      // Range first
      const range = chunk.match(/(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s*(?:-|〜|~)\s*(日|月|火|水|木|金|土|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)/i);
      if (range) {
        const aTok = norm(range[1]);
        const bTok = norm(range[2]);
        const a = DAY_ALIASES.find(d => d.tokens.some(t => norm(t) === aTok))?.idx;
        const b = DAY_ALIASES.find(d => d.tokens.some(t => norm(t) === bTok))?.idx;
        if (a != null && b != null) {
          let cur = a;
          for (let i = 0; i < 7; i++) {
            days.push(cur);
            if (cur === b) break;
            cur = (cur + 1) % 7;
          }
        }
      }

      if (!days.length) {
        for (const d of DAY_ALIASES) {
          if (d.tokens.some(tok => tok && chunk.includes(norm(tok)))) {
            days.push(d.idx);
          }
        }
      }

      const intervals = parseIntervals(chunk);
      if (!intervals.length) continue;
      for (const di of (days.length ? days : [0,1,2,3,4,5,6])) {
        const cur = byDay.get(di) ?? [];
        cur.push(...intervals);
        byDay.set(di, cur);
      }
    }

    if (byDay.size) return { byDay, hasAny: true };
  }

  // Fallback: treat as "everyday" hours.
  const intervals = parseIntervals(s);
  if (!intervals.length) return { byDay, hasAny: false };
  for (let i = 0; i < 7; i++) byDay.set(i, intervals);
  return { byDay, hasAny: true };
}

function isNowInIntervals(nowMin: number, intervals: Array<[number, number]>): boolean {
  for (const [a, b] of intervals) {
    if (a === b) continue;
    if (a < b) {
      if (nowMin >= a && nowMin < b) return true;
    } else {
      // Overnight, e.g. 22:00-02:00
      if (nowMin >= a || nowMin < b) return true;
    }
  }
  return false;
}

export function getOpenStatus(poi: Pick<Poi, "hours" | "closed">, now = new Date()): OpenStatus {
  const hours = String((poi as any).hours ?? "").trim();
  const closed = String((poi as any).closed ?? "").trim();

  const hoursParsed = parseHoursSchedule(hours);
  const closedParsed = parseClosedDays(closed);

  // If neither exists, nothing to show.
  if (!hoursParsed.hasAny && !closedParsed.hasAny) return "unknown";

  const day = now.getDay();
  if (closedParsed.days.has(day)) return "closed";
  if (closedParsed.irregular && !hoursParsed.hasAny) return "unknown";

  if (!hoursParsed.hasAny) return "unknown";

  const intervals = hoursParsed.byDay.get(day) ?? [];
  if (!intervals.length) return "closed";
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return isNowInIntervals(nowMin, intervals) ? "open" : "closed";
}

export function hasBusinessInfo(poi: Pick<Poi, "hours" | "closed">): boolean {
  return !!String((poi as any).hours ?? "").trim() || !!String((poi as any).closed ?? "").trim();
}
