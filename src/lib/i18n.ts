export type UiLang = "ja" | "en";

const UI_DICT: Record<string, Record<UiLang, string>> = {
  // Non-technical labels (target users may not be engineers)
  viewer: { ja: "見る", en: "View" },
  builder: { ja: "作る", en: "Make" },

  new_map: { ja: "新しいマップを作る", en: "New map" },
  edit_map: { ja: "編集", en: "Edit" },

  confirm_new_map: { ja: "今作っているマップのデータが消えます。よろしいですか？", en: "This will clear your current map. Continue?" },
  confirm_overwrite: { ja: "現在の作業中データを上書きします。よろしいですか？", en: "This will overwrite your current work. Continue?" },

  next: { ja: "次へ", en: "Next" },
  back: { ja: "戻る", en: "Back" },

  easy_editor: { ja: "かんたん編集", en: "Easy editor" },
  advanced_csv: { ja: "CSV（高度）", en: "CSV (advanced)" },

  pois_easy_title: { ja: "地点（マーカー）を編集", en: "Edit places (markers)" },
  cats_easy_title: { ja: "カテゴリ（色・形・表示名）を編集", en: "Edit categories (shape/color/label)" },
  select_item_hint: { ja: "左のリストから選ぶと、ここで編集できます。", en: "Select an item from the list to edit it here." },
  add_poi: { ja: "地点を追加", en: "Add place" },
  delete_poi: { ja: "削除", en: "Delete" },
  add_category: { ja: "カテゴリを追加", en: "Add category" },

  field_id: { ja: "ID", en: "ID" },
  field_name_ja: { ja: "名前（日本語）", en: "Name (Japanese)" },
  field_desc_ja: { ja: "説明（日本語）", en: "Description (Japanese)" },
  field_name_en: { ja: "名前（英語）", en: "Name (English)" },
  field_desc_en: { ja: "説明（英語）", en: "Description (English)" },
  field_category: { ja: "カテゴリ", en: "Category" },
  field_image: { ja: "画像", en: "Image" },
  field_url: { ja: "URL", en: "URL" },
  field_hours: { ja: "営業時間", en: "Hours" },
  field_closed: { ja: "定休日", en: "Closed" },
  field_lat: { ja: "緯度 (lat)", en: "Latitude (lat)" },
  field_lng: { ja: "経度 (lng)", en: "Longitude (lng)" },
  field_x: { ja: "x（0〜1）", en: "x (0..1)" },
  field_y: { ja: "y（0〜1）", en: "y (0..1)" },

  field_cat_key: { ja: "カテゴリID", en: "Category key" },
  field_cat_label_ja: { ja: "表示名（日本語）", en: "Label (Japanese)" },
  field_cat_label_en: { ja: "表示名（英語）", en: "Label (English)" },
  field_cat_icon: { ja: "アイコン（絵文字）", en: "Icon (emoji)" },
  field_cat_order: { ja: "並び順", en: "Order" },


  all: { ja: "すべて", en: "All" },
  search_placeholder: { ja: "検索（名前や説明）", en: "Search (name or description)" },
  list: { ja: "一覧", en: "List" },
  click_for_details: { ja: "クリックで詳細", en: "Click for details" },
  items_count: { ja: "件", en: "items" },

  close: { ja: "閉じる", en: "Close" },
  open_details: { ja: "詳細を開く", en: "Open details" },
  external_link: { ja: "外部リンク", en: "Open link" },

  locate_me: { ja: "現在地へ", en: "My location" },
  locate_not_supported: { ja: "このブラウザでは位置情報（GPS）が使えません。", en: "Geolocation is not supported in this browser." },
  locate_permission_denied: { ja: "位置情報の利用が許可されていません。ブラウザの設定で許可してください。", en: "Location permission denied. Please allow it in your browser settings." },
  locate_failed: { ja: "位置情報を取得できませんでした。電波状況や設定を確認してください。", en: "Could not get your location. Check signal or settings." },

  copy_url: { ja: "URLコピー", en: "Copy URL" },
  copied: { ja: "コピーしました", en: "Copied" },
  share: { ja: "共有", en: "Share" },
  map_only: { ja: "地図だけ", en: "Map only" },
  open_only: { ja: "営業中だけ", en: "Open now" },
  exit_map_only: { ja: "戻る", en: "Back" },
  add_on_map_click: { ja: "地図クリックで追加", en: "Add by map click" },
  add_on_map_click_hint: {
    ja: "ONの間は、地図をクリックすると新しい地点を追加します（詳細は開きません）。",
    en: "When ON, clicking the map adds a new place. (Details won't open.)"
  },

  // Optional business hours (outdoor maps)
  open_now: { ja: "営業中", en: "Open now" },
  closed_now: { ja: "営業時間外", en: "Closed now" },
  hours_label: { ja: "営業時間", en: "Hours" },
  closed_label: { ja: "休業日", en: "Closed" },
  hours_unknown: { ja: "営業時間不明", en: "Hours unknown" },

  select_file: { ja: "選択", en: "Choose" },

  qr_title: { ja: "QRを表示", en: "Show QR" },
  qr_close: { ja: "閉じる", en: "Close" },
  qr_public_url: { ja: "公開URL", en: "Public URL" },
  qr_generating: { ja: "生成中…", en: "Generating…" },

  privacy_title: { ja: "個人情報・プライバシー注意", en: "Privacy / personal info caution" },
  privacy_body: {
    ja: "公開前に、顔写真・氏名・連絡先・生徒の動線が特定できる情報が含まれていないか確認してください。屋外の緯度経度は公開範囲に応じて丸め/非表示を検討してください。",
    en: "Before publishing, make sure there is no face photo, real name, contact info, or information that can reveal someone's movement. Consider rounding/hiding outdoor coordinates depending on your audience."
  },

  // builder steps
  step_template: { ja: "1.最初の設定", en: "1.Start" },
  step_assets: { ja: "2.データ・画像", en: "2.Data & images" },
  step_preview: { ja: "3.できあがり確認", en: "3.Check" },
  step_publish: { ja: "4.公開", en: "4.Publish" },

  // builder steps (import flow)
  step_import: { ja: "1.ファイルを取り込む", en: "1.Import" },
  step_template_2: { ja: "2.最初の設定", en: "2.Start" },
  step_assets_3: { ja: "3.データ・画像", en: "3.Data & images" },
  step_preview_4: { ja: "4.できあがり確認", en: "4.Check" },
  step_publish_5: { ja: "5.公開", en: "5.Publish" },

  import_title: { ja: "ファイルを取り込む", en: "Import a file" },
  import_hint: {
    ja: "出力した site.zip または content-pack.zip を読み込むと、続きから編集できます。",
    en: "Import a previously exported site.zip or content-pack.zip to continue editing."
  },
  import_choose_zip: { ja: "ZIPを選択", en: "Choose ZIP" },
  import_loaded: { ja: "読み込みました。次へ進めます。", en: "Imported. You can proceed." },
  next_template: { ja: "次へ（最初の設定）", en: "Next (Start)" },

  // Builder: step 1 (template / basic settings)
  template_title: { ja: "最初の設定", en: "Basic settings" },
  template_hint_title: { ja: "ヒント", en: "Tip" },
  template_hint_body: {
    ja: "まずはタイトルと言語、屋外/屋内を決めます。あとからいつでも変更できます。",
    en: "Start by setting title, language, and outdoor/indoor. You can change them anytime."
  },
  mode: { ja: "地図の種類", en: "Map type" },
  default_lang: { ja: "既定言語", en: "Default language" },
  title: { ja: "タイトル", en: "Title" },
  subtitle: { ja: "サブタイトル", en: "Subtitle" },
  tab_title: { ja: "サイトタブの名称", en: "Browser tab title" },
  floor_image_width: { ja: "屋内画像の横幅（px）", en: "Indoor image width (px)" },
  floor_image_height: { ja: "屋内画像の縦幅（px）", en: "Indoor image height (px)" },

  // Builder: step 2 (data & images)
  edit_data_title: { ja: "データと画像を用意する", en: "Prepare data and images" },
  edit_data_hint: {
    ja: "地点やカテゴリを入力し、必要な写真を追加します。まずは『かんたん編集』がおすすめです。",
    en: "Add places/categories and upload photos. We recommend the Easy editor first."
  },
  assets_title: { ja: "画像を追加", en: "Add images" },
  pois_csv: { ja: "地点（POI）のCSV", en: "POI CSV" },
  cats_csv: { ja: "カテゴリのCSV", en: "Category CSV" },
  poi_csv_hint: {
    ja: "例: id,name,description,name_en,description_en,category,image,lat,lng,x,y,url,hours,closed",
    en: "Example: id,name,description,name_en,description_en,category,image,lat,lng,x,y,url,hours,closed"
  },
  cat_csv_hint: {
    ja: "例: category,label,label_en,icon,order,markerType,markerColor",
    en: "Example: category,label,label_en,icon,order,markerType,markerColor"
  },
  pois_csv_hint: { ja: "（地点の一覧データ）", en: "(Place list data)" },
  cats_csv_hint: { ja: "（カテゴリの一覧データ）", en: "(Category list data)" },
  fill_sample: { ja: "サンプルを入れる", en: "Fill sample" },
  apply_csv: { ja: "CSVに反映", en: "Write to CSV" },

  assets_images_drop: { ja: "画像をここにドロップ（複数OK）", en: "Drop images here (multiple ok)" },
  assets_floor_drop: { ja: "フロア画像をここにドロップ", en: "Drop floor image here" },

  // Builder: step 3 (preview)
  preview_title: { ja: "できあがり確認", en: "Check your map" },
  preview_hint: {
    ja: "マーカーをクリックして表示や文章を確認します。屋内の場合は位置も調整できます。",
    en: "Click markers to confirm labels and descriptions. For indoor maps you can adjust positions."
  },
  next_publish: { ja: "公開の準備へ", en: "Prepare to publish" },

  // Builder: step 4 (publish)
  publish_title: { ja: "公開用ファイルを作る", en: "Create publish files" },
  publish_hint: {
    ja: "初回公開は『サイト本体込みzip（site.zip）』をアップロードします。2回目以降の更新は『更新用コンテンツzip（content-pack.zip）』を上書きします。",
    en: "For the first publish, upload the full site zip (site.zip). For later updates, overwrite with the content pack (content-pack.zip)."
  },
  download_site_zip: { ja: "サイト本体込みzipをダウンロード", en: "Download full site zip" },
  download_content_pack: { ja: "更新用コンテンツzipをダウンロード", en: "Download content pack zip" },
  publish_branding_title: { ja: "公開サイトの見た目", en: "Published site look" },
  publish_branding_hint: {
    ja: "スマートフォン表示を最優先にしたテンプレートです。ロゴ・ファビコン・色テンプレを選んでください。",
    en: "Mobile-first template. Choose a logo, favicon, and a color template."
  },
  publish_logo: { ja: "サイトロゴ", en: "Site logo" },
  publish_favicon: { ja: "ファビコン", en: "Favicon" },
  publish_logo_favicon: { ja: "ロゴ / ファビコン（共通）", en: "Logo / Favicon (shared)" },
  publish_logo_favicon_default_hint: { ja: "未設定の場合はデフォルト（brand/logo.svg または brand/logo.png / favicon.ico）が使われます", en: "If not set, defaults (brand/logo.svg or brand/logo.png / favicon.ico) are used" },
  publish_color_templates: { ja: "色テンプレ（5色）", en: "Color templates (5)" },
  theme_blue: { ja: "ブルー", en: "Blue" },
  theme_green: { ja: "グリーン", en: "Green" },
  theme_orange: { ja: "オレンジ", en: "Orange" },
  theme_purple: { ja: "パープル", en: "Purple" },
  theme_red: { ja: "レッド", en: "Red" },

  next_assets: { ja: "次へ（データ・画像）", en: "Next (Data & images)" },
  next_preview: { ja: "次へ（できあがり確認）", en: "Next (Check)" },

  template_select_title: { ja: "テンプレ選択（目的特化）", en: "Choose a template (purpose-focused)" },
  template_event: { ja: "イベント", en: "Event" },
  template_tourism: { ja: "観光", en: "Tourism" },
  template_learning: { ja: "学習", en: "Learning" },

  mode_label: { ja: "モード", en: "Mode" },
  mode_outdoor: { ja: "屋外（lat,lng）", en: "Outdoor (lat,lng)" },
  mode_indoor: { ja: "屋内（画像 + x,y）", en: "Indoor (image + x,y)" },

  site_theme_label: { ja: "サイトのテーマ", en: "Site theme" },
  theme_dark: { ja: "ダーク", en: "Dark" },
  theme_light: { ja: "ライト", en: "Light" },
  theme_system: { ja: "端末に合わせる", en: "System" },

  multilingual_title: { ja: "多言語（観光向け）", en: "Multilingual (useful for tourism)" },
  multilingual_help: {
    ja: "表示する言語（タイトル・POIの翻訳に使います）。CSVの name_en / description_en / label_en なども読み取ります。",
    en: "Content languages used for title/POI/category translations. CSV columns like name_en / description_en / label_en are supported."
  },
  default_content_lang: { ja: "既定言語", en: "Default content language" },
  supported_langs: { ja: "対応言語", en: "Supported languages" },

  other_lang_note: { ja: "※ 他言語は必要なら config.json を直接編集してください。", en: "For other languages, edit config.json directly if needed." },
  title_label: { ja: "タイトル", en: "Title" },
  subtitle_label: { ja: "サブタイトル", en: "Subtitle" },

  privacy_hide_label: { ja: "位置情報を隠す（屋外）", en: "Hide exact location (outdoor)" },
  privacy_hide_reco: { ja: "隠す（推奨）", en: "Hide (recommended)" },
  privacy_show: { ja: "表示", en: "Show" },
  coord_round_label: { ja: "緯度経度の丸め（公開用）", en: "Round lat/lng (for publishing)" },
  digits: { ja: "桁", en: "digits" },

  school_points_title: { ja: "学校向けのポイント（実装済み）", en: "School-friendly features (implemented)" },
  school_point_light: { ja: "軽量: 画像は取り込み時に圧縮", en: "Lightweight: images are compressed on import" },
  school_point_offline: { ja: "オフライン: PWA（キャッシュ）で data/images を保持", en: "Offline: PWA cache keeps data/images" },
  school_point_privacy: { ja: "個人情報: 注意バナー + 緯度経度丸め", en: "Privacy: caution banner + coordinate rounding" },

  csv_import_title: { ja: "表データを入れる（貼り付けOK）", en: "Add table data (paste is OK)" },
  poi_csv_hint_short: { ja: "POI（id,name,description,...）", en: "POIs (id,name,description,...)" },
  cat_csv_hint_short: { ja: "カテゴリ（category,label,...）", en: "Categories (category,label,...)" },


  titles_by_lang: { ja: "タイトル（言語別）", en: "Title (per language)" },
  subtitles_by_lang: { ja: "サブタイトル（言語別）", en: "Subtitle (per language)" },

  csv_pois_title: { ja: "POI CSV", en: "POI CSV" },
  csv_cats_title: { ja: "カテゴリ CSV", en: "Categories CSV" },
  csv_pois_hint: {
    ja: "列例: id,name,description,category,image,lat,lng,x,y,url,hours,closed + name_en/description_en など",
    en: "Columns: id,name,description,category,image,lat,lng,x,y,url,hours,closed + name_en/description_en etc."
  },
  csv_cats_hint: {
    ja: "列例: category,label,label_en,icon,order,markerType,markerColor（markerType: pin/dot/badge/ring/square/hex/flag）",
    en: "Columns: category,label,label_en,icon,order,markerType,markerColor (markerType: pin/dot/badge/ring/square/hex/flag)"
  },
  apply_parse: { ja: "読み込む", en: "Load" },
  back_to_sample: { ja: "サンプルに戻す", en: "Reset to sample" },
  preview_update: { ja: "地図に反映", en: "Apply to map" },

  assets_images_title: { ja: "写真・画像", en: "Photos / images" },
  assets_images_hint: {
    ja: "画像をドロップすると自動で圧縮して公開パックへ同梱します。",
    en: "Dropped images are auto-compressed and bundled into the export pack."
  },
  assets_floor_title: { ja: "屋内の地図画像（フロア画像）", en: "Indoor map image (floor)" },
  assets_floor_not_needed: { ja: "屋外モードではフロアマップは不要です。", en: "Outdoor mode does not need a floor map." },

  assets_floor_hint: {
    ja: "屋内モードで使用するフロア画像。アップロードすると indoor.imageUrl を更新します。",
    en: "Floor image used in indoor mode. Uploading updates indoor.imageUrl."
  },

  validation_title: { ja: "検証結果", en: "Validation" },
  validation_ok: { ja: "エラーはありません。", en: "No errors found." },
  preview_help: { ja: "カテゴリ/検索で絞り込み、ピンをクリックして詳細を確認。", en: "Filter by category/search, then click a marker to open details." },

  validation_has_errors: { ja: "エラーがあります。修正してください。", en: "Errors found. Please fix them." },

  indoor_pick_title: { ja: "屋内: 地図クリックで x,y 設定", en: "Indoor: set x,y by clicking the map" },
  indoor_pick_help: {
    ja: "POIを選んで「位置を設定」をONにすると、地図クリックで x,y(0〜1) を自動入力します。ピクセル座標を使いたい場合は CSV にそのまま書いてもOKです。",
    en: "Select a POI and enable “Set position”. Clicking the map writes x,y (0..1). If you prefer pixel coordinates, you can put pixels directly in CSV as well."
  },
  set_position: { ja: "位置を設定", en: "Set position" },
  selected_poi: { ja: "選択中POI", en: "Selected POI" },
  picked_xy: { ja: "クリック位置", en: "Clicked position" },

  export_pack: { ja: "公開用ファイルをダウンロード", en: "Download files for publishing" },


  status: { ja: "今の状態", en: "Status" },
  current_settings: { ja: "現在の設定", en: "Current settings" },
  errors: { ja: "エラー", en: "Errors" },
  shortcuts: { ja: "便利なキー", en: "Shortcuts" },
  apply_csv_short: { ja: "読み込み", en: "Load" },
  preview_update_short: { ja: "地図に反映", en: "Apply" },
  shortcut_apply_csv: { ja: "Ctrl/⌘ + Enter: 読み込み", en: "Ctrl/⌘ + Enter: Load" },
  shortcut_preview: { ja: "Ctrl/⌘ + Shift + Enter: 地図に反映", en: "Ctrl/⌘ + Shift + Enter: Apply" },

  marker_settings_title: { ja: "カテゴリのマーカー設定（リスト編集）", en: "Category marker settings (list editor)" },
  marker_settings_help: { ja: "CSVを書かなくても、ここで種類と色を選べます（下のCSVにも反映されます）。", en: "Choose marker type/color without editing CSV (CSV is updated too)." },
  marker_type: { ja: "種類", en: "Type" },
  marker_color: { ja: "色", en: "Color" },
  apply_to_csv: { ja: "CSVに反映", en: "Write to CSV" },
  saved: { ja: "保存済み", en: "Saved" },
  unsaved: { ja: "未保存", en: "Unsaved" },
  reload_warn_unsaved: {
    ja: "ページを再読み込みすると、未保存の変更が消えてしまいます。よろしいですか？",
    en: "Reloading will discard your unsaved changes. Continue?"
  },
  undo: { ja: "元に戻す", en: "Undo" },
  show_qr: { ja: "QRを表示", en: "Show QR" },
  detect_errors_title: { ja: "誤り検出", en: "Detected issues" },

  language: { ja: "言語", en: "Language" },
  theme: { ja: "テーマ", en: "Theme" },

  step: { ja: "ステップ", en: "Step" },
  template_short: { ja: "テンプレ", en: "Template" },
  mode_short: { ja: "モード", en: "Mode" },
  langs_short: { ja: "言語", en: "Langs" },
  theme_short: { ja: "テーマ", en: "Theme" },
  yes: { ja: "あり", en: "Yes" },
  no: { ja: "なし", en: "No" },

  poi_label: { ja: "POI", en: "POIs" },
  category_label: { ja: "カテゴリ", en: "Categories" },
  images_label: { ja: "画像", en: "Images" },
  floor_label: { ja: "フロア", en: "Floor" },
  warn: { ja: "警告", en: "Warnings" }
};

export function t(lang: UiLang, key: keyof typeof UI_DICT): string {
  const row = UI_DICT[key];
  return row?.[lang] ?? String(key);
}

export function normalizeUiLang(value: string | null | undefined): UiLang {
  if (value === "en") return "en";
  return "ja";
}

export function detectUiLang(): UiLang {
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("ja") ? "ja" : "en";
}

/**
 * Human labels for language codes (content languages).
 * When uiLang === "en", prefer English names.
 */
export function langLabel(code: string, uiLang: UiLang = "en"): string {
  const c = (code || "").toLowerCase();
  if (c.startsWith("ja")) return uiLang === "ja" ? "日本語" : "Japanese";
  if (c.startsWith("en")) return "English";
  if (c.startsWith("zh")) return uiLang === "ja" ? "中文" : "Chinese";
  if (c.startsWith("ko")) return uiLang === "ja" ? "한국어" : "Korean";
  return code;
}
