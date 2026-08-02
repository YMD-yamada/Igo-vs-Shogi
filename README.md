# 黒白侵攻 / Kuroshiro

囲碁と将棋の非対称対戦ゲーム。スマホ1台の手渡し、CPU戦、オンライン対戦、Web / デスクトップに対応。

## 必要環境

- Node.js 20+

## セットアップ

```bash
npm install
npm run build -w @kuroshiro/engine
```

## 起動

```bash
# Web（PWA対応）
npm run dev

# オンライン用サーバー（別ターミナル）
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
2. **CPU** — あなたは囲碁側
3. **オンライン** — 部屋を作成して6桁コードを共有（サーバー起動が必要）
