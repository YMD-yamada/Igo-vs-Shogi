# CURSOR_HANDOFF — 黒白侵攻 / Kuroshiro

## 現状
- ブランチ: `cursor/igo-shogi-hybrid-327a`（PR #2）
- `main` の静的デモを廃し、モノレポで一新済み
- 製品名: **黒白侵攻 / Kuroshiro**
- 作業パス（この継続ラン）: クラウド VM 上の `/workspace`（= `YMD-yamada/Igo-vs-Shogi`）。ユーザー指定の `C:\Users\cz7\Projects\Igo-vs-Shogi` はこの環境からは未マウント。ローカル Windows では同ブランチをそこに clone/pull して継続。

## 実装済み
- `packages/engine` — 囲碁9×9 / 将棋5×5、干渉・圧力・勝敗、CPU、テスト
- `apps/web` — Vite React PWA（ホットシート / CPU / オンライン）
- `apps/server` — WebSocket ルーム（席拘束・切断負け・30秒時限）・既定 `:8787`
- `apps/desktop` — Electron（`npm run dev` 後に `npm run dev:desktop`）
- `scripts/dev-web.mjs` — Windows でも Vite フラグが通るルート `npm run dev` ランチャー（既定 `127.0.0.1:5173`）

## ローカル継続ラン検証（2026-08-02）
- `git pull` … already up to date → 上記スクリプト修正を追加
- `npm install` OK
- `npm test` OK（11）
- `npm run smoke` OK（engine + web build / PWA）
- Web 応答: `http://127.0.0.1:5173` および `npm run dev -- --port 5199` → 200
- Server: `npm run dev:server` + `npm run smoke:online` → `ONLINE_SMOKE_OK`
- Electron: DISPLAY ありで起動確認後 `timeout` で終了（dbus/GPU 警告のみ・ヘッドレス想定どおり）
- `C:\Users\cz7\Projects\personal-site` … この環境に無し → 掲載スキップ
- 一時プロセスは停止済み（常駐デーモン無し）

## 起動
```bash
npm install
npm run build -w @kuroshiro/engine
npm run dev
# 追加フラグ例: npm run dev -- --strictPort
npm run dev:server
npm run dev:desktop   # Web 起動後
```

## 人間側の残り
- PR #2 を merge
- Vercel（Web）+ 常時オンラインサーバー（Fly/Railway 等）をデプロイ
- Windows 実機の `C:\Users\cz7\Projects\Igo-vs-Shogi` で同ブランチを pull し `npm run dev` を確認
- personal-site / ymd-portfolio 掲載（ローカルに repo があるとき）

## 次の候補
- チュートリアル強化・ハンデ設定
