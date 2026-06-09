/**
 * Master mode — researcher-only access control.
 *
 * Purpose:
 *   The builder is operated by high school students who create the festival map,
 *   but research data (collection endpoint URLs, raw collected logs, exports)
 *   should only be accessible to the researcher (the supervisor of the study).
 *
 * Mechanism:
 *   - A master password is required to "unlock" researcher features.
 *   - The unlock state is kept in sessionStorage (clears when tab closes).
 *   - Sensitive values (logEndpoint URL) are stored in obfuscated form
 *     in the config and only revealed when master mode is unlocked.
 *
 * Security caveat:
 *   This is a CLIENT-SIDE protection. A determined user with browser DevTools
 *   could bypass it. The intent is to prevent ACCIDENTAL discovery by
 *   non-technical students, not to provide cryptographic security.
 *   For true secrecy, use a server-side endpoint with proper auth.
 */

const MASTER_UNLOCK_KEY = "atlaskobo_master_unlocked_v1";
const MASTER_HASH_KEY = "atlaskobo_master_hash_v1";

/** SHA-256 hex of the master password. Changed via setMasterPassword(). */
async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────
// Master password setup & verification
// ─────────────────────────────────────────────

/** Returns true if a master password has been set on this device. */
export function hasMasterPassword(): boolean {
  try {
    return !!localStorage.getItem(MASTER_HASH_KEY);
  } catch {
    return false;
  }
}

/** Set (or change) the master password. Stores only the hash. */
export async function setMasterPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 4) {
    throw new Error("パスワードは4文字以上にしてください");
  }
  const hash = await sha256Hex(newPassword);
  try {
    localStorage.setItem(MASTER_HASH_KEY, hash);
  } catch (err) {
    throw new Error("パスワードの保存に失敗しました: " + err);
  }
}

/** Remove the master password (resets to "no password set" state). */
export function clearMasterPassword(): void {
  try {
    localStorage.removeItem(MASTER_HASH_KEY);
    sessionStorage.removeItem(MASTER_UNLOCK_KEY);
  } catch {}
}

/** Check if the supplied password matches the stored hash. */
export async function verifyMasterPassword(password: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(MASTER_HASH_KEY);
    if (!stored) return false;
    const hash = await sha256Hex(password);
    return hash === stored;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Unlock state (session-scoped)
// ─────────────────────────────────────────────

/** True if master mode is currently unlocked in this tab. */
export function isMasterUnlocked(): boolean {
  try {
    return sessionStorage.getItem(MASTER_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Unlock master mode. Verifies password first. Returns success. */
export async function unlockMaster(password: string): Promise<boolean> {
  const ok = await verifyMasterPassword(password);
  if (!ok) return false;
  try {
    sessionStorage.setItem(MASTER_UNLOCK_KEY, "1");
  } catch {}
  return true;
}

/** Lock master mode (e.g. when user clicks "lock"). */
export function lockMaster(): void {
  try {
    sessionStorage.removeItem(MASTER_UNLOCK_KEY);
  } catch {}
}

// ─────────────────────────────────────────────
// Endpoint URL obfuscation
// ─────────────────────────────────────────────
// We store the logEndpoint XOR-obfuscated with a fixed key in the config.
// This prevents casual snooping (View Source) but is NOT cryptographically
// secure. A determined user with DevTools can decode it.
//
// Format in config: "ENC:<base64-of-xor-output>"
//                   (so it's distinguishable from a raw URL)

const OBFUSCATION_KEY = "AtlasKoboMasterMode_v1_obfuscation_key_2025";

function xorString(input: string, key: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function toBase64(s: string): string {
  // Handle UTF-8 properly
  return btoa(unescape(encodeURIComponent(s)));
}

function fromBase64(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return "";
  }
}

/** Encode a sensitive endpoint URL for storage in the public config. */
export function encodeEndpoint(url: string): string {
  if (!url) return "";
  if (url.startsWith("ENC:")) return url; // already encoded
  const xored = xorString(url, OBFUSCATION_KEY);
  return "ENC:" + toBase64(xored);
}

/** Decode a stored endpoint URL. Returns "" if not encoded or invalid. */
export function decodeEndpoint(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith("ENC:")) return stored; // legacy / not encoded
  const b64 = stored.slice(4);
  const xored = fromBase64(b64);
  if (!xored) return "";
  return xorString(xored, OBFUSCATION_KEY);
}

/** True if a config field looks like an obfuscated value. */
export function isEncodedValue(s: string): boolean {
  return typeof s === "string" && s.startsWith("ENC:");
}

/** Returns "******..." style placeholder for hiding a value in UI. */
export function maskedValue(value: string, visibleChars = 0): string {
  if (!value) return "";
  if (visibleChars >= value.length) return value;
  const stars = "•".repeat(Math.min(value.length, 12));
  if (visibleChars === 0) return stars;
  return value.slice(0, visibleChars) + stars;
}
