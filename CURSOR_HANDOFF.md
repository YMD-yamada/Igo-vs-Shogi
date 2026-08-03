# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

更新: 2026-08-03

## 現状
- 正本: `C:\Users\cz7\Projects\Igo-vs-Shogi`（`main`）
- 製品名: **黒白侵攻 / Kuroshiro**
- 本番 Web: https://kuroshiro-omega.vercel.app
- Capacitor: `mobile/`（`app.ymd.kuroshiro`）— Android/iOS プロジェクト生成済み
- ストア文面: `mobile/store/` / 手順: `docs/RELEASE_FLOW.md`
- personal-site: platforms ios/android/web、status `development`（ストア提出前）

## 実装済み
- モノレポ: engine / web PWA / WS server / Electron / Capacitor
- ハンデ・チュートリアル
- 本番ではオンライン UI は `VITE_WS_URL` があるときだけ表示
- アイコン原寸 `mobile/assets/icon.png`（Android mipmap / iOS AppIcon 反映済み）

## 起動
```bash
npm install
npm run smoke
npm run mobile:sync
npm run mobile:android   # Android Studio
# iOS は macOS + Xcode: npm run mobile:ios
```

## 次（デバッグ依頼待ち）
- 実機／エミュで UI・操作の修正
- ストア用スクショ / Play フィーチャーグラフィック
- （任意）オンライン常時サーバー + `VITE_WS_URL` で再ビルド

## 人間側（提出時）
- Apple Developer / Google Play Console ログインとアップロード承認
- 署名鍵・年齢レーティング最終確認
