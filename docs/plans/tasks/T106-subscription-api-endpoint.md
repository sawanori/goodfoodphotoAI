# T106: Subscription API Endpoint Implementation

## Task Overview
GET /v1/subscription/status エンドポイントとPOST /v1/subscription/validate-receipt エンドポイントを実装し、サブスクリプション状態の取得とApple IAPレシート検証機能を提供する。

## Dependencies
- **T102**: Authentication Middleware (完了していること)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/src/routes/subscription.ts` (新規作成)
- `bananadish-backend/src/services/receiptValidator.ts` (新規作成)
- `bananadish-backend/src/server.ts` (ルート追加)
- `bananadish-backend/tests/routes/subscription.test.ts` (新規作成)
- `bananadish-backend/package.json` (依存関係追加)

## Implementation Steps

### Step 1: 必要な依存関係の追加

```bash
cd bananadish-backend

# Apple IAP レシート検証用ライブラリ
npm install node-apple-receipt-verify@^1.12.1
```

### Step 2: Receipt Validatorの実装

`src/services/receiptValidator.ts` を作成:

```typescript
import iap from 'node-apple-receipt-verify';
import { firebaseAdmin } from '../firebase';

const db = firebaseAdmin.firestore();

/**
 * Apple IAPレシート検証の初期化
 */
export function initializeReceiptValidator() {
  iap.config({
    // 本番環境かどうか
    environment: ['production', 'sandbox'],
    // 本番 → サンドボックスの自動フォールバック有効
    excludeOldTransactions: true,
    // 古いトランザクションは除外
    extended: true,
    // 詳細情報を取得
  });

  console.log('Receipt validator initialized');
}

/**
 * レシート検証結果
 */
export interface ValidationResult {
  valid: boolean;
  productId?: string;
  expiresDate?: Date;
  originalTransactionId?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * Appleレシートを検証
 *
 * @param receiptData Base64エンコードされたレシート
 * @returns 検証結果
 */
export async function validateReceipt(
  receiptData: string
): Promise<ValidationResult> {
  try {
    const receipt = {
      data: receiptData,
    };

    // Appleのサーバーでレシート検証
    const validationResponse = await iap.validate(receipt);

    console.log('Receipt validation response:', {
      status: validationResponse.status,
      environment: validationResponse.environment,
    });

    // ステータスコードチェック (0 = 成功)
    if (validationResponse.status !== 0) {
      console.error('Receipt validation failed:', validationResponse.status);
      return { valid: false };
    }

    // 最新のレシート情報を取得
    const latestReceiptInfo =
      validationResponse.latest_receipt_info ||
      validationResponse.receipt?.in_app;

    if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
      console.error('No receipt info found');
      return { valid: false };
    }

    // 最新のサブスクリプション情報を取得
    const latestSubscription = latestReceiptInfo[latestReceiptInfo.length - 1];

    const expiresDate = latestSubscription.expires_date_ms
      ? new Date(parseInt(latestSubscription.expires_date_ms))
      : undefined;

    // 期限切れチェック
    if (expiresDate && expiresDate < new Date()) {
      console.warn('Subscription expired');
      return { valid: false };
    }

    return {
      valid: true,
      productId: latestSubscription.product_id,
      expiresDate: expiresDate,
      originalTransactionId: latestSubscription.original_transaction_id,
      environment: validationResponse.environment as 'sandbox' | 'production',
    };
  } catch (error) {
    console.error('Receipt validation error:', error);
    return { valid: false };
  }
}

/**
 * レシート検証後、Firestoreのサブスクリプション情報を更新
 *
 * @param userId ユーザーID
 * @param validationResult 検証結果
 */
export async function updateSubscriptionFromReceipt(
  userId: string,
  validationResult: ValidationResult
): Promise<void> {
  if (!validationResult.valid) {
    throw new Error('INVALID_RECEIPT');
  }

  const userRef = db.collection('users').doc(userId);

  // サブスクリプション情報を更新
  const updates: any = {
    'subscription.status': 'active',
    'subscription.renewDate': validationResult.expiresDate,
  };

  // プロダクトIDからティアを判定
  if (validationResult.productId === 'com.bananadish.starter.monthly') {
    updates['subscription.tier'] = 'starter';
    updates['usage.monthlyLimit'] = 30;
  } else if (validationResult.productId === 'com.bananadish.addon.10gen') {
    // アドオンの場合は一時的にリミットを増やす
    const userDoc = await userRef.get();
    const currentLimit = userDoc.data()?.usage?.monthlyLimit || 5;
    updates['usage.monthlyLimit'] = currentLimit + 10;
  }

  await userRef.update(updates);

  console.log(`Updated subscription for user ${userId}:`, updates);
}
```

### Step 3: Subscription Routeの実装

`src/routes/subscription.ts` を作成:

```typescript
import { Request, Response, Router } from 'express';
import { verifyAuth } from '../middleware/auth';
import { firebaseAdmin } from '../firebase';
import {
  validateReceipt,
  updateSubscriptionFromReceipt,
} from '../services/receiptValidator';

const db = firebaseAdmin.firestore();
const router = Router();

/**
 * GET /v1/subscription/status
 *
 * 現在のサブスクリプション状態を取得
 */
router.get('/status', verifyAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // ユーザーが存在しない場合はデフォルト (free tier) を返す
      res.status(200).json({
        tier: 'free',
        status: 'active',
        limit: 5,
        used: 0,
        remaining: 5,
        renewsAt: null,
        addOns: [],
      });
      return;
    }

    const data = userDoc.data()!;
    const subscription = data.subscription || {};
    const usage = data.usage || {};

    res.status(200).json({
      tier: subscription.tier || 'free',
      status: subscription.status || 'active',
      limit: usage.monthlyLimit || 5,
      used: usage.currentPeriodUsed || 0,
      remaining: Math.max(
        0,
        (usage.monthlyLimit || 5) - (usage.currentPeriodUsed || 0)
      ),
      renewsAt: subscription.renewDate?.toDate() || null,
      addOns: subscription.addOns || [],
    });
  } catch (error) {
    console.error('Failed to fetch subscription status:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サブスクリプション情報の取得に失敗しました',
        retryable: true,
      },
    });
  }
});

/**
 * POST /v1/subscription/validate-receipt
 *
 * Apple IAPレシートを検証し、サブスクリプション状態を更新
 */
router.post(
  '/validate-receipt',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { receiptData, transactionId } = req.body;

      if (!receiptData) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'receiptData is required',
            retryable: false,
          },
        });
        return;
      }

      const userId = req.user!.uid;

      console.log(`Validating receipt for user ${userId}...`);

      // レシート検証
      const validationResult = await validateReceipt(receiptData);

      if (!validationResult.valid) {
        res.status(400).json({
          error: {
            code: 'INVALID_RECEIPT',
            message: 'レシートの検証に失敗しました',
            retryable: false,
          },
        });
        return;
      }

      // Firestoreを更新
      await updateSubscriptionFromReceipt(userId, validationResult);

      res.status(200).json({
        valid: true,
        tier:
          validationResult.productId === 'com.bananadish.starter.monthly'
            ? 'starter'
            : 'free',
        expiresAt: validationResult.expiresDate,
        environment: validationResult.environment,
      });
    } catch (error: any) {
      console.error('Receipt validation failed:', error);

      if (error.message === 'INVALID_RECEIPT') {
        res.status(400).json({
          error: {
            code: 'INVALID_RECEIPT',
            message: 'レシートが無効です',
            retryable: false,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'レシート検証中にエラーが発生しました',
          retryable: true,
        },
      });
    }
  }
);

export default router;
```

### Step 4: server.tsにルート追加

`src/server.ts` を更新:

```typescript
import express from 'express';
import { initializeFirebase } from './firebase';
import { initializeReceiptValidator } from './services/receiptValidator';
import { generateHandler } from './routes/generate';
import subscriptionRouter from './routes/subscription';

// 初期化
initializeFirebase();
initializeReceiptValidator();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('ok');
});

// API endpoints
app.post('/v1/generate', ...generateHandler);
app.use('/v1/subscription', subscriptionRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
```

### Step 5: ユニットテストの作成

`tests/routes/subscription.test.ts` を作成:

```typescript
import request from 'supertest';
import app from '../../src/server';
import { validateReceipt } from '../../src/services/receiptValidator';

// モック
jest.mock('../../src/services/receiptValidator');
jest.mock('../../src/middleware/auth', () => ({
  verifyAuth: (req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-123', email: 'test@example.com' };
    next();
  },
}));

describe('Subscription API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/subscription/status', () => {
    it('should return subscription status', async () => {
      const response = await request(app).get('/v1/subscription/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tier');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('used');
      expect(response.body).toHaveProperty('remaining');
    });

    it('should return default free tier for new user', async () => {
      const response = await request(app).get('/v1/subscription/status');

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('free');
      expect(response.body.limit).toBe(5);
    });
  });

  describe('POST /v1/subscription/validate-receipt', () => {
    it('should validate receipt successfully', async () => {
      (validateReceipt as jest.Mock).mockResolvedValue({
        valid: true,
        productId: 'com.bananadish.starter.monthly',
        expiresDate: new Date('2026-02-17'),
        originalTransactionId: '1000000123456789',
        environment: 'sandbox',
      });

      const response = await request(app)
        .post('/v1/subscription/validate-receipt')
        .send({
          receiptData: 'base64_receipt_data',
          transactionId: '1000000123456789',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.tier).toBe('starter');
      expect(validateReceipt).toHaveBeenCalledWith('base64_receipt_data');
    });

    it('should reject invalid receipt', async () => {
      (validateReceipt as jest.Mock).mockResolvedValue({
        valid: false,
      });

      const response = await request(app)
        .post('/v1/subscription/validate-receipt')
        .send({
          receiptData: 'invalid_receipt',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_RECEIPT');
    });

    it('should reject missing receiptData', async () => {
      const response = await request(app)
        .post('/v1/subscription/validate-receipt')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });
  });
});
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `node-apple-receipt-verify` パッケージがインストールされている
- [ ] `src/services/receiptValidator.ts` でレシート検証が実装されている
- [ ] `src/routes/subscription.ts` でサブスクリプションAPIが実装されている
- [ ] GET /v1/subscription/status エンドポイントが実装されている:
  - [ ] 認証が必要
  - [ ] ユーザーのサブスクリプション状態を返す
  - [ ] 新規ユーザーの場合はデフォルト (free tier) を返す
- [ ] POST /v1/subscription/validate-receipt エンドポイントが実装されている:
  - [ ] 認証が必要
  - [ ] Appleレシートを検証
  - [ ] 検証成功時にFirestoreを更新
  - [ ] サブスクリプションプロダクトの処理
  - [ ] アドオンプロダクトの処理
- [ ] サンドボックス環境と本番環境の両方をサポート
- [ ] エラーハンドリングが包括的
- [ ] ユニットテストが作成され、以下のシナリオをカバーしている:
  - [ ] サブスクリプション状態取得
  - [ ] 新規ユーザーのデフォルト状態
  - [ ] レシート検証成功
  - [ ] 無効なレシート
  - [ ] パラメータ不足
- [ ] テストが全てpass

## Verification Commands

```bash
# テストの実行
cd bananadish-backend
npm test -- subscription.test.ts

# サーバー起動
npm start

# 別ターミナルで手動テスト
```

**手動テスト**:

```bash
# 1. Firebase ID tokenを取得
export ID_TOKEN="your_firebase_id_token"

# 2. サブスクリプション状態取得
curl http://localhost:8080/v1/subscription/status \
  -H "Authorization: Bearer $ID_TOKEN" \
  -v

# 期待される結果:
# - 200 OK
# - JSON: { "tier": "free", "status": "active", "limit": 5, "used": 0, "remaining": 5, ... }

# 3. レシート検証 (サンドボックスレシートが必要)
curl -X POST http://localhost:8080/v1/subscription/validate-receipt \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptData": "BASE64_ENCODED_RECEIPT",
    "transactionId": "1000000123456789"
  }' \
  -v

# 期待される結果:
# - 200 OK (有効なレシートの場合)
# - JSON: { "valid": true, "tier": "starter", "expiresAt": "2026-02-17T00:00:00.000Z", "environment": "sandbox" }

# 4. Firestoreで確認
# Firebase Console → Firestore → users/{userId}
# subscription.tier が "starter" になっているか確認
# usage.monthlyLimit が 30 になっているか確認
```

## Troubleshooting

### 問題: "Receipt validation failed with status 21002"

**原因**: レシートが本番環境のものだがサンドボックスサーバーに送信された

**解決策**:
```typescript
// node-apple-receipt-verify は自動的にフォールバックする設定になっているはず
iap.config({
  environment: ['production', 'sandbox'], // この順序で試行
});
```

### 問題: レシート検証が常に失敗

**原因**: サンドボックステスターアカウントで購入していない

**解決策**:
1. App Store Connect → ユーザーとアクセス → サンドボックステスター
2. テスターアカウントを作成
3. アプリでこのアカウントでサインイン (Settings → App Store)
4. 購入テスト

### 問題: Firestore更新が反映されない

**原因**: Firebase Admin SDKの権限不足

**解決策**:
```bash
# サービスアカウントに Firestore User 権限が付与されているか確認 (T001で設定済み)
gcloud projects get-iam-policy bananadish-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:bananadish-backend@*"
```

## Deliverables

- Receipt Validatorモジュール: `src/services/receiptValidator.ts`
- Subscription Route: `src/routes/subscription.ts`
- ユニットテスト: `tests/routes/subscription.test.ts`
- 更新されたサーバー: `src/server.ts`

## Notes

- **サンドボックス**: 開発中は必ずサンドボックス環境でテスト
- **本番移行**: 本番環境では自動的に本番レシート検証に切り替わる
- **セキュリティ**: レシート検証は必ずサーバー側で行う (クライアント側では不可)
- **App Store Server Notifications**: 将来的にWebhookを実装してサブスクリプション更新を自動処理
- **次のタスク**: T107でCloud Runにデプロイし、全API機能が利用可能になる

## Estimated Time
2-3時間 (テスト・レシート検証確認含む)
