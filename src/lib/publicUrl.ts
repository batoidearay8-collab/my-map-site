/**
 * Resolve a URL under Vite's base path.
 *
 * Why: On GitHub Pages (or any sub-path deployment), absolute URLs like
 * "/data/config.json" break. This helper keeps the existing data format
 * (often starting with "/") while making fetch/image URLs work everywhere.
 */

export function publicUrl(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return raw;

  // Keep full URLs / data URLs as-is.
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;

  // Already relative (e.g. "./images/x.png")
  if (raw.startsWith("./") || raw.startsWith("../")) return raw;

  const base = (import.meta as any).env?.BASE_URL ?? "/";

  // Normalize: remove leading slash so we can safely join with BASE_URL.
  const p = raw.startsWith("/") ? raw.slice(1) : raw;
  const b = base.endsWith("/") ? base : base + "/";
  return b + p;
}
