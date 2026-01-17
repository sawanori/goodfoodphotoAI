# T101: Backend Project Structure Setup

## Task Overview
Node.js + Express + TypeScriptのバックエンドプロジェクトを初期化し、基本的なサーバー構造を構築する。Cloud Runにデプロイ可能なDockerfileを作成し、ヘルスチェックエンドポイントを実装する。

## Dependencies
- **T003: Development Environment** (完了必須)
  - Gitリポジトリが初期化されていること
  - `.gitignore` が存在すること

## Target Files

新規作成:
- `bananadish-backend/package.json`
- `bananadish-backend/tsconfig.json`
- `bananadish-backend/.eslintrc.js`
- `bananadish-backend/.prettierrc`
- `bananadish-backend/src/server.ts`
- `bananadish-backend/Dockerfile`
- `bananadish-backend/.dockerignore`
- `bananadish-backend/README.md`

## Implementation Steps

### Step 1: プロジェクトディレクトリ作成

```bash
# プロジェクトルートに移動
cd /home/noritakasawada/project/20260117

# バックエンドディレクトリ作成
mkdir -p bananadish-backend/src
cd bananadish-backend
```

### Step 2: package.json作成

```bash
npm init -y
```

`package.json` を以下の内容で編集:

```json
{
  "name": "bananadish-backend",
  "version": "1.0.0",
  "description": "BananaDish Cloud Run API Proxy",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest"
  },
  "keywords": ["cloud-run", "express", "gemini-api"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.19.2",
    "@google/generative-ai": "^0.7.0",
    "sharp": "^0.33.5",
    "multer": "^1.4.5-lts.1",
    "firebase-admin": "^12.5.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0",
    "ts-node-dev": "^2.0.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.5.0",
    "@typescript-eslint/eslint-plugin": "^7.5.0",
    "prettier": "^3.2.5",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12",
    "ts-jest": "^29.1.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Step 3: 依存関係インストール

```bash
npm install
```

### Step 4: TypeScript設定

`tsconfig.json` を作成:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Step 5: ESLint設定

`.eslintrc.js` を作成:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
```

### Step 6: Prettier設定

`.prettierrc` を作成:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Step 7: 基本的なExpressサーバー実装

`src/server.ts` を作成:

```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'BananaDish API',
    version: '1.0.0',
    status: 'running',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`BananaDish API running on port ${PORT}`);
});

export default app;
```

### Step 8: Dockerfile作成

`Dockerfile` を作成:

```dockerfile
# Build stage
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

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run the application
CMD ["node", "dist/server.js"]
```

### Step 9: .dockerignore作成

`.dockerignore` を作成:

```
node_modules
npm-debug.log
dist
.git
.gitignore
.env
.env.local
*.md
.vscode
.idea
coverage
.nyc_output
**/*.test.ts
**/*.spec.ts
```

### Step 10: README作成

`README.md` を作成:

```markdown
# BananaDish Backend API

Cloud Run API proxy for BananaDish food photo enhancement app.

## Tech Stack

- Node.js 20 LTS
- Express 4.x
- TypeScript 5.x
- Sharp (image processing)
- Gemini 2.5 Flash Image API
- Firebase Admin SDK

## Development

### Prerequisites

- Node.js 20+
- npm 10+
- gcloud CLI (for deployment)

### Setup

\`\`\`bash
npm install
\`\`\`

### Run Locally

\`\`\`bash
npm run dev
# Server runs on http://localhost:8080
\`\`\`

### Build

\`\`\`bash
npm run build
\`\`\`

### Test

\`\`\`bash
npm test
\`\`\`

## Deployment

See T107 task for Cloud Run deployment instructions.

## Endpoints

- \`GET /health\`: Health check
- \`GET /\`: Service info
- \`POST /v1/generate\`: Generate enhanced food photos (T105)
- \`GET /v1/subscription/status\`: Get subscription status (T106)

## Environment Variables

- \`PORT\`: Server port (default: 8080)
- \`GEMINI_API_KEY\`: Gemini API key (from Secret Manager)
- \`FIREBASE_SERVICE_ACCOUNT\`: Firebase Admin SDK JSON (from Secret Manager)
```

### Step 11: ローカル動作確認

```bash
# TypeScriptビルド
npm run build

# サーバー起動
npm start
```

別のターミナルで:

```bash
# ヘルスチェック
curl http://localhost:8080/health
# 期待: {"status":"ok","timestamp":"..."}

# ルートエンドポイント
curl http://localhost:8080/
# 期待: {"service":"BananaDish API","version":"1.0.0","status":"running"}
```

### Step 12: Dockerビルドテスト

```bash
# Dockerイメージビルド
docker build -t bananadish-backend:test .

# コンテナ起動
docker run -p 8080:8080 bananadish-backend:test
```

別のターミナルで:

```bash
# ヘルスチェック
curl http://localhost:8080/health
# 期待: 正常なレスポンス
```

## Completion Criteria (DoD)

- [ ] `bananadish-backend/` ディレクトリが作成されている
- [ ] `package.json` に全ての必要な依存関係が含まれている
- [ ] TypeScript設定 (`tsconfig.json`) が完了している
- [ ] ESLint/Prettier設定が完了している
- [ ] `src/server.ts` でExpressサーバーが実装されている
- [ ] `/health` エンドポイントが実装されている
- [ ] `Dockerfile` が作成されている
- [ ] `.dockerignore` が作成されている
- [ ] ローカルでサーバーが起動する (npm start)
- [ ] ヘルスチェックエンドポイントが200 OKを返す
- [ ] Dockerビルドが成功する
- [ ] TypeScriptコンパイルエラーがない

## Verification Commands

```bash
# プロジェクト構造確認
tree bananadish-backend -L 2

# TypeScriptコンパイル確認
cd bananadish-backend && npm run build
# 期待: エラーなく dist/ にファイル生成

# ESLint確認
npm run lint
# 期待: エラーなし

# ローカル起動確認
npm start &
sleep 3
curl http://localhost:8080/health
# 期待: {"status":"ok",...}

# Dockerビルド確認
docker build -t bananadish-backend:test .
# 期待: Successfully built ...
```

## Troubleshooting

### 問題: npm installでエラー
**解決策**:
```bash
# npmキャッシュクリア
npm cache clean --force

# 再インストール
rm -rf node_modules package-lock.json
npm install
```

### 問題: TypeScriptコンパイルエラー
**解決策**:
```bash
# TypeScriptバージョン確認
npx tsc --version

# tsconfig.jsonの文法チェック
npx tsc --showConfig
```

### 問題: Dockerビルドが遅い
**解決策**:
- `.dockerignore` にnode_modulesが含まれているか確認
- マルチステージビルドで不要なファイルを削除

## Deliverables

- `bananadish-backend/` プロジェクト (完全なディレクトリ構造)
- 動作するExpressサーバー (ヘルスチェックエンドポイント含む)
- Cloud Runデプロイ可能なDockerfile

## Notes

- このタスクは**Phase 1の基盤**となる
- T102-T106で機能を追加していく
- `.gitignore` に `node_modules/` と `dist/` が含まれていることを確認
- 次のタスク (T102-T104) は並列実行可能

## Estimated Time
30-45分
