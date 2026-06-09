/**
 * Research log collection — anonymous, opt-in, GDPR-friendly.
 *
 * What is collected (all anonymous):
 *  - Session start / end timestamps
 *  - POI views (id only, no personal data)
 *  - Search queries
 *  - Floor switches
 *  - Category filter changes
 *  - Route requests (POI ids only)
 *
 * What is NOT collected:
 *  - IP addresses (we don't see them client-side)
 *  - Device fingerprints
 *  - Personal identifiers
 *
 * Storage:
 *  - All events kept in localStorage under a research-specific key
 *  - Optionally posted to an external endpoint (e.g. Google Forms entry URL)
 *  - Can be exported as CSV manually for analysis
 *
 * Consent:
 *  - User must explicitly opt in via ConsentDialog component
 *  - Consent state stored in localStorage; can be revoked
 *  - If revoked, all stored logs are deleted
 */

const STORAGE_LOG_KEY = "atlaskobo_research_log_v1";
const STORAGE_CONSENT_KEY = "atlaskobo_research_consent_v1";
const STORAGE_SESSION_KEY = "atlaskobo_research_session_v1";

export type ConsentState =
  | { decided: false }
  | { decided: true; consented: boolean; timestamp: number; sessionId: string };

export type LogEvent = {
  type: "session_start" | "session_end" | "poi_view" | "search" | "floor_change" | "category_filter" | "route_request" | "survey_open";
  ts: number;
  /** Anonymous, randomly-generated session id (UUID-ish) */
  sessionId: string;
  /** Event-specific payload */
  data?: Record<string, string | number | boolean | null>;
};

// ─────────────────────────────────────────────
// Consent management
// ─────────────────────────────────────────────

export function getConsentState(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_CONSENT_KEY);
    if (!raw) return { decided: false };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.consented !== "boolean") return { decided: false };
    return {
      decided: true,
      consented: parsed.consented,
      timestamp: parsed.timestamp || Date.now(),
      sessionId: parsed.sessionId || generateSessionId(),
    };
  } catch {
    return { decided: false };
  }
}

export function setConsent(consented: boolean): ConsentState {
  const state: ConsentState = {
    decided: true,
    consented,
    timestamp: Date.now(),
    sessionId: generateSessionId(),
  };
  try {
    localStorage.setItem(STORAGE_CONSENT_KEY, JSON.stringify({
      consented: state.consented,
      timestamp: state.timestamp,
      sessionId: state.sessionId,
    }));
    if (!consented) {
      // Revoking consent: delete all logs
      clearLogs();
    } else {
      // Just consented: log a session_start
      logEvent("session_start", { ua: navigator.userAgent.slice(0, 80) });
    }
  } catch {}
  return state;
}

// ─────────────────────────────────────────────
// Session ID
// ─────────────────────────────────────────────

function generateSessionId(): string {
  // Random 16-char hex (no PII)
  const arr = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────
// Event logging
// ─────────────────────────────────────────────

export function logEvent(
  type: LogEvent["type"],
  data?: Record<string, string | number | boolean | null>
): void {
  const consent = getConsentState();
  if (!consent.decided || !consent.consented) return;

  const evt: LogEvent = {
    type,
    ts: Date.now(),
    sessionId: consent.sessionId,
    data,
  };

  try {
    const existing = loadLogs();
    existing.push(evt);
    // Cap at 5000 events per session to avoid unbounded localStorage growth
    const trimmed = existing.length > 5000 ? existing.slice(-5000) : existing;
    localStorage.setItem(STORAGE_LOG_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function loadLogs(): LogEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(STORAGE_LOG_KEY);
  } catch {}
}

// ─────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────

export function logsToCsv(events: LogEvent[]): string {
  const header = "timestamp,iso_time,session_id,type,data";
  const rows = events.map(e => {
    const iso = new Date(e.ts).toISOString();
    const dataStr = e.data ? JSON.stringify(e.data).replace(/"/g, '""') : "";
    // Prevent CSV injection
    const safeData = /^[=+\-@]/.test(dataStr) ? "'" + dataStr : dataStr;
    return `${e.ts},${iso},${e.sessionId},${e.type},"${safeData}"`;
  });
  return [header, ...rows].join("\n");
}

// ─────────────────────────────────────────────
// Optional: post to external endpoint (e.g. Google Forms)
// ─────────────────────────────────────────────

/**
 * Send logs to an external endpoint (best-effort, doesn't block UI).
 *
 * For Google Forms, use the formResponse URL with `usp=pp_url` field naming.
 * Example endpoint format:
 *   https://docs.google.com/forms/d/e/FORM_ID/formResponse?entry.123=$EVENTS_JSON
 *
 * Since Google Forms requires per-field entries, this helper just POSTs as JSON
 * to a custom webhook by default. If using a Forms-style endpoint, the implementer
 * should add field mapping in the config.
 */
export async function flushLogsToEndpoint(endpoint: string): Promise<boolean> {
  if (!endpoint) return false;
  const events = loadLogs();
  if (events.length === 0) return true;

  try {
    // Use no-cors mode so Google Forms / similar webhooks accept the request
    // even without CORS headers. Note: response is opaque, can't tell if it succeeded.
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events, ts: Date.now() }),
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Send-on-unload: try to send logs when user closes the tab
// ─────────────────────────────────────────────

export function installUnloadFlusher(endpoint: string): () => void {
  if (!endpoint) return () => {};

  const onUnload = () => {
    const events = loadLogs();
    if (events.length === 0) return;
    try {
      // Log session_end before flushing
      logEvent("session_end");

      // sendBeacon is the proper API for fire-and-forget on unload
      const payload = JSON.stringify({ events: loadLogs(), ts: Date.now() });
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, blob);
      }
    } catch {}
  };

  window.addEventListener("pagehide", onUnload);
  return () => window.removeEventListener("pagehide", onUnload);
}
