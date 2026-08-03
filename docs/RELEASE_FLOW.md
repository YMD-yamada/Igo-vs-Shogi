# 黒白侵攻 — ストア公開フロー

エージェントが実施する。ユーザーには Apple / Google の本人ログインと課金承認だけを依頼する。

## 成果物

| 項目 | 場所 |
|---|---|
| Web 本番 | https://kuroshiro-omega.vercel.app |
| Capacitor | `mobile/`（`app.ymd.kuroshiro`） |
| 申請文面 | `mobile/store/app-store.md` / `google-play.md` |
| 法務ハブ | personal-site（privacy / terms / support） |
| アイコン原寸 | `mobile/assets/icon.png` |

## ローカル準備

```bash
npm install
npm run build:web
cd mobile && npm install
npm run prepare:native
# Android Studio / Xcode（実機 or エミュ）
npm run cap:android
npm run cap:ios   # macOS + Xcode 必須
```

## 申請前チェック

1. `npm test && npm run smoke`
2. `mobile` で `prepare:native` 成功
3. ホットシート / CPU / チュートリアル / ハンデが動作
4. オンライン UI は `VITE_WS_URL` 未設定時は非表示
5. スクショをストア用サイズで撮影（デバッグ依頼時に実施可）
6. personal-site の `platforms` に ios / android があること

## 人間必須

- Apple Developer / Google Play Console へのログインと初回アップロード承認
- 有料枠・税務・年齢レーティング最終確認
- 署名鍵（Play App Signing / iOS 証明書）の本人操作

## デバッグ後の流れ

1. 修正 → `npm run smoke` → `mobile` `prepare:native`
2. 内部テスト / TestFlight
3. 本番提出
4. ストア URL が付いたら personal-site `storeUrls` と portfolio を更新
