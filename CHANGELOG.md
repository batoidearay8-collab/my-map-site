# 変更履歴 (Changelog)

本プロジェクトのバージョンごとの変更点を記録します。
形式は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に概ね準拠し、[セマンティック バージョニング](https://semver.org/lang/ja/) を採用しています。

## [10.11.0] - 2026-06

### 追加 (Added)
- **GitHub 直接公開パネル** をビルダーの「4.公開」画面に統合。GitHub の Personal Access Token を入力するだけで GitHub Pages へ公開できるようになりました（事前の環境構築が不要）。
- MIT `LICENSE` ファイルを追加。
- `package.json` にライセンス・説明・著者・リポジトリ等のメタ情報を追加。
- 非技術者向けクイックスタートを README に追加。

### 変更 (Changed)
- ビルダー UI から研究モード（任意・学術利用の選択カード）およびマスターモードを削除し、公開向けに簡素化。

### 補足 (Notes)
- ビューワー側の研究用ログ機構（同意ダイアログ・匿名ログ）は残置していますが、**既定で無効（オプトイン方式）** です。配布される地図サイトでは利用者に表示されません。

## [10.4.0]

### 修正 (Fixed)
- `pickPoiName()` / `pickCategoryLabel()` の引数ミスマッチを修正。
- `DetailsModal` に正しい `mode` / `now` props を渡すよう修正。
- `QrModal` に `uiLang` prop を追加。
- `DropZone` の `label` → `title` prop を修正。
- `outdoor.centerLat/centerLng` → `outdoor.center[0]/[1]` を修正。

### 変更 (Changed)
- `ConfigSchema` に `reco` フィールドを正式追加。
- `template` enum を 7 種に拡張。
- `BuilderPage` 内の `as any` キャストを大幅削減。

### 追加 (Added)
- マーカークラスタリング（多数 POI の自動グループ化）。
- GeoJSON インポート / エクスポート（QGIS / uMap 連携）。
- 埋め込みコード生成（iframe 用、Step 4 でコピー）。
- ZIP 生成時のローディングインジケータ。

### UI/UX
- プライバシーバナーを dismiss 可能に。
- アクセシビリティ強化（スキップリンク、ARIA、キーボード操作、focus-visible）。
- ビルダーのモバイル レスポンシブ改善。
- 公開サイト CSS のライトモード配色をビルダーと統一。

[10.11.0]: https://github.com/batoidearay8-collab/AtlasKobo/releases/tag/v10.11.0
[10.4.0]: https://github.com/batoidearay8-collab/AtlasKobo/releases/tag/v10.4.0
