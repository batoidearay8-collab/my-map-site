# AtlasKobo — ノーコード地図作成フレームワーク

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
![version](https://img.shields.io/badge/version-10.11.0-blue.svg)

**技術的背景がない人でも「地図サイトを作る → 確認 → 公開」まで** 進められる、静的ホスティング前提のマップサイトフレームワークです。React + Leaflet 製で、Google / Apple のサービスに依存せず、100% オープンソースで動作します。

> 高校の文化祭、地域イベント、観光案内、防災マップなどの「屋内外マップ」を、コードを書かずに作成・公開できます。

<!-- スクリーンショット: 配置後に下のパスへ画像を置いてください -->
<p align="center">
  <img src="docs/screenshot-builder.png" alt="ビルダー画面（作る側）" width="48%">
  <img src="docs/screenshot-viewer.png" alt="ビューワー画面（見る側）" width="48%">
</p>
<p align="center"><sub>左: ビルダー（作る側） / 右: ビューワー（見る側）</sub></p>

---

## 🚀 はじめての方へ（コードを書かない人向けクイックスタート）

AtlasKobo は **コードを一切書かずに** 地図サイトを作れます。流れは4ステップです。

1. **ビルダー画面を開く** … 配布された URL もしくはローカルのビルダーを開きます。
2. **データと画像を入れる** … 地点（POI）・カテゴリ・地図画像を画面上で追加・編集します。CSV や GeoJSON の読み込みも可能です。
3. **できあがりを確認する** … その場で地図プレビューを確認できます。
4. **公開する** … 2通りあります。
   - **GitHub に直接公開**: GitHub の Personal Access Token を入力するだけで GitHub Pages へ公開（環境構築不要）。
   - **ZIP を渡して公開**: \`site.zip\` をダウンロードし、公開担当（先生・運営・サーバ管理者）に渡して配置してもらう。

📘 **詳しい操作手順は、付属のスライド資料をご覧ください** → [\`docs/AtlasKobo_usage_guide.pptx\`](docs/AtlasKobo_usage_guide.pptx)

> Personal Access Token は、公開先リポジトリに必要な最小限の権限・短い有効期限で発行することを推奨します。トークンは端末内でのみ使用され、外部には送信されません。

---

## ✨ 特徴

- **React + Leaflet**（ビューワー / ビルダー両方）
- **100% オープンソース**（Google / Apple 非依存、MIT ライセンス）
- **屋内外の両対応**: 屋外は緯度経度、屋内は見取り図上の正規化座標
- **簡易フロア作成**: 外部ソフト不要。アプリ内で長方形を並べて間取り図（フロア画像）を作成・書き出し
- **GitHub 直接公開**: トークン入力だけで GitHub Pages へ（環境構築不要）
- **PWA 対応**: オフライン動作・高速読み込み（CacheFirst キャッシュ）
- **データは手元に保持**: ベンダーのクラウドに依存しない（\`public/data/*.json\`）
- **GeoJSON 対応**: QGIS / uMap などの OSS ツールと相互運用
- **マーカークラスタリング**: 多数の POI でも快適に表示
- **個人情報ガード**: 注意バナー + 緯度経度の丸め
- **アクセシビリティ**: スキップリンク、ARIA ランドマーク、キーボード操作対応
- **7種テンプレート**: 観光・ライブ・祭り・文化祭・防災・アウトドア・便利マップ

---

## 🧪 サンプルデータ（同梱）

リポジトリには、すぐ動かせるサンプルが入っています。\`npm run dev\` で起動すると、\`data/\` 配下の以下のサンプルがそのまま表示されます。

- \`data/pois.csv\` … サンプル地点データ
- \`data/categories.csv\` … サンプルカテゴリ
- \`data/config.json\` … サンプル設定

まずはこのサンプルを動かして「完成形」を確認し、そこから自分のデータに差し替えていくのがおすすめです。

---

## 🛠 開発者向けセットアップ

\`\`\`bash
npm install
npm run dev
\`\`\`

- ビューワー: http://localhost:5173/#/
- ビルダー: http://localhost:5173/#/builder

ビルドと公開:

\`\`\`bash
npm run build          # 本番ビルド（dist/ を生成）
npx gh-pages -d dist   # GitHub Pages へデプロイ（任意）
\`\`\`

テスト:

\`\`\`bash
npm run test           # vitest（45 テスト）
\`\`\`

> 配布物には \`package-lock.json\` を同梱していません（環境依存のレジストリ URL 混入による \`npm install\` 失敗を避けるため）。詳細は [\`INSTALL_NOTE_JA.txt\`](INSTALL_NOTE_JA.txt) を参照してください。

---

## 📂 データ形式

### CSV → JSON（ビルド時）
\`\`\`bash
npm run build:data
\`\`\`

### 屋内 / 屋外データ
- 屋外: \`lat,lng\`
- 屋内: \`x,y\`（0〜1 の正規化座標）

### マーカー種類
\`markerType\`: pin / dot / badge / ring / square / hex / flag

### テンプレート
tourism / live / festival / school_festival / disaster / outdoor_activity / convenience

### GeoJSON 対応
ビルダーの Step 2 で \`.geojson\` を読み込み・書き出し可能。QGIS / geojson.io で編集して AtlasKobo に戻すワークフローに対応します。

---

## 🔬 研究用機能について（既定で無効）

本フレームワークには、学術研究での利用を想定した **任意の利用状況ログ機能**（同意ダイアログ、アンケート誘導、匿名インタラクションログ）が含まれています。

- これらは **既定で完全に無効**です。配布される地図サイトでは、利用者（来場者）に一切表示されません。
- 有効化するには、設定で \`research.enabled\` を明示的に \`true\` にする **オプトイン方式** です。
- 有効化した場合も、来場者には同意ダイアログが表示され、**同意しなくても地図の全機能が利用できます**。

通常の地図サイト作成では、この機能を意識する必要はありません。

---

## ⚠️ 注意事項 / Caveats

### Nominatim（住所→座標変換）の利用について
ルート検索の住所入力は **OpenStreetMap Nominatim** の無料公開 API を使用します（[OSM Foundation ポリシー](https://operations.osmfoundation.org/policies/nominatim/) に準拠）。

- 1 秒あたり最大 1 リクエスト（アプリ側で debounce 制御）
- ヘビーユース（毎日数千リクエスト超）は不可

個人サイト・小規模利用なら問題ありません。商用・大量アクセス時は、[Nominatim の自前ホスト](https://nominatim.org/release-docs/latest/admin/Installation/) や [Mapbox](https://www.mapbox.com/) / [OpenCage](https://opencagedata.com/) など有料 API への切り替えを検討してください。

### CSV 出力時の数式インジェクション対策
POI 名や説明文が \`=\`, \`+\`, \`-\`, \`@\` で始まる場合、CSV 出力時に自動的に \`'\` プレフィックスを付加します（[OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) 対策）。

### 自動保存（v10.6.1+）
ビルダーの作業内容（設定・POI・カテゴリ）は localStorage に自動保存され、リロードや再起動後も復元されます。ただし **アップロードした画像・フロア画像は復元されません**（File オブジェクトのため）。定期的に「Content Pack ZIP」をダウンロードしておくと、画像を含めた完全なバックアップになります。

---

## 📜 ライセンス

本ソフトウェアは [MIT ライセンス](./LICENSE) の下で公開されています。

依存ライブラリ（React, Leaflet, Zustand 等）および地図タイル（OpenStreetMap, ODbL）は、それぞれのライセンスに従います。

---

## 📝 変更履歴（CHANGELOG）

完全な履歴は [\`CHANGELOG.md\`](CHANGELOG.md) を参照してください。主な最近の変更点は以下の通りです。

### v10.11.0
- **GitHub 直接公開パネルをビルダーの「4.公開」画面に統合**（Personal Access Token を入力するだけで GitHub Pages へ公開可能に）
- ビルダー UI から研究モード／マスターモードの選択カードを削除（公開向けに簡素化）
- MIT ライセンス・各種メタ情報を整備し、OSS として公開可能な状態に

### v10.4.0
- バグ修正 5 件（\`pickPoiName()\` 引数、\`DetailsModal\` props、\`QrModal\` の \`uiLang\`、\`DropZone\` の \`title\`、\`outdoor.center\` 参照）
- スキーマ・型安全性向上（\`reco\` フィールド追加、\`template\` enum を 7 種に拡張、\`as any\` 削減）
- 新機能: マーカークラスタリング、GeoJSON インポート/エクスポート、埋め込みコード生成、ZIP 生成時ローディング表示
- UI/UX 改善: プライバシーバナーの dismiss、アクセシビリティ強化、モバイル対応、公開サイト CSS 統一
