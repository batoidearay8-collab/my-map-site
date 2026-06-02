/**
 * Resolve a URL under Vite's base path.
 *
 * Why: On GitHub Pages (or any sub-path deployment), absolute URLs like
 * "/data/config.json" break. This helper keeps the existing data format
 * (often starting with "/") while making fetch/image URLs work everywhere.
 *
 * Security: data: URLs are restricted to safe image MIME types to prevent
 * XSS via SVG with embedded scripts. (BUG #7 fix)
 */

const SAFE_DATA_PREFIX = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i;

export function publicUrl(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return raw;

  // BUG #7 fix: only allow specific raster image data: URLs.
  // SVG data: URLs can contain <script> and trigger XSS.
  // text/html data: URLs are obvious attack vectors.
  if (raw.startsWith("data:")) {
    if (SAFE_DATA_PREFIX.test(raw)) return raw;
    return ""; // unsafe data: URL — reject
  }

  // Keep full URLs as-is.
  if (/^(https?:)?\/\//i.test(raw)) return raw;

  // Already relative (e.g. "./images/x.png")
  if (raw.startsWith("./") || raw.startsWith("../")) return raw;

  const base = (import.meta as any).env?.BASE_URL ?? "/";

  // Normalize: remove leading slash so we can safely join with BASE_URL.
  const p = raw.startsWith("/") ? raw.slice(1) : raw;
  const b = base.endsWith("/") ? base : base + "/";
  return b + p;
}
