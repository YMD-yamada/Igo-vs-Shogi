# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

更新: 2026-08-03

## 現状
- 正本: `C:\Users\cz7\Projects\Igo-vs-Shogi`（`main`、PR #2 マージ済み）
- 製品名: **黒白侵攻 / Kuroshiro**
- 本番 Web: https://kuroshiro-omega.vercel.app （Vercel プロジェクト `kuroshiro`）
- personal-site / ymd-portfolio 掲載済み（released + URL）

## 実装済み
- モノレポ: engine / web PWA / WS server / Electron
- ハンデ（ローカル・CPU）・チュートリアル
- WS 既定ポート `:9877`（8787 は usage-monitor と衝突）
- root `overrides.rollup` → `@rollup/wasm-node`（Windows ARM64）

## 起動（ローカル）
```bash
npm install
npm run build -w @kuroshiro/engine
npm run dev
npm run dev:server   # ws://127.0.0.1:9877
npm run smoke && npm run smoke:online
```

## 未着手 / 次
- オンライン常時サーバー（Fly/Railway 等）— 本番 Web はホットシート/CPU が主。オンラインは `VITE_WS_URL` を合わせて再デプロイ
- オンライン部屋へのハンデ共有

## 人間側
- （任意）カスタムドメインを Vercel に紐付け
- （任意）オンラインサーバー課金・デプロイ承認
