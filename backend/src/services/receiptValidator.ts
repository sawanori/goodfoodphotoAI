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
