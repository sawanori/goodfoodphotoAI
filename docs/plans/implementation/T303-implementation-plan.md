# T303: Backend Receipt Validation Implementation - 実装計画書

## 基本情報

| 項目 | 内容 |
|------|------|
| タスクID | T303 |
| タスク名 | Backend Receipt Validation Implementation |
| 担当モデル | Sonnet (Task agent) |
| 依存タスク | T302 (IAP Integration), T107 (Cloud Run Deployment) |
| 推定時間 | 4-5時間 |
| 作成日 | 2026-01-17 |

## 概要

Appleから取得したレシートデータをバックエンドで検証し、Firestoreのサブスクリプション情報を更新します。Sandbox環境と本番環境の両方に対応します。

## 実装方針

### アプローチ

1. **モック実装優先**: Apple Shared Secret未設定でも動作確認可能なモック実装
2. **本番対応準備**: 実際のApple Receipt検証APIも実装（環境変数で切り替え）
3. **段階的実装**: サービスレイヤー → エンドポイント → フロントエンド連携の順で実装

### 実装ファイル構成

```
backend/
├── src/
│   ├── services/
│   │   ├── appleReceipt.ts          # Apple Receipt検証ロジック
│   │   ├── mockAppleReceipt.ts      # モックReceipt検証
│   │   └── subscriptionService.ts   # Firestore更新ロジック
│   └── routes/
│       └── subscription.ts          # POST /v1/subscription/validate-receipt

mobile/
└── services/
    └── api/
        └── subscription.ts          # フロントエンドAPI呼び出し
```

## 詳細実装手順

### Step 1: モックApple Receipt検証 (`backend/src/services/mockAppleReceipt.ts`)

```typescript
// backend/src/services/mockAppleReceipt.ts
interface ReceiptVerificationResult {
  valid: boolean;
  productId: string;
  transactionId: string;
  expiresDate: Date | null;
  environment: 'Production' | 'Sandbox' | 'Mock';
  originalTransactionId: string;
}

/**
 * モックApple Receipt検証
 */
export const verifyAppleReceiptMock = async (
  receiptData: string,
  sharedSecret: string
): Promise<ReceiptVerificationResult> => {
  console.log('[MOCK RECEIPT] Verifying receipt (mock mode)...');

  // Base64デコードしてモックレシート解析
  let decodedReceipt;
  try {
    decodedReceipt = JSON.parse(Buffer.from(receiptData, 'base64').toString());
  } catch (error) {
    throw new Error('Invalid receipt data format');
  }

  console.log('[MOCK RECEIPT] Decoded receipt:', decodedReceipt);

  // モックレシートの検証（T302で生成したモックレシート形式）
  if (!decodedReceipt.productId || !decodedReceipt.transactionId) {
    throw new Error('Invalid receipt structure');
  }

  // サブスクリプションの場合は有効期限を設定（1ヶ月後）
  const expiresDate = decodedReceipt.productId.includes('monthly')
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return {
    valid: true,
    productId: decodedReceipt.productId,
    transactionId: decodedReceipt.transactionId,
    originalTransactionId: decodedReceipt.transactionId,
    expiresDate,
    environment: 'Mock',
  };
};
```

**実装理由**:
- T302で生成したモックレシートを検証可能
- 開発環境でエンドツーエンドテスト可能
- Base64デコードで実際のレシート処理と同じフロー

### Step 2: 本番Apple Receipt検証 (`backend/src/services/appleReceipt.ts`)

タスクファイルT303のStep 2のコードをそのまま実装します。

**注意事項**:
- 環境変数 `USE_MOCK_RECEIPT` で切り替え
- Apple Shared Secret設定後に有効化

### Step 3: Firestore更新ロジック (`backend/src/services/subscriptionService.ts`)

```typescript
// backend/src/services/subscriptionService.ts
import { db } from '../firebase';
import type { ReceiptVerificationResult } from './mockAppleReceipt';

const SUBSCRIPTION_TIERS = {
  'com.bananadish.app.starter.monthly': {
    tier: 'starter',
    monthlyLimit: 30,
  },
  'com.bananadish.app.boost.10': {
    type: 'addon',
    additionalGenerations: 10,
  },
};

/**
 * サブスクリプション購入後のFirestore更新
 */
export const updateSubscriptionFromReceipt = async (
  uid: string,
  receiptResult: ReceiptVerificationResult
): Promise<void> => {
  const userRef = db.collection('users').doc(uid);

  const tierConfig = SUBSCRIPTION_TIERS[receiptResult.productId];

  if (!tierConfig) {
    throw new Error(`Unknown product ID: ${receiptResult.productId}`);
  }

  if ('tier' in tierConfig) {
    // サブスクリプション購入
    await userRef.update({
      'subscription.tier': tierConfig.tier,
      'subscription.status': 'active',
      'subscription.renewDate': receiptResult.expiresDate,
      'subscription.appleTransactionId': receiptResult.transactionId,
      'subscription.appleOriginalTransactionId': receiptResult.originalTransactionId,
      'subscription.environment': receiptResult.environment,
      'usage.monthlyLimit': tierConfig.monthlyLimit,
      'subscription.lastUpdated': new Date(),
    });

    console.log(`Subscription updated for user ${uid}: ${tierConfig.tier}`);
  } else if ('additionalGenerations' in tierConfig) {
    // 追加生成購入
    const userDoc = await userRef.get();
    const currentLimit = userDoc.data()?.usage?.monthlyLimit || 10;

    await userRef.update({
      'usage.monthlyLimit': currentLimit + tierConfig.additionalGenerations,
      'subscription.lastAddOnPurchase': new Date(),
    });

    console.log(`Add-on purchased for user ${uid}: +${tierConfig.additionalGenerations}`);
  }
};
```

**実装理由**:
- 製品IDに応じたFirestore更新を自動化
- サブスクリプション/アドオンを区別して処理
- トランザクションIDを記録（重複購入防止に利用可能）

### Step 4: validate-receipt エンドポイント (`backend/src/routes/subscription.ts`)

```typescript
// backend/src/routes/subscription.ts に追加
import { Router } from 'express';
import { verifyAppleReceiptMock } from '../services/mockAppleReceipt';
// import { verifyAppleReceipt } from '../services/appleReceipt'; // 本番用
import { updateSubscriptionFromReceipt } from '../services/subscriptionService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 環境変数でモック/本番を切り替え
const USE_MOCK_RECEIPT = process.env.USE_MOCK_RECEIPT !== 'false';

/**
 * POST /v1/subscription/validate-receipt
 */
router.post('/validate-receipt', authMiddleware, async (req, res) => {
  try {
    const { receiptData, transactionId } = req.body;
    const uid = req.user!.uid;

    if (!receiptData) {
      return res.status(400).json({
        error: 'MISSING_RECEIPT',
        message: 'Receipt data is required',
      });
    }

    const sharedSecret = process.env.APPLE_SHARED_SECRET || 'mock_secret';

    // Receipt検証（モックまたは本番）
    const receiptResult = USE_MOCK_RECEIPT
      ? await verifyAppleReceiptMock(receiptData, sharedSecret)
      : null; // 本番時は verifyAppleReceipt を使用

    if (!receiptResult || !receiptResult.valid) {
      return res.status(400).json({
        error: 'INVALID_RECEIPT',
        message: 'Receipt validation failed',
      });
    }

    // Firestore更新
    await updateSubscriptionFromReceipt(uid, receiptResult);

    console.log(`[RECEIPT VALIDATION] Success for user ${uid}, product ${receiptResult.productId}`);

    return res.status(200).json({
      success: true,
      subscription: {
        tier: receiptResult.productId.includes('starter') ? 'starter' : 'free',
        transactionId: receiptResult.transactionId,
        expiresDate: receiptResult.expiresDate,
        environment: receiptResult.environment,
      },
    });
  } catch (error: any) {
    console.error('Receipt validation error:', error);
    return res.status(500).json({
      error: 'VALIDATION_FAILED',
      message: error.message || 'Receipt validation failed',
    });
  }
});

export default router;
```

**実装理由**:
- 環境変数でモック/本番を簡単に切り替え
- 認証ミドルウェアでセキュリティ確保
- エラーハンドリングを統一

### Step 5: フロントエンドAPI呼び出し (`mobile/services/api/subscription.ts`)

```typescript
// mobile/services/api/subscription.ts に追加
import { API_BASE_URL } from './client';

/**
 * レシート検証API呼び出し
 */
export const validateReceipt = async (
  idToken: string,
  receiptData: string,
  transactionId: string
): Promise<{
  success: boolean;
  subscription: {
    tier: string;
    transactionId: string;
    expiresDate: Date | null;
    environment: string;
  };
}> => {
  const response = await fetch(`${API_BASE_URL}/v1/subscription/validate-receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ receiptData, transactionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'レシート検証に失敗しました');
  }

  return response.json();
};
```

**実装理由**:
- T302の購入完了後に呼び出し
- 認証トークンを含める（セキュリティ）
- エラーハンドリングを統一

### Step 6: T302との統合

T302の `useIAP.ts` または購入完了ハンドラーに以下を追加:

```typescript
// mobile/hooks/useIAP.ts 内の購入完了後
const purchaseSubscription = async (productId: string): Promise<PurchaseResult> => {
  if (!iapManager) {
    throw new Error('IAP manager not configured');
  }
  try {
    const result = await iapManager.purchaseSubscription(productId);

    // レシート検証を呼び出し
    const idToken = await getCurrentUserIdToken(); // AuthContextから取得
    if (idToken) {
      await validateReceipt(idToken, result.receiptData, result.transactionId);
      console.log('Receipt validated successfully');
    }

    return result;
  } catch (err: any) {
    throw err;
  }
};
```

**実装理由**:
- 購入完了後、即座にレシート検証
- バックエンドでFirestore更新
- ユーザーに即座にプラン反映

## 完了条件（DoD）

- [ ] `backend/src/services/mockAppleReceipt.ts` でモック検証実装済み
- [ ] `backend/src/services/subscriptionService.ts` でFirestore更新実装済み
- [ ] `backend/src/routes/subscription.ts` で `/validate-receipt` エンドポイント実装済み
- [ ] `mobile/services/api/subscription.ts` でAPI呼び出し実装済み
- [ ] モック環境でレシート検証が動作する
- [ ] Firestoreでサブスクリプション情報が正しく更新される
- [ ] エラーハンドリングが適切に機能する
- [ ] ログが正しく出力される

## 検証手順

```bash
# 1. バックエンド環境変数設定
cd /home/noritakasawada/project/20260117/backend
echo "USE_MOCK_RECEIPT=true" >> .env

# 2. バックエンド起動
npm run dev

# 3. フロントエンドでサブスクリプション購入テスト
cd /home/noritakasawada/project/20260117/mobile
npm run ios

# 4. 動作確認
# - 設定画面で「Starterプランを購入」をタップ
# - 購入完了後、自動的にレシート検証が呼ばれる
# - バックエンドログに [MOCK RECEIPT] が出力される
# - バックエンドログに [RECEIPT VALIDATION] Success が出力される
# - Firestoreで subscription.tier が 'starter' に更新される
# - アプリでサブスクリプション情報が更新される

# 5. Firestore確認
# Firebase Consoleで users/{uid} ドキュメント確認
# - subscription.tier: 'starter'
# - subscription.status: 'active'
# - subscription.environment: 'Mock'
# - usage.monthlyLimit: 30
```

## トラブルシューティング

### 問題: Base64デコードエラー

**症状**: "Invalid receipt data format"

**解決策**:
```typescript
// モックレシートデータ確認
console.log('Receipt data:', receiptData);
console.log('Receipt length:', receiptData.length);

// Base64デコード確認
const decoded = Buffer.from(receiptData, 'base64').toString();
console.log('Decoded:', decoded);
```

### 問題: Firestore更新失敗

**症状**: "Permission denied"

**解決策**:
```javascript
// Firestore security rules確認
match /users/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId;
}

// Service account権限確認
// roles/datastore.user が付与されているか
```

### 問題: エンドポイントが404

**症状**: "Cannot POST /v1/subscription/validate-receipt"

**解決策**:
```typescript
// backend/src/index.ts でルート登録確認
import subscriptionRoutes from './routes/subscription';
app.use('/v1/subscription', subscriptionRoutes);
```

## 次のステップ

T303完了後、T304（Subscription UI）でUIを完成させます。

## 関連ドキュメント

- [T303タスクファイル](/home/noritakasawada/project/20260117/docs/plans/tasks/T303-receipt-validation.md)
- [Apple Receipt Validation Guide](https://developer.apple.com/documentation/appstorereceipts/verifyreceipt)
