# T107: Cloud Run Deployment Configuration

## Task Overview
BananaDish BackendをGoogle Cloud Runにデプロイする。Cloud BuildによるCI/CDパイプラインを構築し、Secret Managerからの環境変数読み込み、適切なリソース設定、CORS設定を行う。本番環境で稼働可能な状態にする。

## Dependencies
- **T101**: Backend Project Structure Setup (完了していること)
- **T102**: Authentication Middleware (完了していること)
- **T103**: Image Processing Pipeline (完了していること)
- **T104**: Gemini AI Integration (完了していること)
- **T105**: Generate API Endpoint (完了していること)
- **T106**: Subscription API Endpoint (完了していること)
- **T001**: GCP Project Setup (完了していること)
- **T003**: Development Environment Configuration (Secrets設定済み)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/Dockerfile` (新規作成)
- `bananadish-backend/.dockerignore` (新規作成)
- `bananadish-backend/cloudbuild.yaml` (新規作成)
- `bananadish-backend/src/server.ts` (CORS設定追加)
- `bananadish-backend/deploy.sh` (デプロイスクリプト)

## Implementation Steps

### Step 1: Dockerfileの作成

`Dockerfile` を作成:

```dockerfile
# Multi-stage build for optimization
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-slim

# Install dumb-init (proper signal handling)
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Use non-root user for security
USER node

# Expose port
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
```

### Step 2: .dockerignoreの作成

`.dockerignore` を作成:

```
node_modules
npm-debug.log
dist
.git
.gitignore
.env
.env.*
README.md
tests
*.test.ts
coverage
.vscode
.idea
*.log
.DS_Store
test-assets
scripts
docs
output-*
```

### Step 3: Cloud Build設定ファイルの作成

`cloudbuild.yaml` を作成:

```yaml
steps:
  # Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/bananadish-backend:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/bananadish-backend:latest'
      - '.'

  # Push the Docker image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/bananadish-backend:$COMMIT_SHA'

  # Push latest tag
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/bananadish-backend:latest'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'bananadish-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/bananadish-backend:$COMMIT_SHA'
      - '--region'
      - 'asia-northeast1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--timeout'
      - '60s'
      - '--concurrency'
      - '10'
      - '--min-instances'
      - '1'
      - '--max-instances'
      - '10'
      - '--service-account'
      - 'bananadish-backend@$PROJECT_ID.iam.gserviceaccount.com'
      - '--set-secrets'
      - 'GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase-sa'
      - '--update-env-vars'
      - 'NODE_ENV=production,PORT=8080'

images:
  - 'gcr.io/$PROJECT_ID/bananadish-backend:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/bananadish-backend:latest'

options:
  logging: CLOUD_LOGGING_ONLY
```

### Step 4: CORS設定の追加

`src/server.ts` を更新してCORSを設定:

```typescript
import express from 'express';
import cors from 'cors';
import { initializeFirebase } from './firebase';
import { initializeReceiptValidator } from './services/receiptValidator';
import { generateHandler } from './routes/generate';
import subscriptionRouter from './routes/subscription';

// 初期化
initializeFirebase();
initializeReceiptValidator();

const app = express();
const port = process.env.PORT || 8080;

// CORS設定
const corsOptions = {
  origin: [
    'http://localhost:8081', // Expo開発サーバー
    'exp://localhost:8081',  // Expo iOS
    // 本番環境のドメインを追加予定
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('ok');
});

// API endpoints
app.post('/v1/generate', ...generateHandler);
app.use('/v1/subscription', subscriptionRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'サーバーエラーが発生しました',
      retryable: true,
    },
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
```

CORSパッケージをインストール:

```bash
npm install cors
npm install --save-dev @types/cors
```

### Step 5: デプロイスクリプトの作成

`deploy.sh` を作成:

```bash
#!/bin/bash

# BananaDish Backend Deployment Script

set -e  # Exit on error

PROJECT_ID="bananadish-prod"
REGION="asia-northeast1"
SERVICE_NAME="bananadish-api"

echo "🚀 Deploying BananaDish Backend to Cloud Run..."

# Set project
gcloud config set project $PROJECT_ID

# Check if secrets exist
echo "✓ Checking secrets..."
gcloud secrets describe GEMINI_API_KEY --quiet || {
  echo "❌ Error: GEMINI_API_KEY secret not found. Run T003 first."
  exit 1
}

# Build and submit to Cloud Build
echo "✓ Building Docker image..."
gcloud builds submit --config cloudbuild.yaml .

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test the deployment:"
echo "  curl $SERVICE_URL/health"
echo ""
```

実行権限を付与:

```bash
chmod +x deploy.sh
```

### Step 6: Secret Managerの設定確認

T003で作成したSecretsが存在することを確認:

```bash
# Secretsの確認
gcloud secrets list

# 期待される結果:
# - GEMINI_API_KEY
# - FIREBASE_SERVICE_ACCOUNT (optional)

# Secretの内容確認 (値は表示されない)
gcloud secrets describe GEMINI_API_KEY
```

Secretが存在しない場合は作成:

```bash
# Gemini API Key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

# サービスアカウントにアクセス権を付与
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 7: 初回デプロイの実行

```bash
cd bananadish-backend

# デプロイスクリプト実行
./deploy.sh

# または、手動でCloud Buildを実行
gcloud builds submit --config cloudbuild.yaml .
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `Dockerfile` がマルチステージビルドで最適化されている
- [ ] `.dockerignore` で不要なファイルを除外している
- [ ] `cloudbuild.yaml` でCI/CDパイプラインが構成されている
- [ ] Cloud Run サービスが以下の設定でデプロイされている:
  - [ ] リージョン: asia-northeast1
  - [ ] メモリ: 2 GiB
  - [ ] CPU: 2
  - [ ] タイムアウト: 60秒
  - [ ] 並行処理数: 10
  - [ ] 最小インスタンス: 1 (コールドスタート回避)
  - [ ] 最大インスタンス: 10
  - [ ] サービスアカウント: bananadish-backend
- [ ] 環境変数が設定されている:
  - [ ] GEMINI_API_KEY (Secret Managerから)
  - [ ] NODE_ENV=production
  - [ ] PORT=8080
- [ ] CORS設定が適切に構成されている
- [ ] エラーハンドリングミドルウェアが追加されている
- [ ] サービスがHTTPSでアクセス可能
- [ ] Health checkエンドポイントが200 OKを返す
- [ ] 全APIエンドポイントが動作する

## Verification Commands

### ローカルでDockerイメージをテスト

```bash
# Dockerイメージをビルド
docker build -t bananadish-backend .

# コンテナを起動 (環境変数を設定)
docker run -p 8080:8080 \
  -e GEMINI_API_KEY="your_api_key" \
  -e NODE_ENV=production \
  bananadish-backend

# 別のターミナルでテスト
curl http://localhost:8080/health
# 期待: "ok"
```

### Cloud Runデプロイ後の検証

```bash
# サービスの詳細確認
gcloud run services describe bananadish-api --region asia-northeast1

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe bananadish-api \
  --region=asia-northeast1 \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# 1. Health check
curl $SERVICE_URL/health
# 期待: "ok"

# 2. サブスクリプション状態取得 (要認証)
curl $SERVICE_URL/v1/subscription/status \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
# 期待: 200 OK with JSON

# 3. 画像生成テスト (要認証)
curl -X POST $SERVICE_URL/v1/generate \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -F "image=@test-assets/sample-dish.jpg" \
  -F "aspect=4:5" \
  -F "style=natural"
# 期待: 200 OK with 4 images in JSON

# 4. Cloud Loggingの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bananadish-api" \
  --limit 50 \
  --format json

# 5. メトリクス確認
# Cloud Console → Cloud Run → bananadish-api → Metrics
# - Request count
# - Request latency
# - Container instance count
# - Memory utilization
```

### パフォーマンステスト

```bash
# 複数リクエストを送信してレイテンシを測定
for i in {1..5}; do
  time curl $SERVICE_URL/health
done

# 期待: 各リクエストが1秒以内に完了 (min-instances=1の場合)
```

## Troubleshooting

### 問題: "Permission denied" during deployment

**原因**: サービスアカウントの権限不足

**解決策**:
```bash
# Cloud Run Admin権限を付与
gcloud projects add-iam-policy-binding bananadish-prod \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Secret Manager Secret Accessor権限を確認
gcloud secrets get-iam-policy GEMINI_API_KEY
```

### 問題: "Secret not found" エラー

**原因**: Secret ManagerにSecretが存在しない

**解決策**:
```bash
# Secretを作成 (T003参照)
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

# アクセス権を付与
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 問題: CORSエラー (ブラウザ/アプリから)

**原因**: CORS設定が不足

**解決策**:
```typescript
// src/server.ts で CORS originを追加
const corsOptions = {
  origin: [
    'http://localhost:8081',
    'https://your-production-domain.com', // 本番ドメイン
  ],
  // ...
};
```

### 問題: コールドスタートが遅い (5秒以上)

**原因**: 最小インスタンス数が0

**解決策**:
```bash
# 最小インスタンスを1に設定 (cloudbuild.yaml で設定済み)
gcloud run services update bananadish-api \
  --region asia-northeast1 \
  --min-instances 1
```

### 問題: メモリ不足エラー

**原因**: Sharp画像処理がメモリを大量消費

**解決策**:
```bash
# メモリを増やす (現在2GiB → 4GiB)
gcloud run services update bananadish-api \
  --region asia-northeast1 \
  --memory 4Gi
```

## Deliverables

- Dockerfile: マルチステージビルドで最適化
- .dockerignore: 不要ファイル除外
- cloudbuild.yaml: CI/CDパイプライン
- deploy.sh: デプロイスクリプト
- 更新されたserver.ts: CORS設定追加
- 稼働中のCloud Runサービス: bananadish-api

## Cost Estimation

**想定トラフィック** (500 MAU, 30 generations/user/month):

| 項目 | 使用量 | 月額コスト (円) |
|------|--------|----------------|
| Cloud Run CPU | 2 vCPU × 15,000 requests × 20秒 | ~¥3,000 |
| Cloud Run メモリ | 2 GiB × 15,000 requests × 20秒 | ~¥2,000 |
| Cloud Run リクエスト | 15,000 requests | ~¥100 |
| 最小インスタンス | 1 instance × 24h × 30days | ~¥3,000 |
| **合計** | | **~¥8,000** |

**コスト削減策**:
- 最小インスタンスを0に (コールドスタート許容)
- メモリを1GiBに削減 (パフォーマンス要確認)
- リージョンをus-central1に変更 (若干安い)

## Notes

- **セキュリティ**: サービスアカウントを使用し、最小権限の原則を適用
- **スケーラビリティ**: 自動スケーリングで最大10インスタンスまで対応
- **可用性**: 最小インスタンス1でコールドスタート回避 (レスポンス高速化)
- **監視**: Cloud Loggingで全リクエストをログ記録
- **CI/CD**: Cloud Buildで自動ビルド・デプロイ
- **次のステップ**: Phase 2でReact NativeアプリからこのAPIを呼び出す

## Estimated Time
2-3時間 (初回デプロイ・検証・トラブルシューティング含む)
