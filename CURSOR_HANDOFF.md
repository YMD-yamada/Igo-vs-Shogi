# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

更新: 2026-08-03

## 現状
- ブランチ: `cursor/igo-shogi-hybrid-327a`（PR #2）
- 正本パス: `C:\Users\cz7\Projects\Igo-vs-Shogi`
- 製品名: **黒白侵攻 / Kuroshiro**
- **一盤戦**: 共有 9×9

## ルール要約
- 勝利（互角）: 囲碁=駒2 / 将棋=石6（ハンデ可）
- CPUは囲碁側・将棋側どちらでも対戦可
- オンライン: WS+HTTP `:9877`

## 対局ログ（長期改善）
- スキーマ: `packages/engine/src/matchLog.ts`（MatchLog v1）
- クライアント: localStorage + JSONL書き出し + サーバーへ任意アップロード
- サーバー: オンライン終了時に `data/match-logs/YYYY-MM-DD.jsonl`
- 集計: `npm run analyze:logs`
- 手順: `docs/FEEDBACK_LOOP.md`（「フィードバック適用」でこのサイクル）

## バランス
- `scripts/balance-sim.mjs` — 互角 ≈ 囲碁46% / 将棋52%
- ハンデ: `packages/engine/src/handicaps.ts`

## 起動
```bash
npm install
npm run build -w @kuroshiro/engine
npm run dev
npm run dev:server
```

## 検証
- `npm test` / `npm run smoke`
- `npm run analyze:logs`
- `BALANCE_GAMES=80 npx tsx scripts/balance-sim.mjs`

## 次の候補
- 本番デプロイ（Web + 常時 WS） / personal-site 掲載
- ログに基づく継続バランス調整
