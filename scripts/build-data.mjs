import fs from "node:fs/promises";
import path from "node:path";

function parseCsv(text) {
  // Minimal CSV parser (header + commas, supports quoted cells)
  const rows = [];
  let cur = "";
  let inQ = false;
  const lines = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "\n" && !inQ) {
      lines.push(cur); cur = "";
    } else if (ch === "\r") {
      // ignore
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length) lines.push(cur);

  const splitLine = (line) => {
    const out = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i+1] === '"') { cell += '"'; i++; }
        else q = !q;
      } else if (ch === "," && !q) {
        out.push(cell); cell = "";
      } else {
        cell += ch;
      }
    }
    out.push(cell);
    return out.map(s => s.trim());
  };

  const header = splitLine(lines.shift() ?? "");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitLine(line);
    const obj = {};
    header.forEach((h, idx) => obj[h] = cells[idx] ?? "");
    rows.push(obj);
  }
  return rows;
}

function collectI18n(row, prefix) {
  const out = {};
  const re = new RegExp(`^${prefix}_(.+)$`);
  for (const k of Object.keys(row)) {
    const m = k.match(re);
    if (!m) continue;
    const lang = String(m[1] ?? "").trim();
    if (!lang) continue;
    const v = String(row[k] ?? "").trim();
    if (v) out[lang] = v;
  }
  return out;
}

const root = process.cwd();
const dataDir = path.join(root, "data");
const outDir = path.join(root, "public", "data");
await fs.mkdir(outDir, { recursive: true });

const [poisCsv, catsCsv, configJson] = await Promise.all([
  fs.readFile(path.join(dataDir, "pois.csv"), "utf-8"),
  fs.readFile(path.join(dataDir, "categories.csv"), "utf-8"),
  fs.readFile(path.join(dataDir, "config.json"), "utf-8")
]);

const poisRows = parseCsv(poisCsv);
const catsRows = parseCsv(catsCsv);
const config = JSON.parse(configJson);

// Basic validation + normalization
const pois = [];
for (const r of poisRows) {
  const id = String(r.id ?? "").trim();
  if (!id) continue;

  const nameI18n = collectI18n(r, "name");
  const descI18n = { ...collectI18n(r, "description"), ...collectI18n(r, "desc") };

  const p = {
    id,
    name: String(r.name ?? "").trim(),
    description: String(r.description ?? "").trim(),
    category: String(r.category ?? "").trim(),
    image: String(r.image ?? "").trim(),
    url: String(r.url ?? "").trim(),
    ...(Object.keys(nameI18n).length ? { nameI18n } : {}),
    ...(Object.keys(descI18n).length ? { descriptionI18n: descI18n } : {})
  };

  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const x = Number(r.x);
  const y = Number(r.y);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    p.lat = lat; p.lng = lng;
  }
  if (Number.isFinite(x) && Number.isFinite(y)) {
    p.x = x; p.y = y;
  }
  pois.push(p);
}

const categories = catsRows
  .map(r => {
    const labelI18n = collectI18n(r, "label");
    const order = r.order !== undefined && r.order !== "" ? Number(r.order) : undefined;
    return {
      category: String(r.category ?? "").trim(),
      label: String(r.label ?? "").trim(),
      ...(Object.keys(labelI18n).length ? { labelI18n } : {}),
      icon: String(r.icon ?? "").trim(),
      order,

      // Marker customization (optional)
      ...(String(r.markerType ?? "").trim() ? { markerType: String(r.markerType).trim() } : {}),
      ...(String(r.markerColor ?? "").trim() ? { markerColor: String(r.markerColor).trim() } : {})
    };
  })
  .filter(c => c.category.length);

await Promise.all([
  fs.writeFile(path.join(outDir, "pois.json"), JSON.stringify(pois, null, 2), "utf-8"),
  fs.writeFile(path.join(outDir, "categories.json"), JSON.stringify(categories, null, 2), "utf-8"),
  fs.writeFile(path.join(outDir, "config.json"), JSON.stringify(config, null, 2), "utf-8")
]);

console.log("Generated public/data/*.json from data/*.csv + data/config.json");
