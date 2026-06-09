/**
 * Starter sample data for each purpose template.
 *
 * When a user picks a template, they can optionally load a small set of
 * sample categories + POIs so they start from a working example instead of
 * a blank canvas. This lowers the time-to-first-result and helps non-technical
 * users (e.g. high schoolers) understand the data structure by example.
 *
 * - Outdoor templates use lat/lng. Coordinates are placed around a neutral
 *   reference point and are meant to be dragged/edited by the user afterwards.
 * - Indoor templates (school_festival, disaster) use normalized x/y in [0,1]
 *   so the sample pins sit sensibly on top of any uploaded floor image.
 *
 * All text is provided in ja + en so it works regardless of default language.
 */
import type { Poi, Category } from "../../lib/schema";

export type SampleSet = {
  mode: "indoor" | "outdoor";
  categories: Category[];
  pois: Poi[];
};

/** Neutral outdoor reference point (central Tokyo). Users edit from here. */
const O_LAT = 35.681;
const O_LNG = 139.767;

function cat(
  category: string,
  ja: string,
  en: string,
  icon: string,
  order: number,
  markerColor: string
): Category {
  return {
    category,
    label: ja,
    labelI18n: { ja, en },
    icon,
    order,
    markerType: "pin",
    markerColor,
  };
}

function outdoorPoi(
  id: string,
  ja: string,
  en: string,
  category: string,
  dLat: number,
  dLng: number,
  descJa: string,
  descEn: string
): Poi {
  return {
    id,
    name: ja,
    nameI18n: { ja, en },
    description: descJa,
    descriptionI18n: { ja: descJa, en: descEn },
    category,
    lat: Math.round((O_LAT + dLat) * 1e6) / 1e6,
    lng: Math.round((O_LNG + dLng) * 1e6) / 1e6,
  };
}

function indoorPoi(
  id: string,
  ja: string,
  en: string,
  category: string,
  x: number,
  y: number,
  descJa: string,
  descEn: string
): Poi {
  return {
    id,
    name: ja,
    nameI18n: { ja, en },
    description: descJa,
    descriptionI18n: { ja: descJa, en: descEn },
    category,
    x,
    y,
  };
}

export const TEMPLATE_SAMPLES: Record<string, SampleSet> = {
  tourism: {
    mode: "outdoor",
    categories: [
      cat("sightseeing", "観光", "Sightseeing", "🏯", 1, "#e0533d"),
      cat("food", "飯屋", "Restaurant", "🍜", 2, "#e8a33d"),
      cat("station", "駅", "Station", "🚉", 3, "#2e6db4"),
      cat("souvenir", "お土産", "Souvenir", "🎁", 4, "#2e8b57"),
    ],
    pois: [
      outdoorPoi("1", "城跡公園", "Castle Park", "sightseeing", 0.004, 0.003, "見晴らしのよい人気スポット。", "A popular spot with a great view."),
      outdoorPoi("2", "名物ラーメン店", "Famous Ramen", "food", -0.002, 0.004, "行列のできる老舗ラーメン店。", "A long-established, popular ramen shop."),
      outdoorPoi("3", "中央駅", "Central Station", "station", 0.000, 0.000, "観光の起点となる駅。", "The main station and starting point."),
      outdoorPoi("4", "おみやげ横丁", "Souvenir Alley", "souvenir", 0.003, -0.003, "地元のお土産が揃う通り。", "A street full of local souvenirs."),
    ],
  },

  live: {
    mode: "outdoor",
    categories: [
      cat("venue", "会場", "Venue", "🎤", 1, "#9b59b6"),
      cat("hotel", "ホテル", "Hotel", "🏨", 2, "#2e6db4"),
      cat("food", "飯屋", "Restaurant", "🍜", 3, "#e8a33d"),
      cat("station", "駅", "Station", "🚉", 4, "#2e8b57"),
    ],
    pois: [
      outdoorPoi("1", "ライブ会場", "Concert Hall", "venue", 0.003, 0.002, "メイン会場。開場時間に注意。", "Main venue. Mind the doors-open time."),
      outdoorPoi("2", "駅前ホテル", "Station Hotel", "hotel", -0.001, -0.002, "会場まで徒歩圏内のホテル。", "Hotel within walking distance."),
      outdoorPoi("3", "中央駅", "Central Station", "station", 0.000, 0.000, "最寄り駅。", "Nearest station."),
      outdoorPoi("4", "深夜営業の食堂", "Late-night Diner", "food", 0.002, 0.003, "ライブ後でも入れるお店。", "Open late, good after the show."),
    ],
  },

  convenience: {
    mode: "outdoor",
    categories: [
      cat("store", "店", "Store", "🏪", 1, "#2e6db4"),
      cat("toilet", "トイレ", "Toilet", "🚻", 2, "#2e8b57"),
      cat("parking", "駐車場", "Parking", "🅿️", 3, "#6b7280"),
    ],
    pois: [
      outdoorPoi("1", "コンビニ", "Convenience Store", "store", 0.001, 0.001, "24時間営業。", "Open 24 hours."),
      outdoorPoi("2", "公衆トイレ", "Public Toilet", "toilet", -0.001, 0.002, "誰でも使えるトイレ。", "Public restroom."),
      outdoorPoi("3", "駐車場", "Parking Lot", "parking", 0.002, -0.001, "30台収容。", "Capacity: 30 cars."),
    ],
  },

  festival: {
    mode: "outdoor",
    categories: [
      cat("stage", "ステージ", "Stage", "🎆", 1, "#e0533d"),
      cat("stall", "屋台", "Food Stall", "🍢", 2, "#e8a33d"),
      cat("toilet", "トイレ", "Toilet", "🚻", 3, "#2e8b57"),
      cat("firstaid", "救護", "First Aid", "⛑️", 4, "#c0392b"),
    ],
    pois: [
      outdoorPoi("1", "メインステージ", "Main Stage", "stage", 0.002, 0.000, "出し物が行われる中心地。", "Center stage for performances."),
      outdoorPoi("2", "屋台通り", "Food Stalls", "stall", 0.001, 0.002, "食べ歩きが楽しめる通り。", "A street of food stalls."),
      outdoorPoi("3", "仮設トイレ", "Portable Toilet", "toilet", -0.001, 0.001, "数か所に設置。", "Set up at several spots."),
      outdoorPoi("4", "救護テント", "First-aid Tent", "firstaid", 0.000, -0.002, "体調不良時はこちらへ。", "Come here if you feel unwell."),
    ],
  },

  school_festival: {
    mode: "indoor",
    categories: [
      cat("exhibit", "展示", "Exhibit", "🖼️", 1, "#2e6db4"),
      cat("food", "食べ物", "Food", "🍡", 2, "#e8a33d"),
      cat("stage", "ステージ", "Stage", "🎭", 3, "#9b59b6"),
      cat("info", "案内", "Info", "ℹ️", 4, "#2e8b57"),
    ],
    pois: [
      indoorPoi("1", "受付・案内", "Reception", "info", 0.5, 0.9, "総合案内。パンフ配布中。", "General info & pamphlets."),
      indoorPoi("2", "1組 展示", "Class 1 Exhibit", "exhibit", 0.25, 0.55, "クラス展示の教室。", "Class exhibition room."),
      indoorPoi("3", "模擬店（焼きそば）", "Food Stall", "food", 0.7, 0.5, "人気の焼きそば。売り切れ注意。", "Popular yakisoba — may sell out."),
      indoorPoi("4", "体育館ステージ", "Gym Stage", "stage", 0.5, 0.2, "ライブや発表が行われる。", "Live shows and presentations."),
    ],
  },

  disaster: {
    mode: "indoor",
    categories: [
      cat("shelter", "避難所", "Shelter", "🏠", 1, "#2e8b57"),
      cat("aed", "AED", "AED", "❤️", 2, "#c0392b"),
      cat("water", "給水所", "Water", "🚰", 3, "#2e6db4"),
      cat("exit", "出口", "Exit", "🚪", 4, "#e8a33d"),
    ],
    pois: [
      indoorPoi("1", "避難スペース", "Shelter Area", "shelter", 0.5, 0.5, "一時避難の広間。", "Temporary shelter hall."),
      indoorPoi("2", "AED設置場所", "AED Location", "aed", 0.3, 0.8, "AEDはここにあります。", "AED is located here."),
      indoorPoi("3", "給水所", "Water Supply", "water", 0.75, 0.7, "飲料水の配布場所。", "Drinking water distribution."),
      indoorPoi("4", "非常口", "Emergency Exit", "exit", 0.5, 0.05, "非常時の出口。", "Exit for emergencies."),
    ],
  },

  outdoor_activity: {
    mode: "outdoor",
    categories: [
      cat("camp", "キャンプ", "Camp", "🏕️", 1, "#2e8b57"),
      cat("water", "給水所", "Water", "🚰", 2, "#2e6db4"),
      cat("store", "コンビニ", "Store", "🏪", 3, "#e8a33d"),
      cat("parking", "駐車場", "Parking", "🅿️", 4, "#6b7280"),
    ],
    pois: [
      outdoorPoi("1", "テントサイト", "Tent Site", "camp", 0.003, 0.002, "テント設営エリア。", "Tent pitching area."),
      outdoorPoi("2", "水場", "Water Point", "water", 0.001, 0.003, "炊事用の水場。", "Water point for cooking."),
      outdoorPoi("3", "近くのコンビニ", "Nearby Store", "store", -0.002, 0.001, "車で5分のコンビニ。", "5 min by car."),
      outdoorPoi("4", "駐車場", "Parking", "parking", 0.000, -0.002, "登山者用の駐車場。", "Parking for hikers."),
    ],
  },
};
