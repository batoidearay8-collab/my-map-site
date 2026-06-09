/**
 * Builder data persistence — auto-saves work in progress to localStorage.
 *
 * Why: Without this, accidentally closing the tab or refreshing loses
 * everything the user has built (could be 30+ minutes of work).
 *
 * What gets saved:
 *   - builderConfig
 *   - builderPois
 *   - builderCategories
 *   - poisCsv / catsCsv (user's CSV edits if any)
 *   - publishTheme
 *
 * What does NOT get saved (intentionally):
 *   - builderAssets (File objects — too large for localStorage,
 *     would need IndexedDB. User will need to re-upload images
 *     after a session restore. We surface a clear notice when this happens.)
 *   - builderUndo (transient)
 *
 * Quota: localStorage is typically 5-10MB. Config+POIs+Categories as JSON
 * is usually well under 1MB even for large maps.
 */

import type { AppConfig, Poi, Category } from "./schema";

const STORAGE_KEY = "atlaskobo_builder_v1";
const STORAGE_TIMESTAMP_KEY = "atlaskobo_builder_v1_ts";

// Throttle writes so rapid edits don't hammer localStorage.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 800;

export type PersistedBuilderState = {
  builderConfig: AppConfig | null;
  builderPois: Poi[];
  builderCategories: Category[];
  poisCsv?: string;
  catsCsv?: string;
  publishTheme?: string;
  /** Whether assets (uploaded images / floor plans) existed when saved.
   *  Used to show "please re-upload images" notice on restore. */
  hadAssets?: boolean;
};

export function scheduleBuilderSave(state: PersistedBuilderState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveBuilderNow(state);
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export function saveBuilderNow(state: PersistedBuilderState): void {
  try {
    if (!state.builderConfig) {
      // Don't save empty state (would overwrite a real save with nothing).
      return;
    }
    const payload = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, payload);
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(Date.now()));
  } catch (err) {
    // Quota exceeded, private browsing, etc. — fail silently.
    // eslint-disable-next-line no-console
    console.warn("[AtlasKobo] Could not save builder state:", err);
  }
}

export function loadBuilderState(): PersistedBuilderState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedBuilderState;
  } catch {
    return null;
  }
}

export function getBuilderSaveTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearBuilderState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch {}
}
