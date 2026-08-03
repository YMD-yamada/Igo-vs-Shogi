# 黒白侵攻 / Kuroshiro

囲碁と将棋が **同じ 9×9 盤** で直接ぶつかる非対称対戦。スマホ1台の手渡し、CPU戦、オンライン、Web / デスクトップ対応。

## 必要環境

- Node.js 20+

## セットアップ

```bash
npm install
npm run build -w @kuroshiro/engine
```

## 起動

```bash
# Web（PWA対応・既定 127.0.0.1:5173 / Windows でもフラグ転送可）
npm run dev
# 追加 Vite フラグ例: npm run dev -- --strictPort

# オンライン用サーバー（別ターミナル・既定 :9877）
npm run dev:server

# デスクトップ（Electron・先に Web dev を起動）
npm run dev:desktop
```

## テスト / スモーク

```bash
npm test
npm run smoke
```

## 構成

| パス | 内容 |
|---|---|
| `packages/engine` | ルールエンジン（純関数）+ 単体テスト |
| `apps/web` | Vite + React + PWA |
| `apps/server` | WebSocket ルームサーバー |
| `apps/desktop` | Electron ラッパー |
| `docs/DESIGN.md` | ルール概要 |

## 遊び方（最短）

1. **1台で対戦** — 着手後に手渡しカーテンが出ます
2. **CPU** — メニューで CPU が持つ側（囲碁／将棋）を選べます
3. **オンライン** — 部屋を作成して6桁コードを共有（`npm run dev:server` が必要）

## 対局ログ / 長期改善

終局ごとに軽量ログを保存します。詳細は `docs/FEEDBACK_LOOP.md`。

```bash
npm run analyze:logs
```

「フィードバック適用」と依頼すると、ログ集計からバランス調整します。
