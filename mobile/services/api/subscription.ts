import { apiRequest } from './client';

export interface SubscriptionStatus {
  tier: 'free' | 'starter' | 'pro';
  status: 'active' | 'expired' | 'cancelled';
  limit: number;
  used: number;
  remaining: number;
  renewsAt: string | null;
  addOns: Array<{
    type: string;
    amount: number;
    expiresAt: string;
  }>;
}

export interface ReceiptValidationResult {
  valid: boolean;
  tier: 'free' | 'starter' | 'pro';
  expiresAt: string;
  environment: 'sandbox' | 'production';
}

/**
 * サブスクリプション状態を取得
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiRequest<SubscriptionStatus>('/v1/subscription/status', {
    method: 'GET',
  });
}

/**
 * Apple IAPレシートを検証
 */
export async function validateReceipt(
  receiptData: string,
  transactionId: string
): Promise<ReceiptValidationResult> {
  return apiRequest<ReceiptValidationResult>('/v1/subscription/validate-receipt', {
    method: 'POST',
    body: JSON.stringify({
      receiptData,
      transactionId,
    }),
  });
}
