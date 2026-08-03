# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

更新: 2026-08-03

## 現状
- ブランチ: `cursor/igo-shogi-hybrid-327a`（PR #2）
- 正本パス: `C:\Users\cz7\Projects\Igo-vs-Shogi`
- 製品名: **黒白侵攻 / Kuroshiro**
- `main` の静的デモを廃し、モノレポで一新済み

## 実装済み
- `packages/engine` — 囲碁9×9 / 将棋5×5、干渉・圧力・勝敗、CPU、ハンデプリセット、テスト
- `apps/web` — Vite React PWA（ホットシート / CPU / オンライン / チュートリアル）
- `apps/server` — WebSocket ルーム（席拘束・切断負け・30秒時限）・既定 `:9877`（8787 は cursor-usage-monitor と衝突するため変更）
- `apps/desktop` — Electron（`npm run dev` 後に `npm run dev:desktop`）
- `scripts/dev-web.mjs` — Windows でも Vite フラグが通るルート `npm run dev` ランチャー（既定 `127.0.0.1:5173`）
- root `overrides.rollup` → `@rollup/wasm-node`（Windows ARM64 で native rollup が DLOpen 失敗するため）

## ローカル継続（2026-08-03・Windows）
- clone 済: `cursor/igo-shogi-hybrid-327a` → `C:\Users\cz7\Projects\Igo-vs-Shogi`
- 追加: ハンデ UI・チュートリアル・WS 既定ポート 9877・wasm rollup override
- 検証はセッション中に実行（test / smoke / web 200 / online smoke）

## 起動
```bash
npm install
npm run build -w @kuroshiro/engine
npm run dev
# 追加フラグ例: npm run dev -- --strictPort
npm run dev:server   # ws://127.0.0.1:9877
npm run dev:desktop  # Web 起動後
```

## 人間側の残り
- PR #2 を merge（任意でレビュー）
- Vercel（Web）+ 常時オンラインサーバー（Fly/Railway 等）をデプロイ（`PORT` / `VITE_WS_URL` を合わせる）
- 実機でメニュー／チュートリアル／ハンデ／オンラインを触って確認

## 次の候補
- オンライン部屋へのハンデ共有（現状はローカル／CPUのみ）
- 本番デプロイと personal-site / ymd-portfolio 掲載
