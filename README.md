# Map Site Framework (React + Leaflet)

**技術的背景がない人でも「地図サイトを作る → 確認 → 公開」まで**進められるように作った、静的ホスティング前提のマップサイトフレームワークです。

基本の流れ：
1) テンプレを選ぶ
2) 表データ（CSV）と画像を入れる
3) できあがりを地図で確認
4) 公開担当（先生・運営・サーバ管理者）へ ZIP を渡す / 公開する

## 特徴
- **React + Leaflet**（ビューア/ビルダー両方）
- **データは public/data/*.json**（ビルド時に `data/*.csv` から生成可能）
- **画像は public/images/**、屋内フロアマップは **public/assets/**
- **軽量**: 取り込み時に画像を圧縮
- **オフライン寄り**: PWA（CacheFirst）で data/images/assets をキャッシュ
- **個人情報ガード**: 注意バナー + 緯度経度の丸め（公開用エクスポートに適用）

## 開始（開発者向け）
```bash
npm i
npm run dev
```
- ビューア: http://localhost:5173/#/
- ビルダー: http://localhost:5173/#/builder

---

## ロゴとファビコン（ここに置けばOK）

このプロジェクトは **`public/` フォルダの中に置いたファイルを、そのまま公開サイトにコピー**します。

- ファビコン（ブラウザのタブに出る小さいアイコン）
  - `public/favicon.svg` をあなたのファイルで上書きしてください
- サイトロゴ（左上に表示）
  - `public/brand/logo.svg` をあなたのロゴで上書きしてください
  - PNG/JPG を使いたい場合は `logo.png` などにして、`src/App.tsx` の `publicUrl("brand/logo.svg")` を差し替えます

※ どちらも「まずは仮の画像」が入っているので、そのままでも動きます。

## CSV→JSON（ビルド時）
- 入力: `data/pois.csv`, `data/categories.csv`, `data/config.json`
- 出力: `public/data/pois.json`, `public/data/categories.json`, `public/data/config.json`
```bash
npm run build:data
```

## 公開のしかた（非エンジニア向け）

このフレームワークのビルダーが出力する **`content-pack.zip` は「地図に表示するデータと画像のセット」**です。
まずはこの ZIP を作れば OK。次は公開担当が行います。

### 1) ビルダーで ZIP を作る
ビルダーの「**公開用ファイルをダウンロード**」を押す → `content-pack.zip` が落ちてきます。

### 2) 公開担当（先生・運営・サーバ管理者）へ渡す
メール / LINE / Google Drive などで ZIP を渡してください。

### 3) 公開担当がやること（かんたん）
1. `content-pack.zip` を **解凍**する
2. 中の `data/`, `images/`, `assets/` を、公開サイトの同名フォルダに **上書きコピー**する
3. ブラウザで開いて **地図とマーカーが表示される**か確認する

> ポイント：サイトの「土台」は最初に一度だけ作れば、次回からは **`data/images/assets` を差し替えるだけ**で更新できます。

---

## 公開用ZIP（開発者/公開担当向け）
```bash
npm run pack
```
- `release/site.zip` が生成されます。中身を GitHub Pages / 学内Webサーバ に配置してください。

## 屋内/屋外データ
- 屋外: `lat,lng`
- 屋内: `x,y`（0〜1の正規化座標）
