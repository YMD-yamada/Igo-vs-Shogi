# CURSOR_HANDOFF — Igo-vs-Shogi / 黒白侵攻

## 現状
- `main` は静的デモのみ（未完成）
- 作業ブランチ: `cursor/igo-shogi-hybrid-327a`
- 製品名: **黒白侵攻 / Kuroshiro**
- 方針: 非対称干渉バトル（囲碁9×9 vs 将棋5×5）を TypeScript エンジン中心で一新

## 目標
1. 共有ルールエンジン + 単体テスト
2. Web（スマホホットシート / vs CPU / オンライン）
3. ローカルデスクトップ（Electron）
4. オンラインは WebSocket ルーム

## 構成（予定）
- `packages/engine` — 純関数ルール
- `apps/web` — Vite + React + PWA
- `apps/server` — ws ルームサーバー
- `apps/desktop` — Electron

## 次の作業
- エンジン実装 → UI → オンライン → Electron → 品質ループ
