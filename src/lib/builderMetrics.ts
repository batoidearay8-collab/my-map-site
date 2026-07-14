/**
 * Builder metrics — RESEARCH MODE work-time measurement for the BUILDER.
 *
 * Purpose: collect the data needed for the graduation research questions:
 *   RQ1  map-creation time (active work time, per builder step)
 *   RQ2  usability signals (undo counts, error toasts, etc.)
 *
 * Privacy design (must hold even though the app is publicly deployed):
 *   - Completely OFF by default. Activated only via the URL parameter
 *     `#/builder?research=1` followed by an explicit consent dialog.
 *   - All data stays in localStorage on the participant's machine.
 *     There is NO network transmission anywhere in this module.
 *   - Data leaves the machine only when the participant presses the
 *     export button and hands the downloaded file to the researcher.
 *   - The participant can end measurement and erase all data at any time.
 *   - Participant IDs are anonymous codes (e.g. P01), never names.
 *
 * Active time definition:
 *   Time is attributed to the CURRENT CONTEXT (builder step or floor editor)
 *   only while the participant is actually interacting. Gaps between input
 *   events longer than IDLE_MS (60 s) are treated as idle (breaks, being
 *   away) and are NOT counted. This keeps the 2026 measurement comparable
 *   and defensible against "wall-clock time includes breaks" criticism.
 *
 * This module is intentionally separate from src/lib/researchLog.ts
 * (the dormant VIEWER-side log). Different audience, different lifecycle.
 */

const STORAGE_KEY = "atlaskobo_builder_metrics_v1";

/** Input gaps longer than this are treated as idle and not counted. */
export const IDLE_MS = 60_000;
/** Throttle for persisting activity time to localStorage. */
const PERSIST_EVERY_MS = 5_000;
/** Cap sessions kept, just in case (a school PC shared over weeks). */
const MAX_SESSIONS = 200;

export type SessionRecord = {
  id: string;
  startTs: number;
  endTs: number;
  /** Active milliseconds attributed per context ("step1".."step4", "step0", "floorEditor"). */
  activeMsByContext: Record<string, number>;
  /** Behavioural counters ("undo_builder", "undo_floor", "toast_error", ...). */
  counters: Record<string, number>;
};

export type MetricsData = {
  version: 1;
  participantId: string;
  consentTs: number;
  sessions: SessionRecord[];
};

// ─────────────────────────────────────────────
// Pure helpers (unit-tested)
// ─────────────────────────────────────────────

/**
 * How much active time a new input event at `nowTs` adds, given the previous
 * input at `prevTs`. Gaps longer than idleMs contribute nothing.
 */
export function activeDelta(prevTs: number, nowTs: number, idleMs: number = IDLE_MS): number {
  const gap = nowTs - prevTs;
  if (gap <= 0) return 0;
  return gap <= idleMs ? gap : 0;
}

/** Format milliseconds as h:mm:ss (or m:ss below an hour). */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Total active ms across all sessions and contexts. */
export function totalActiveMs(data: MetricsData): number {
  let sum = 0;
  for (const s of data.sessions) {
    for (const v of Object.values(s.activeMsByContext)) sum += v;
  }
  return sum;
}

/**
 * Long-format CSV, easy to analyse in R / Excel:
 *   participant,session_id,start_iso,end_iso,kind,key,value
 *   P01,ab12...,2026-07-09T...,...,active_seconds,step2,754
 *   P01,ab12...,2026-07-09T...,...,counter,undo_builder,3
 */
export function metricsToCsv(data: MetricsData): string {
  const header = "participant,session_id,start_iso,end_iso,kind,key,value";
  const esc = (v: string) => {
    // Escape CSV + guard against formula injection when opened in Excel.
    let s = v.replace(/"/g, '""');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows: string[] = [];
  for (const s of data.sessions) {
    const base = [esc(data.participantId), s.id, new Date(s.startTs).toISOString(), new Date(s.endTs).toISOString()];
    for (const [ctx, ms] of Object.entries(s.activeMsByContext)) {
      rows.push([...base, "active_seconds", esc(ctx), String(Math.round(ms / 1000))].join(","));
    }
    for (const [key, n] of Object.entries(s.counters)) {
      rows.push([...base, "counter", esc(key), String(n)].join(","));
    }
  }
  return [header, ...rows].join("\n");
}

// ─────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────

function loadData(): MetricsData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed?.participantId !== "string" || !Array.isArray(parsed?.sessions)) return null;
    return parsed as MetricsData;
  } catch {
    return null;
  }
}

function saveData(data: MetricsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ─────────────────────────────────────────────
// Runtime state (module singleton)
// ─────────────────────────────────────────────

let data: MetricsData | null = null;      // null = metrics OFF (default)
let session: SessionRecord | null = null; // current browser session
let context = "step1";                    // current builder step / floor editor
let lastInputTs = 0;
let unsavedMs = 0;                        // active ms not yet persisted
let lastPersistTs = 0;

function newSession(): SessionRecord {
  const arr = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  const id = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  return { id, startTs: now, endTs: now, activeMsByContext: {}, counters: {} };
}

function persist(force = false): void {
  if (!data || !session) return;
  const now = Date.now();
  if (!force && now - lastPersistTs < PERSIST_EVERY_MS) return;
  session.endTs = now;
  saveData(data);
  lastPersistTs = now;
  unsavedMs = 0;
}

// ─────────────────────────────────────────────
// Public API (every function no-ops instantly when metrics are OFF)
// ─────────────────────────────────────────────

/** Whether research measurement is currently active (consented + running). */
export function isMetricsEnabled(): boolean {
  return data !== null;
}

/** Read-only snapshot for UI / export (null when OFF). */
export function getMetricsData(): MetricsData | null {
  if (data && session) session.endTs = Date.now();
  return data;
}

/** Participant id when active, otherwise "". */
export function getParticipantId(): string {
  return data?.participantId ?? "";
}

/**
 * Resume a previous consent on page load (no dialog needed again).
 * Starts a NEW session record. Returns true if metrics are now running.
 */
export function resumeMetricsIfConsented(): boolean {
  if (data) return true;
  const stored = loadData();
  if (!stored) return false;
  data = stored;
  session = newSession();
  data.sessions.push(session);
  if (data.sessions.length > MAX_SESSIONS) data.sessions = data.sessions.slice(-MAX_SESSIONS);
  lastInputTs = Date.now();
  persist(true);
  return true;
}

/** Start metrics after explicit consent, with an anonymous participant id. */
export function startMetrics(participantId: string): void {
  const pid = participantId.trim() || "P??";
  data = loadData() ?? { version: 1, participantId: pid, consentTs: Date.now(), sessions: [] };
  data.participantId = pid;
  session = newSession();
  data.sessions.push(session);
  lastInputTs = Date.now();
  persist(true);
}

/** End measurement and ERASE all stored metrics (participant's right to quit). */
export function stopMetricsAndErase(): void {
  data = null;
  session = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Tell the metrics which builder step / editor the participant is in. */
export function metricsSetContext(ctx: string): void {
  if (!data) return;
  if (ctx !== context) {
    context = ctx;
    persist(true);
  }
}

/** Increment a behavioural counter (undo, error toast, ...). */
export function metricsCount(key: string): void {
  if (!data || !session) return;
  session.counters[key] = (session.counters[key] ?? 0) + 1;
  persist(true);
}

/** Called from global input listeners; attributes active time to the context. */
function onActivity(): void {
  if (!data || !session) return;
  const now = Date.now();
  const delta = activeDelta(lastInputTs, now);
  lastInputTs = now;
  if (delta > 0) {
    session.activeMsByContext[context] = (session.activeMsByContext[context] ?? 0) + delta;
    unsavedMs += delta;
    if (unsavedMs > 0) persist(false);
  }
}

/**
 * Install global input listeners (pointer / key / wheel) + persistence on
 * tab hide. Returns an uninstaller. Safe to call when metrics are OFF —
 * the handlers no-op immediately.
 */
export function installMetricsListeners(): () => void {
  const onInput = () => onActivity();
  const onHide = () => persist(true);
  window.addEventListener("pointerdown", onInput, { passive: true });
  window.addEventListener("keydown", onInput, { passive: true });
  window.addEventListener("wheel", onInput, { passive: true });
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onHide);
  return () => {
    window.removeEventListener("pointerdown", onInput);
    window.removeEventListener("keydown", onInput);
    window.removeEventListener("wheel", onInput);
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onHide);
  };
}

/** Live active-time total (ms) for the status widget. */
export function currentTotalActiveMs(): number {
  return data ? totalActiveMs(data) : 0;
}
