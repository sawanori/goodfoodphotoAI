# T102: Authentication Middleware Implementation

## Task Overview
Firebase ID token検証ミドルウェアを実装し、Cloud Run APIエンドポイントへのリクエストを認証できるようにする。Firebase Admin SDKを使用してトークンを検証し、リクエストオブジェクトにユーザー情報をアタッチする。

## Dependencies
- **T101**: Backend Project Structure Setup (完了していること)
- **T002**: Firebase Project Setup (完了していること)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/src/firebase.ts` (新規作成)
- `bananadish-backend/src/middleware/auth.ts` (新規作成)
- `bananadish-backend/tests/middleware/auth.test.ts` (新規作成)
- `bananadish-backend/package.json` (依存関係追加)

## Implementation Steps

### Step 1: Firebase Admin SDK依存関係の追加

```bash
cd bananadish-backend

# Firebase Admin SDKをインストール
npm install firebase-admin@^12.5.0

# テスト用依存関係
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### Step 2: Firebase Admin SDKの初期化

`src/firebase.ts` を作成:

```typescript
import admin from 'firebase-admin';

// Firebase Admin SDKの初期化
// Cloud Runでは環境変数GOOGLE_APPLICATION_CREDENTIALSが自動設定される
// ローカル開発ではサービスアカウントキーファイルが必要

let initialized = false;

export function initializeFirebase() {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialized = true;
    console.log('Firebase Admin SDK initialized');
  }
  return admin;
}

// インスタンスをエクスポート
export const firebaseAdmin = admin;
```

### Step 3: 認証ミドルウェアの実装

`src/middleware/auth.ts` を作成:

```typescript
import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../firebase';

// Requestオブジェクトを拡張してuserプロパティを追加
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string | undefined;
      };
    }
  }
}

/**
 * Firebase ID token検証ミドルウェア
 *
 * Authorizationヘッダーから Bearer tokenを抽出し、
 * Firebase Admin SDKで検証する。
 *
 * 成功時: req.userにユーザー情報をアタッチしてnext()
 * 失敗時: 401 UNAUTHORIZEDレスポンスを返す
 */
export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Authorizationヘッダーの取得
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);

    if (!match) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization headerが見つからないか、形式が不正です',
          retryable: false,
        },
      });
      return;
    }

    const idToken = match[1];

    // Firebase ID tokenの検証
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    // ユーザー情報をrequestオブジェクトにアタッチ
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    // 次のミドルウェアまたはハンドラーへ
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error);

    // エラーの種類に応じたレスポンス
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: '認証トークンが期限切れです。再ログインしてください',
          retryable: false,
        },
      });
      return;
    }

    if (error.code === 'auth/argument-error') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: '認証トークンの形式が不正です',
          retryable: false,
        },
      });
      return;
    }

    // その他のエラー
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: '認証に失敗しました',
        retryable: false,
      },
    });
  }
}
```

### Step 4: ユニットテストの作成

`tests/middleware/auth.test.ts` を作成:

```typescript
import { Request, Response } from 'express';
import { verifyAuth } from '../../src/middleware/auth';
import { firebaseAdmin } from '../../src/firebase';

// Firebase Admin SDKをモック
jest.mock('../../src/firebase', () => ({
  firebaseAdmin: {
    auth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
    }),
  },
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('should pass with valid token', async () => {
    // モックの設定
    mockRequest.headers = {
      authorization: 'Bearer valid-token',
    };

    const mockDecodedToken = {
      uid: 'test-user-123',
      email: 'test@example.com',
    };

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockResolvedValue(
      mockDecodedToken
    );

    // ミドルウェアを実行
    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // 検証
    expect(mockRequest.user).toEqual({
      uid: 'test-user-123',
      email: 'test@example.com',
    });
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should reject missing Authorization header', async () => {
    mockRequest.headers = {};

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject malformed Authorization header', async () => {
    mockRequest.headers = {
      authorization: 'InvalidFormat token',
    };

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject expired token', async () => {
    mockRequest.headers = {
      authorization: 'Bearer expired-token',
    };

    const expiredError: any = new Error('Token expired');
    expiredError.code = 'auth/id-token-expired';

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockRejectedValue(
      expiredError
    );

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'TOKEN_EXPIRED',
      }),
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject invalid token', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token',
    };

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockRejectedValue(
      new Error('Invalid token')
    );

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
```

### Step 5: Jestの設定

`jest.config.js` を作成:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Step 6: package.jsonにテストスクリプト追加

`package.json` の `scripts` セクションに追加:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Step 7: server.tsでFirebaseを初期化

`src/server.ts` を更新してFirebaseを初期化:

```typescript
import express from 'express';
import { initializeFirebase } from './firebase';

// Firebase初期化
initializeFirebase();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('ok');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `firebase-admin` パッケージがインストールされている
- [ ] `src/firebase.ts` でFirebase Admin SDKが初期化されている
- [ ] `src/middleware/auth.ts` で認証ミドルウェアが実装されている
- [ ] ミドルウェアが以下を実装している:
  - [ ] Authorization headerからBearer tokenを抽出
  - [ ] Firebase Admin SDKでtokenを検証
  - [ ] 成功時に `req.user` にユーザー情報をアタッチ
  - [ ] 失敗時に401レスポンスを返す
- [ ] トークン期限切れエラーを適切にハンドリングしている
- [ ] ユニットテストが作成され、以下のシナリオをカバーしている:
  - [ ] 有効なトークンで認証成功
  - [ ] Authorization header欠落で401
  - [ ] 不正な形式のheaderで401
  - [ ] 期限切れトークンで401
  - [ ] 無効なトークンで401
- [ ] テストカバレッジが70%以上

## Verification Commands

```bash
# テストの実行
cd bananadish-backend
npm test -- auth.test.ts

# カバレッジ確認
npm run test:coverage

# ビルド確認
npm run build

# 期待される結果:
# - 全テストがpass
# - カバレッジ70%以上
# - TypeScriptのコンパイルエラーなし
```

**手動テスト** (T101でサーバーが起動できる場合):

```bash
# サーバー起動
npm start

# 別のターミナルで認証テスト

# 1. Authorization header なし (401が返るべき)
curl http://localhost:8080/v1/test-protected \
  -v

# 2. 不正な形式 (401が返るべき)
curl http://localhost:8080/v1/test-protected \
  -H "Authorization: InvalidFormat token" \
  -v

# 3. 有効なFirebase ID token (実際のFirebaseプロジェクトから取得)
# Firebase コンソールでテストユーザーを作成し、ID tokenを取得
curl http://localhost:8080/v1/test-protected \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -v
```

**テスト用エンドポイント** (server.tsに一時的に追加):

```typescript
import { verifyAuth } from './middleware/auth';

app.get('/v1/test-protected', verifyAuth, (req, res) => {
  res.json({
    message: '認証成功',
    user: req.user,
  });
});
```

## Troubleshooting

### 問題: "Firebase Admin SDK initialization failed"

**原因**: サービスアカウント認証情報が設定されていない

**解決策**:
```bash
# ローカル開発の場合: サービスアカウントキーをダウンロード
# Firebase Console → Project Settings → Service accounts → Generate new private key

# 環境変数を設定
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

# または、firebase.tsを以下のように変更 (開発環境のみ)
admin.initializeApp({
  credential: admin.credential.cert(require('/path/to/serviceAccountKey.json')),
});
```

### 問題: テストで "Cannot find module"

**解決策**:
```bash
# TypeScript型定義を追加
npm install --save-dev @types/node @types/express

# tsconfig.jsonで "esModuleInterop": true を確認
```

### 問題: "auth/id-token-expired" エラーが常に発生

**原因**: テスト用トークンが期限切れ

**解決策**:
```bash
# Firebaseコンソールで新しいID tokenを取得
# または、Firebase Auth SDKを使用してプログラム的にtokenを生成
```

## Deliverables

- Firebase Admin SDK初期化モジュール: `src/firebase.ts`
- 認証ミドルウェア: `src/middleware/auth.ts`
- ユニットテスト: `tests/middleware/auth.test.ts`
- テスト設定: `jest.config.js`
- カバレッジ70%以上のテスト結果

## Notes

- **セキュリティ**: サービスアカウントキーファイルは絶対にGitにコミットしない (`.gitignore`に追加済みであることを確認)
- **Cloud Run**: 本番環境ではサービスアカウントが自動的にアタッチされるため、`applicationDefault()`で問題なく動作する
- **トークンリフレッシュ**: Firebase SDK (クライアント側) がトークンを自動的にリフレッシュするため、バックエンド側での対応は不要
- **次のタスク**: このミドルウェアはT105, T106で使用される

## Estimated Time
2-3時間 (テスト含む)
