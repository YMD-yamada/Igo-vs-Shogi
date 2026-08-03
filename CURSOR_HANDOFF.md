# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

更新: 2026-08-03

## 現状
- ブランチ: `cursor/igo-shogi-hybrid-327a`（PR #2）
- 正本パス: `C:\Users\cz7\Projects\Igo-vs-Shogi`
- 製品名: **黒白侵攻 / Kuroshiro**
- **一盤戦**: 共有 9×9（二盤面デザインは廃止）

## ルール要約
- 囲碁: 黒石を打ち、将棋駒を囲んで取る（王取り即勝ち）
- 将棋: 駒を動かして黒石に乗る（石取り→歩の持ち駒）
- 勝利: 囲碁=駒5 / 将棋=石10（ハンデ可）

## 実装済み
- `packages/engine` — 共有盤エンジン + CPU + ハンデ + テスト
- `apps/web` — 単一盤 UI / ホットシート / CPU / オンライン / チュートリアル
- `apps/server` — WebSocket ルーム（既定 `:9877`）
- `apps/desktop` — Electron

## 起動
```bash
npm install
npm run build -w @kuroshiro/engine
npm run dev
npm run dev:server
```

## 検証
- `npm test` / `npm run smoke` OK（一盤戦リライト後）

## 次の候補
- 本番デプロイ / personal-site 掲載
- バランス微調整・チュートリアル強化
