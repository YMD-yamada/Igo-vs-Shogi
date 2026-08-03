# 黒白侵攻 / Kuroshiro

囲碁と将棋の非対称対戦ゲーム。スマホ1台の手渡し、CPU戦、オンライン対戦、Web / デスクトップ / ストア向けネイティブに対応。

- Web: https://kuroshiro-omega.vercel.app
- ストア準備: `docs/RELEASE_FLOW.md` / `mobile/store/`

## 必要環境

- Node.js 20+
- ストア実機ビルド: Android Studio / Xcode（iOS は macOS）

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

# ネイティブ（Capacitor・静的バンドル）
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
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
| `mobile/` | Capacitor（`app.ymd.kuroshiro`） |
| `docs/DESIGN.md` | ルール概要 |
| `docs/RELEASE_FLOW.md` | App Store / Play 公開手順 |

## 遊び方（最短）

1. **1台で対戦** — 着手後に手渡しカーテンが出ます
2. **CPU** — あなたは囲碁側
3. **オンライン** — `VITE_WS_URL`（またはローカル `npm run dev:server`）があるときのみ。部屋コードを共有
