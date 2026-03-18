import { z } from "zod";

/**
 * Content i18n strategy:
 * - Keep legacy fields (title/subtitle, poi.name/description, category.category) as the default language text.
 * - Optional *I18n maps can override per language code (e.g. "en", "ja", "zh-Hans").
 * - UI language is handled separately (src/lib/i18n.ts).
 */

export const ConfigSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(""),
  template: z.enum(["event", "tourism", "learning"]),
  mode: z.enum(["outdoor", "indoor"]),

  /** Optional translated titles/subtitles for content language. */
  titleI18n: z.record(z.string()).optional().default({}),
  subtitleI18n: z.record(z.string()).optional().default({}),

  /** Optional default/supported content languages. */
  i18n: z.object({
    defaultLang: z.string().default("ja"),
    supportedLangs: z.array(z.string()).default(["ja", "en"])
  }).optional().default({ defaultLang: "ja", supportedLangs: ["ja", "en"] }),
  ui: z.object({
    tabTitle: z.string().default("AtlasKobo — 地図サイト制作キット"),
  }).optional().default({ tabTitle: "AtlasKobo — 地図サイト制作キット" }),


  /** Preferred theme for the published site (viewer can still override). */
  theme: z.enum(["dark", "light", "system"]).optional().default("dark"),

  privacy: z.object({
    stripImageMetadata: z.boolean().default(true),
    roundOutdoorLatLngDecimals: z.number().int().min(0).max(7).default(5),
    hideExactOutdoorLocationByDefault: z.boolean().default(true)
  }),

  outdoor: z.object({
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().int().min(1).max(20)
  }),

  indoor: z.object({
    imageUrl: z.string(),          // e.g. "/assets/floor.png"
    imageWidthPx: z.number().int().positive(),
    imageHeightPx: z.number().int().positive(),
    minZoom: z.number().int().optional(),
    maxZoom: z.number().int().optional()
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// POI supports outdoor (lat,lng) OR indoor (x,y normalized)
export const PoiSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  category: z.string().default(""),
  image: z.string().default(""),    // e.g. "/images/xxx.jpg"
  url: z.string().default(""),

  /** Optional business hours / holidays (mainly for outdoor maps). */
  hours: z.string().optional().default(""),
  closed: z.string().optional().default(""),

  /** Optional translated POI texts. */
  nameI18n: z.record(z.string()).optional().default({}),
  descriptionI18n: z.record(z.string()).optional().default({}),

  lat: z.number().optional(),
  lng: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional()
});

export type Poi = z.infer<typeof PoiSchema>;

export const CategorySchema = z.object({
  /** Stable key (used for filtering). */
  category: z.string().min(1),
  icon: z.string().default(""),
  order: z.number().optional(),

  /** Optional display label (defaults to category when empty). */
  label: z.string().optional().default(""),
  /** Optional translated labels. */
  labelI18n: z.record(z.string()).optional().default({}),

  /**
   * Marker appearance (optional):
   * - markerType: pin | dot | badge | ring | square | hex | flag
   * - markerColor: any CSS color (e.g. "#2b6df6", "tomato")
   *
   * You can set these in categories.csv as `markerType,markerColor`.
   */
  markerType: z.enum(["pin", "dot", "badge", "ring", "square", "hex", "flag"]).optional().default("pin"),
  markerColor: z.string().optional().default("")
});

export type Category = z.infer<typeof CategorySchema>;
