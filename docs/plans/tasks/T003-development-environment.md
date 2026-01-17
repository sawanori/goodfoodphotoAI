# T003: Development Environment Configuration

## Task Overview
ローカル開発環境を構築し、Gemini APIキーを取得・テストする。全ての機密情報をGCP Secret Managerに安全に格納し、Gitリポジトリを初期化して機密ファイルを除外する。開発用の環境変数テンプレートを作成する。

## Dependencies
- **T001: GCP Project Setup** (完了必須)
  - GCPプロジェクト `bananadish-prod` が存在すること
  - Secret Manager APIが有効化されていること
- **T002: Firebase Project Setup** (完了必須)
  - Firebase Admin SDK秘密鍵 `~/bananadish-firebase-key.json` が存在すること

## Target Files

新規作成:
- `.gitignore` (Git除外設定)
- `.env.template` (環境変数テンプレート)
- `docs/setup/local-dev-guide.md` (ローカル開発ガイド)

## Implementation Steps

### Step 1: Gemini APIキーの取得

1. **Google AI Studioにアクセス**
   ```bash
   open https://makersuite.google.com/app/apikey
   ```

2. **APIキーを作成**
   - 「Create API Key」をクリック
   - プロジェクト: `bananadish-prod` を選択
   - APIキーが表示される (例: `AIzaSy...`)
   - **コピーして安全な場所に一時保管**

3. **APIキーのテスト**
   ```bash
   # 環境変数に一時設定
   export GEMINI_API_KEY="AIzaSy..."

   # curlでテスト呼び出し
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
   ```

   **期待される出力**: 利用可能なモデルのリスト (JSON形式)
   ```json
   {
     "models": [
       {
         "name": "models/gemini-2.0-flash-exp",
         ...
       }
     ]
   }
   ```

### Step 2: Secret Managerへの機密情報格納

1. **Gemini APIキーをSecret Managerに格納**
   ```bash
   # Secret Managerにシークレット作成
   echo -n "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
     --data-file=- \
     --replication-policy="automatic" \
     --project=bananadish-prod

   # 格納されたシークレットの確認
   gcloud secrets describe GEMINI_API_KEY --project=bananadish-prod
   ```

2. **Firebase Admin SDK秘密鍵をSecret Managerに格納**
   ```bash
   # JSONファイル全体をシークレットとして格納
   gcloud secrets create FIREBASE_SERVICE_ACCOUNT \
     --data-file=~/bananadish-firebase-key.json \
     --replication-policy="automatic" \
     --project=bananadish-prod

   # 格納確認
   gcloud secrets describe FIREBASE_SERVICE_ACCOUNT --project=bananadish-prod
   ```

3. **シークレットアクセス権限の確認**
   ```bash
   # T001で作成したサービスアカウントにアクセス権限が付与されているか確認
   gcloud secrets get-iam-policy GEMINI_API_KEY --project=bananadish-prod
   gcloud secrets get-iam-policy FIREBASE_SERVICE_ACCOUNT --project=bananadish-prod

   # 必要に応じて権限付与 (T001で既に付与済みの場合はスキップ)
   gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
     --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=bananadish-prod

   gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT \
     --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=bananadish-prod
   ```

4. **アクセステスト**
   ```bash
   # 自分のアカウントでシークレットにアクセス可能か確認
   gcloud secrets versions access latest --secret="GEMINI_API_KEY" --project=bananadish-prod
   # 期待: Gemini APIキーが表示される

   gcloud secrets versions access latest --secret="FIREBASE_SERVICE_ACCOUNT" --project=bananadish-prod
   # 期待: Firebase Admin SDK JSONが表示される
   ```

5. **ローカルのシークレットファイルを削除**
   ```bash
   # Secret Managerに安全に格納されたため、ローカルファイルは削除
   rm ~/bananadish-firebase-key.json

   # 環境変数もクリア
   unset GEMINI_API_KEY
   ```

### Step 3: Gitリポジトリの初期化

1. **プロジェクトルートで`.gitignore`を作成**

`.gitignore` の内容:

```
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Environment variables
.env
.env.local
.env.*.local

# Firebase
*firebase-key.json
*adminsdk*.json
.firebase/
firebase-debug.log

# Secret files
secrets/
*.pem
*.key
*.p12

# OS
.DS_Store
Thumbs.db

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# Build outputs
dist/
build/
*.log

# Testing
coverage/
.nyc_output/

# Expo (for React Native)
.expo/
.expo-shared/

# iOS
ios/Pods/
ios/build/
*.ipa
*.dSYM.zip
*.dSYM

# Android
android/app/build/
android/build/
*.apk
*.aab

# Misc
*.tgz
.cache/
```

2. **環境変数テンプレートファイルを作成**

`.env.template` の内容:

```bash
# BananaDish Development Environment Template
# Copy this file to .env and fill in the values

# GCP Configuration
GCP_PROJECT_ID=bananadish-prod

# Gemini API (for local development only)
# Production: Fetched from Secret Manager
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration (for local development only)
# Production: Fetched from Secret Manager
FIREBASE_PROJECT_ID=bananadish-prod

# Backend API URL
# Development: http://localhost:8080
# Production: https://bananadish-api-XXXXXX.run.app
API_BASE_URL=http://localhost:8080

# Environment
NODE_ENV=development
```

3. **Gitリポジトリ初期化**
   ```bash
   cd /home/noritakasawada/project/20260117

   # Git初期化
   git init

   # 初回コミット
   git add .gitignore .env.template
   git commit -m "Initial commit: Add .gitignore and .env.template

   - Exclude secrets and sensitive files
   - Add environment variable template for local development

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
   ```

### Step 4: ローカル開発ガイドの作成

`docs/setup/local-dev-guide.md` を作成:

```markdown
# BananaDish Local Development Guide

## Prerequisites

### Required Tools
- Node.js 20 LTS or higher
- npm 10+ or yarn
- gcloud CLI
- Firebase CLI
- Xcode (for iOS development)
- Git

### Installation Verification
\`\`\`bash
node --version        # v20.x+
npm --version         # v10.x+
gcloud --version      # Latest
firebase --version    # Latest
xcode-select -p       # /Applications/Xcode.app/Contents/Developer
\`\`\`

## Initial Setup

### 1. Clone Repository
\`\`\`bash
git clone <repository-url>
cd 20260117
\`\`\`

### 2. Environment Variables
\`\`\`bash
# Copy template
cp .env.template .env

# Edit .env with your values
# DO NOT commit .env to Git
\`\`\`

### 3. GCP Authentication
\`\`\`bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project bananadish-prod

# Application Default Credentials (for local backend development)
gcloud auth application-default login
\`\`\`

### 4. Firebase Authentication
\`\`\`bash
# Login to Firebase
firebase login

# Set project
firebase use bananadish-prod
\`\`\`

## Running Backend Locally (Phase 1)

\`\`\`bash
cd bananadish-backend

# Install dependencies
npm install

# Run in development mode
npm run dev

# Server starts on http://localhost:8080
\`\`\`

## Running Frontend Locally (Phase 2)

\`\`\`bash
cd bananadish-app

# Install dependencies
npm install

# Start Expo
npm start

# Press 'i' for iOS simulator
\`\`\`

## Accessing Secrets Locally

For local development, you can fetch secrets from Secret Manager:

\`\`\`bash
# Fetch Gemini API Key
gcloud secrets versions access latest --secret="GEMINI_API_KEY"

# Add to .env file manually (do not automate this)
\`\`\`

## Security Reminders

- NEVER commit `.env` files
- NEVER commit API keys or secrets
- NEVER commit Firebase service account JSON files
- Use Secret Manager for all sensitive data in production
\`\`\`

### Step 5: 開発ツールのインストール確認

```bash
# Node.js確認
node --version
# 期待: v20.x.x 以上

# npm確認
npm --version
# 期待: v10.x.x 以上

# gcloud CLI確認
gcloud --version
# 期待: Google Cloud SDK xxx.x.x

# Firebase CLI確認
firebase --version
# 期待: 13.x.x 以上

# Xcode確認
xcode-select -p
# 期待: /Applications/Xcode.app/Contents/Developer

# Git確認
git --version
# 期待: git version 2.x.x
```

**不足しているツールがある場合**:
- Node.js: Appendix A (work plan) の手順に従ってインストール
- gcloud CLI: `brew install google-cloud-sdk`
- Firebase CLI: `npm install -g firebase-tools`
- Xcode: App Storeからインストール

## Completion Criteria (DoD)

- [ ] Gemini APIキーが取得され、テスト呼び出しが成功している
- [ ] Gemini APIキーがSecret Manager (`GEMINI_API_KEY`) に格納されている
- [ ] Firebase Admin SDK秘密鍵がSecret Manager (`FIREBASE_SERVICE_ACCOUNT`) に格納されている
- [ ] ローカルのシークレットファイル (`~/bananadish-firebase-key.json`) が削除されている
- [ ] `.gitignore` ファイルが作成され、機密ファイルが除外されている
- [ ] `.env.template` ファイルが作成されている
- [ ] Gitリポジトリが初期化され、初回コミットが完了している
- [ ] `docs/setup/local-dev-guide.md` が作成されている
- [ ] 全ての開発ツール (Node.js, gcloud, Firebase CLI, Xcode, Git) がインストール済み

## Verification Commands

```bash
# Secret Managerのシークレット一覧
gcloud secrets list --project=bananadish-prod
# 期待: GEMINI_API_KEY と FIREBASE_SERVICE_ACCOUNT が表示される

# シークレットアクセステスト
gcloud secrets versions access latest --secret="GEMINI_API_KEY" --project=bananadish-prod
# 期待: APIキーが表示される (AIzaSy... 形式)

# ローカルファイルが削除されているか確認
ls ~/bananadish-firebase-key.json
# 期待: No such file or directory

# Git初期化確認
git log --oneline
# 期待: Initial commit が表示される

# .gitignoreの確認
git check-ignore .env
# 期待: .env (除外されている)

git check-ignore node_modules
# 期待: node_modules (除外されている)

# 開発ツール確認
node --version && npm --version && gcloud --version && firebase --version && xcode-select -p && git --version
# 期待: 全てのバージョン情報が表示される
```

## Troubleshooting

### 問題: Gemini APIキーのテストでエラー
**解決策**:
```bash
# APIキーの形式確認 (AIzaSy で始まる)
echo $GEMINI_API_KEY

# Generative Language APIが有効化されているか確認
gcloud services list --enabled | grep generativelanguage
# 有効化されていない場合:
gcloud services enable generativelanguage.googleapis.com
```

### 問題: Secret Managerへのアクセスでエラー
**解決策**:
```bash
# 自分のアカウントに権限を追加
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/secretmanager.secretAccessor" \
  --project=bananadish-prod
```

### 問題: Git初期化でファイルが追加されない
**解決策**:
```bash
# ステータス確認
git status

# 強制追加が必要な場合
git add -f .gitignore .env.template

# コミット
git commit -m "Initial commit"
```

## Deliverables

- Secret Manager格納済み:
  - `GEMINI_API_KEY` (Gemini APIキー)
  - `FIREBASE_SERVICE_ACCOUNT` (Firebase Admin SDK JSON)
- Gitリポジトリ: 初期化済み、初回コミット完了
- `.gitignore`: 機密ファイル除外設定
- `.env.template`: 環境変数テンプレート
- `docs/setup/local-dev-guide.md`: ローカル開発ガイド

## Notes

- **セキュリティ最優先**: 機密情報は全てSecret Managerに格納
- ローカル開発時は `.env` ファイルを使用するが、絶対にコミットしない
- Phase 1 (T101-T107) でバックエンド開発時にSecret Managerからシークレットを取得
- Cloud Runデプロイ時 (T107) はSecret Managerから自動的に環境変数として注入

## Estimated Time
30-45分
