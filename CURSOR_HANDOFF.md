# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

## 現状
- ブランチ: `cursor/igo-shogi-hybrid-327a`（PR #2）
- `main` の静的デモを廃し、モノレポで一新済み
- 製品名: **黒白侵攻 / Kuroshiro**

## 実装済み
- `packages/engine` — 囲碁9×9 / 将棋5×5、干渉・圧力・勝敗、CPU、テスト
- `apps/web` — Vite React PWA（ホットシート / CPU / オンライン）
- `apps/server` — WebSocket ルーム（席拘束・切断負け・30秒時限）
- `apps/desktop` — Electron（`npm run dev` 後に `npm run dev:desktop`）

## 検証
- `npm test` / `npm run smoke` 成功
- ブラウザ手動: メニュー・ルール・CPU・手渡しカーテン OK
- `npm run smoke:online`（サーバー起動時）OK

## 起動
```bash
npm install
npm run build -w @kuroshiro/engine
cd apps/web && npx vite --host 127.0.0.1 --port 5173
npm run dev:server
```

## 次の候補
- Vercel へ Web デプロイ + 常時オンラインサーバー（Fly/Railway 等）
- personal-site / ymd-portfolio 掲載
- チュートリアル強化・ハンデ設定
