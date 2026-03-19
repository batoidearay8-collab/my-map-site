# AtlasKobo — Map Site Framework (React + Leaflet)

**技術的背景がない人でも「地図サイトを作る → 確認 → 公開」まで**進められる、静的ホスティング前提のマップサイトフレームワークです。

基本の流れ：
1) テンプレを選ぶ
2) 表データ（CSV / GeoJSON）と画像を入れる
3) できあがりを地図で確認
4) 公開担当（先生・運営・サーバ管理者）へ ZIP を渡す / 公開する

## 特徴
- **React + Leaflet**（ビューア/ビルダー両方）
- **100% オープンソース**（Google / Apple 非依存）
- **データは public/data/*.json**（ビルド時に `data/*.csv` から生成可能）
- **GeoJSON 対応**: QGIS / uMap などOSSツールとの相互運用
- **マーカークラスタリング**: 50件以上のPOIでも快適に表示
- **軽量**: 取り込み時に画像を圧縮
- **オフライン寄り**: PWA（CacheFirst）で data/images/assets をキャッシュ
- **個人情報ガード**: 注意バナー（dismiss可能） + 緯度経度の丸め
- **アクセシビリティ**: スキップリンク、ARIA ランドマーク、キーボード操作対応
- **レスポンシブ**: モバイルファーストのビルダー/ビューアUI
- **埋め込み対応**: iframe でのページ組み込みコード生成
- **7種テンプレート**: 観光・ライブ・祭り・文化祭・防災・アウトドア・便利マップ

## 開始（開発者向け）
```bash
npm i
npm run dev
```
- ビューア: http://localhost:5173/#/
- ビルダー: http://localhost:5173/#/builder

---

## ロゴとファビコン

- ファビコン: `public/favicon.svg` をあなたのファイルで上書き
- サイトロゴ: `public/brand/logo.svg` をあなたのロゴで上書き
- PNG/JPG を使う場合は `logo.png` にして、`src/App.tsx` の参照を差し替え

## CSV→JSON（ビルド時）
```bash
npm run build:data
```

## GeoJSON 対応
ビルダーの Step 2 で `.geojson` ファイルを読み込み可能。エクスポートも対応。
QGIS / geojson.io で編集 → AtlasKobo に戻すワークフローに最適。

## 公開のしかた（非エンジニア向け）

1. ビルダーで `site.zip` をダウンロード
2. 公開担当へ渡す
3. 解凍して GitHub Pages / 学内サーバに配置
4. 2回目以降は `content-pack.zip` で差し替えるだけ

## 屋内/屋外データ
- 屋外: `lat,lng`
- 屋内: `x,y`（0〜1の正規化座標）

## マーカー種類
`markerType`: pin / dot / badge / ring / square / hex / flag

## テンプレート
tourism / live / festival / school_festival / disaster / outdoor_activity / convenience

---

## v10.4.0 変更履歴

### バグ修正 (5件)
- `pickPoiName()` / `pickCategoryLabel()` 引数ミスマッチ修正
- `DetailsModal` に正しい `mode` / `now` props を渡すよう修正
- `QrModal` に `uiLang` prop を追加
- `DropZone` の `label` → `title` prop修正
- `outdoor.centerLat/centerLng` → `outdoor.center[0]/[1]` 修正

### スキーマ・型安全性
- `ConfigSchema` に `reco` フィールドを正式追加
- `template` enum を7種に拡張
- BuilderPage内の `as any` キャスト大幅削減

### 新機能
- **マーカークラスタリング**: 20件以上のPOIで自動グループ化
- **GeoJSON インポート/エクスポート**: QGIS / uMap 連携
- **埋め込みコード生成**: iframe用コードをStep 4でコピー
- **ローディングインジケータ**: ZIP生成時にスピナー表示

### UI/UX改善
- **プライバシーバナー**: ビューアで dismiss 可能に
- **アクセシビリティ**: スキップリンク、ARIA、キーボード操作、focus-visible
- **モバイル対応**: ビルダーのレスポンシブ改善
- **リスト表示改善**: ホバーエフェクト、アクセントボーダー
- **公開サイトCSS**: ライトモード配色をビルダーと統一
