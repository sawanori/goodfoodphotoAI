# Phase 1 Completion: Backend API Verification

## Task Overview
Phase 1 (バックエンド開発) で実施した全てのタスク (T101-T107) の完了を検証する。Cloud Run上のAPI全体が正常に動作し、Phase 2 (フロントエンド開発) に進む準備が整っていることを確認する。

## Dependencies
- T101: Backend Project Structure (完了必須)
- T102: Authentication Middleware (完了必須)
- T103: Image Processing Pipeline (完了必須)
- T104: Gemini AI Integration (完了必須)
- T105: Generate API Endpoint (完了必須)
- T106: Subscription API Endpoint (完了必須)
- T107: Cloud Run Deployment (完了必須)

## Verification Procedure

### Section 1: Cloud Run Deployment Verification

```bash
# Cloud Run サービス確認
gcloud run services describe bananadish-api --region asia-northeast1

# API URL取得
API_URL=$(gcloud run services describe bananadish-api \
  --region asia-northeast1 \
  --format='value(status.url)')

echo "API URL: $API_URL"
```

**期待される結果**: HTTPSのURL (例: https://bananadish-api-xxxxx.run.app)

### Section 2: Health Check Verification

```bash
# ヘルスチェック
curl $API_URL/health

# 期待: {"status":"ok","timestamp":"..."}
```

### Section 3: Authentication Verification

```bash
# Firebase ID token取得 (Firebase Consoleからテストユーザーでログイン)
# または以下のスクリプトで取得
TOKEN="<FIREBASE_ID_TOKEN>"

# 認証付きリクエスト (subscription status)
curl $API_URL/v1/subscription/status \
  -H "Authorization: Bearer $TOKEN"

# 期待: {"tier":"free","status":"inactive","limit":5,"used":0,"remaining":5}
```

### Section 4: Generate API E2E Test

```bash
# テスト画像をアップロードして生成
curl -X POST $API_URL/v1/generate \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test_dish.jpg" \
  -F "aspect=4:5" \
  -F "style=natural" \
  > response.json

# レスポンス確認
cat response.json | jq '.count'
# 期待: 4

cat response.json | jq '.images[0].mime'
# 期待: "image/jpeg"
```

### Section 5: Cloud Logging Verification

```bash
# ログ確認
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=bananadish-api" \
  --limit 50 \
  --format json

# エラーログの確認
gcloud logging read "resource.type=cloud_run_revision \
  AND severity>=ERROR" \
  --limit 20
# 期待: 意図的なエラー以外のERRORログがない
```

## Completion Criteria (DoD)

**T101-T107 全タスク**:
- [ ] Cloud Run サービスがデプロイされている
- [ ] ヘルスチェックエンドポイントが200を返す
- [ ] 認証ミドルウェアが正しく動作する
- [ ] 画像生成APIが4枚の画像を返す
- [ ] サブスクリプションAPIが正しいデータを返す
- [ ] 全てのエラーハンドリングが機能する
- [ ] Cloud Loggingにログが流れている

**品質基準**:
- [ ] API応答時間90パーセンタイルが30秒未満
- [ ] エラーログに未処理の例外がない

## Deliverables

- `docs/verification/phase1-completion-report.md`: Phase 1検証完了レポート
- 本番稼働中のAPI URL

## Notes

- Phase 2 (フロントエンド開発) はこのタスク完了後に開始
- API URLはReact Nativeアプリ設定で使用

## Estimated Time
20-30分
