# T303: Backend Receipt Validation Implementation

## 基本情報
- **タスクID**: T303
- **フェーズ**: Phase 3: Payment Integration
- **依存タスク**: T302 (IAP Integration), T107 (Cloud Run Deployment)
- **成果物**:
  - POST /v1/subscription/validate-receipt エンドポイント
  - Apple Receipt検証ロジック
  - Firestore更新処理
  - Sandbox/Production環境切り替え
- **推定時間**: 4-5時間

## 概要
Appleから取得したレシートデータをバックエンドで検証し、Firestoreのサブスクリプション情報を更新します。Sandbox環境と本番環境の両方に対応します。

## 前提条件
- [ ] T302完了 (フロントエンドでレシートデータ取得可能)
- [ ] T107完了 (Cloud Runバックエンドがデプロイ済み)
- [ ] Apple Shared Secret取得済み (App Store Connect → App内課金 → 共有シークレット)
- [ ] Firestoreデータベースが稼働中

## 実装手順

### Step 1: Apple Shared Secret の設定

```bash
# GCP Secret Managerに保存
gcloud secrets create APPLE_SHARED_SECRET \
  --data-file=- <<< "YOUR_APPLE_SHARED_SECRET"

# Cloud Runサービスにシークレットアクセス権限を付与
gcloud secrets add-iam-policy-binding APPLE_SHARED_SECRET \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# .env.templateに追加
echo "APPLE_SHARED_SECRET=\${APPLE_SHARED_SECRET}" >> backend/.env.template
```

### Step 2: Receipt検証モジュールの実装

`bananadish-backend/src/services/appleReceipt.ts` を作成:

```typescript
import axios from 'axios';

const APPLE_VERIFY_RECEIPT_URL_PRODUCTION =
  'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_RECEIPT_URL_SANDBOX =
  'https://sandbox.itunes.apple.com/verifyReceipt';

interface ReceiptVerificationResult {
  valid: boolean;
  productId: string;
  transactionId: string;
  expiresDate: Date | null;
  environment: 'Production' | 'Sandbox';
  originalTransactionId: string;
}

/**
 * Apple Receipt検証
 */
export const verifyAppleReceipt = async (
  receiptData: string,
  sharedSecret: string
): Promise<ReceiptVerificationResult> => {
  // 最初にProduction環境で検証
  let response = await sendVerificationRequest(
    APPLE_VERIFY_RECEIPT_URL_PRODUCTION,
    receiptData,
    sharedSecret
  );

  // Status 21007 = Sandbox receipt sent to production
  if (response.status === 21007) {
    console.log('Sandbox receipt detected, retrying with sandbox URL');
    response = await sendVerificationRequest(
      APPLE_VERIFY_RECEIPT_URL_SANDBOX,
      receiptData,
      sharedSecret
    );
  }

  // ステータスコード確認
  if (response.status !== 0) {
    throw new Error(`Receipt verification failed: ${response.status}`);
  }

  const environment = response.environment;
  const latestReceipt = response.latest_receipt_info?.[0] || response.receipt?.in_app?.[0];

  if (!latestReceipt) {
    throw new Error('No valid purchase found in receipt');
  }

  const productId = latestReceipt.product_id;
  const transactionId = latestReceipt.transaction_id;
  const originalTransactionId = latestReceipt.original_transaction_id;
  const expiresDateMs = latestReceipt.expires_date_ms;

  return {
    valid: true,
    productId,
    transactionId,
    originalTransactionId,
    expiresDate: expiresDateMs ? new Date(parseInt(expiresDateMs, 10)) : null,
    environment,
  };
};

/**
 * Apple検証APIにリクエスト送信
 */
const sendVerificationRequest = async (
  url: string,
  receiptData: string,
  sharedSecret: string
): Promise<any> => {
  try {
    const response = await axios.post(url, {
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    });

    return response.data;
  } catch (error: any) {
    console.error('Apple verification request failed:', error);
    throw new Error('Failed to connect to Apple verification server');
  }
};
```

### Step 3: Firestore更新ロジックの実装

`bananadish-backend/src/services/subscriptionService.ts` を作成:

```typescript
import { db } from '../firebase';
import type { ReceiptVerificationResult } from './appleReceipt';

const SUBSCRIPTION_TIERS = {
  'com.bananadish.starter.monthly': {
    tier: 'starter',
    monthlyLimit: 30,
  },
  'com.bananadish.addon.10gen': {
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

### Step 4: validate-receipt エンドポイント実装

`bananadish-backend/src/routes/subscription.ts` に追加:

```typescript
import { Router } from 'express';
import { verifyAppleReceipt } from '../services/appleReceipt';
import { updateSubscriptionFromReceipt } from '../services/subscriptionService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

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

    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret) {
      console.error('APPLE_SHARED_SECRET not configured');
      return res.status(500).json({
        error: 'CONFIGURATION_ERROR',
        message: 'Server configuration error',
      });
    }

    // Receipt検証
    const receiptResult = await verifyAppleReceipt(receiptData, sharedSecret);

    if (!receiptResult.valid) {
      return res.status(400).json({
        error: 'INVALID_RECEIPT',
        message: 'Receipt validation failed',
      });
    }

    // Firestore更新
    await updateSubscriptionFromReceipt(uid, receiptResult);

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

### Step 5: フロントエンドとの連携

`bananadish-app/services/api/subscription.ts` に追加:

```typescript
/**
 * レシート検証API呼び出し
 */
export const validateReceipt = async (
  idToken: string,
  receiptData: string,
  transactionId: string
): Promise<void> => {
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

T302の購入完了後に呼び出し:

```typescript
// services/iap/purchaseManager.ts 内
const result = await purchaseManager.purchaseSubscription(productId);

// レシート検証をバックエンドで実行
await validateReceipt(idToken, result.receiptData, result.transactionId);
```

## 完了条件（DoD）

- [ ] Apple Receipt検証ロジックが実装されている
- [ ] Sandbox/Production環境の自動切り替えが動作する
- [ ] サブスクリプション購入時にFirestoreが正しく更新される
- [ ] 追加生成購入時にusage.monthlyLimitが増加する
- [ ] 無効なレシートでエラーが返される
- [ ] レシート検証APIが200を返す (有効なレシート時)
- [ ] フロントエンドから検証APIを呼び出せる
- [ ] Sandboxテストで検証が成功する

## 検証手順

```bash
# バックエンドのテスト
cd bananadish-backend

# 環境変数確認
echo $APPLE_SHARED_SECRET

# ローカルでテスト
npm run dev

# cURLでテスト (Sandbox receipt)
curl -X POST http://localhost:8080/v1/subscription/validate-receipt \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptData": "SANDBOX_RECEIPT_BASE64",
    "transactionId": "1000000123456789"
  }'

# 期待結果: 200 OK, Firestore更新成功

# Cloud Runデプロイ後のテスト
gcloud run deploy bananadish-api \
  --source . \
  --region asia-northeast1 \
  --set-secrets APPLE_SHARED_SECRET=APPLE_SHARED_SECRET:latest

# エンドツーエンドテスト (iOS実機)
# 1. アプリでSandbox購入を実行
# 2. 購入完了後、自動的にレシート検証が呼ばれる
# 3. Firestoreで subscription.tier が 'starter' に更新されることを確認
# 4. アプリでサブスクリプション情報が更新されることを確認
```

## トラブルシューティング

### 問題: Receipt検証が status 21002 を返す

**症状**: "The data in the receipt-data property was malformed"

**解決策**:
```typescript
// receiptData が正しくbase64エンコードされているか確認
console.log('Receipt length:', receiptData.length);
console.log('First 50 chars:', receiptData.substring(0, 50));

// react-native-iapから取得したレシートをそのまま使用
// 追加のエンコードは不要
```

### 問題: Firestore更新が失敗する

**症状**: "Permission denied" エラー

**解決策**:
```javascript
// Firestore security rulesを確認
// users/{userId} に書き込み権限があるか
match /users/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId;
}

// Service accountの権限確認
// roles/datastore.user が付与されているか
```

## Deliverables

- `src/services/appleReceipt.ts` - Receipt検証ロジック
- `src/services/subscriptionService.ts` - Firestore更新ロジック
- `src/routes/subscription.ts` - validate-receipt エンドポイント
- `services/api/subscription.ts` - フロントエンドAPI呼び出し

## Notes

- **Sandbox自動判定**: Production URLで21007エラーの場合、自動的にSandbox URLで再試行
- **Shared Secret**: サブスクリプション検証には必須
- **Transaction ID**: 重複購入防止に使用可能 (オプション)
- **環境表示**: Sandbox/Production環境をログに記録
- **セキュリティ**: レシート検証は必ずバックエンドで実行 (クライアントでは不可)

## 関連ドキュメント

- [Apple Receipt Validation Guide](https://developer.apple.com/documentation/appstorereceipts/verifyreceipt)
- [実装計画書 - T303](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t303-backend-receipt-validation-implementation)
