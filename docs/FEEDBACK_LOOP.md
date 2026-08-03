# フィードバック循環 — 長期バランス改善

黒白侵攻を「遊びながら良くする」ための軽量ログ運用。

## 何が残るか

各対局の終了時に **MatchLog v1**（JSON 1行）を保存する。

| 出典 | 保存先 |
|------|--------|
| CPU / ホットシート / クライアント | ブラウザ `localStorage`（最大250局） |
| 同上（サーバー起動時） | `POST /api/match-logs` → `data/match-logs/YYYY-MM-DD.jsonl` |
| オンライン対局 | サーバーが自動で同ディレクトリへ追記 |

ログには手数・勝敗・設定・ハンデ・圧縮棋譜（`plies`）が入る。盤面フル履歴は持たない。

## プレイヤー操作

1. メニューで **CPU側**（囲碁／将棋）とハンデを選んで対戦
2. オンラインは部屋作成／コード参加
3. メニュー「対局ログ」から件数確認・**JSONL書き出し**
4. 書き出したファイルを `data/match-logs/` に置く（任意）

## エージェント向け（「フィードバック適用」）

ユーザーがフィードバック適用を依頼したら:

1. `npx tsx scripts/analyze-logs.mjs`（必要なら追加の jsonl パス）
2. 勝率・手数・捕獲数の偏りを読む
3. `packages/engine` の閾値／AI／ルールを調整
4. `BALANCE_GAMES=80 npx tsx scripts/balance-sim.mjs` で CPU↔CPU 再確認
5. `npm test` / `npm run smoke`
6. `CURSOR_HANDOFF.md` に変更要点を残す

## コマンド

```bash
npm run dev:server          # ログ受信 + オンライン
npm run analyze:logs        # 集計
BALANCE_GAMES=80 npx tsx scripts/balance-sim.mjs
```
