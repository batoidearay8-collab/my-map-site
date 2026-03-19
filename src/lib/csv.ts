import Papa from "papaparse";
import { PoiSchema, CategorySchema, type Poi, type Category } from "./schema";

export function parseCsvToObjects(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });
  if (res.errors?.length) {
    const e = res.errors[0];
    throw new Error(`CSV parse error: ${e.message} (row ${e.row})`);
  }
  return res.data as any;
}

function collectI18nFields(row: Record<string, any>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`^${prefix}_(.+)$`);
  for (const k of Object.keys(row)) {
    const m = k.match(re);
    if (!m) continue;
    const lang = String(m[1] ?? "").trim();
    if (!lang) continue;
    const v = String((row as any)[k] ?? "").trim();
    if (v) out[lang] = v;
  }
  return out;
}

function pickFirst(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    if (k in row) {
      const v = String((row as any)[k] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

/**
 * POI CSV columns:
 * - required: id, name
 * - optional: description, category, image, url
 * - outdoor: lat, lng
 * - indoor: x, y (0..1)
 * - i18n: name_<lang>, description_<lang> (or desc_<lang>)
 */
export function parsePoisFromCsv(text: string): Poi[] {
  const rows = parseCsvToObjects(text);
  const out: Poi[] = [];
  for (const r of rows) {
    const p: any = {
      id: String(r.id ?? "").trim(),
      name: String(r.name ?? "").trim(),
      description: String(r.description ?? "").trim(),
      category: String(r.category ?? "").trim(),
      image: String(r.image ?? "").trim(),
      url: String(r.url ?? "").trim(),

      // Optional business hours / holidays (supports several column names)
      hours: pickFirst(r, ["hours", "businessHours", "business_hours", "営業時間", "営業", "open_hours", "openHours"]),
      closed: pickFirst(r, ["closed", "holidays", "holiday", "closedDays", "closed_days", "休業日", "定休日", "休み"]),

      nameI18n: collectI18nFields(r, "name"),
      descriptionI18n: { ...collectI18nFields(r, "description"), ...collectI18nFields(r, "desc") },

      // Multi-floor indoor support
      floor: pickFirst(r, ["floor", "Floor", "フロア", "階"]),
    };

    const lat = Number((r as any).lat);
    const lng = Number((r as any).lng);
    const x = Number((r as any).x);
    const y = Number((r as any).y);

    if (Number.isFinite(lat) && Number.isFinite(lng)) { p.lat = lat; p.lng = lng; }
    if (Number.isFinite(x) && Number.isFinite(y)) { p.x = x; p.y = y; }

    const parsed = PoiSchema.safeParse(p);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Category CSV columns:
 * - required: category
 * - optional: icon, order, label
 * - i18n label: label_<lang>
 */
export function parseCategoriesFromCsv(text: string): Category[] {
  const rows = parseCsvToObjects(text);
  const out: Category[] = [];
  for (const r of rows) {
    const c: any = {
      category: String(r.category ?? "").trim(),
      icon: String(r.icon ?? "").trim(),
      order: (r as any).order !== undefined && (r as any).order !== "" ? Number((r as any).order) : undefined,
      label: String((r as any).label ?? "").trim(),
      labelI18n: collectI18nFields(r, "label"),

      // Marker customization (optional)
      markerType: String((r as any).markerType ?? "").trim() || undefined,
      markerColor: String((r as any).markerColor ?? "").trim() || undefined
    };
    const parsed = CategorySchema.safeParse(c);
    if (parsed.success) out.push(parsed.data);
  }
  return out.sort((a,b) => (a.order ?? 999) - (b.order ?? 999));
}

export function examplePoisCsv(): string {
  return [
    "id,name,description,name_en,description_en,category,image,lat,lng,x,y,url,hours,closed",
    "1,本部,案内・落とし物,Info desk,Info / Lost & found,展示,,35.681236,139.767125,0.52,0.18,,09:00-17:00,",
    "2,ステージA,午前はダンス,Stage A,Morning: dance,ステージ,,35.680500,139.766700,0.68,0.62,,10:00-16:00,火",
    "3,トイレ,混雑しやすい,Toilet,Often crowded,トイレ,,,,0.12,0.40,,,"
  ].join("\n");
}

export function exampleCategoriesCsv(): string {
  return [
    "category,label,label_en,icon,order,markerType,markerColor",
    "食べ物,食べ物,Food,🍔,1,badge,#ff6b6b",
    "展示,展示,Exhibits,🎨,2,pin,#6ea8fe",
    "ステージ,ステージ,Stage,🎤,3,flag,#f0ad4e",
    "トイレ,トイレ,Toilet,🚻,4,square,#5cb85c",
    "休憩,休憩,Rest,🪑,5,ring,#20c997",
    "案内,案内,Info,ℹ️,6,hex,#6f42c1"
  ].join("\n");
}
