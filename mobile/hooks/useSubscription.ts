import { useEffect, useState, useCallback } from 'react';
import { getSubscriptionStatus, validateReceipt, SubscriptionStatus } from '../services/api/subscription';
import { purchaseManager, Purchase } from '../services/iap/purchaseManager';
import { useAuth } from '../contexts/AuthContext';

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // サブスクリプション状態を取得
  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getSubscriptionStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
      setError(err instanceof Error ? err.message : 'サブスクリプション情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 初回ロードと定期更新
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // サブスクリプション購入
  const purchaseSubscription = useCallback(async () => {
    try {
      setError(null);
      const purchase = await purchaseManager.purchaseSubscription();

      // レシート検証
      await validateReceipt(purchase.transactionReceipt, purchase.transactionId);

      // トランザクション完了
      await purchaseManager.finishTransaction(purchase);

      // 状態を更新
      await fetchStatus();

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '購入処理に失敗しました';
      setError(errorMessage);
      console.error('Purchase failed:', err);
      return { success: false, error: errorMessage };
    }
  }, [fetchStatus]);

  // ブースト購入
  const purchaseBoost = useCallback(async () => {
    try {
      setError(null);
      const purchase = await purchaseManager.purchaseBoost();

      // レシート検証
      await validateReceipt(purchase.transactionReceipt, purchase.transactionId);

      // トランザクション完了
      await purchaseManager.finishTransaction(purchase);

      // 状態を更新
      await fetchStatus();

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '購入処理に失敗しました';
      setError(errorMessage);
      console.error('Boost purchase failed:', err);
      return { success: false, error: errorMessage };
    }
  }, [fetchStatus]);

  // 購入復元
  const restorePurchases = useCallback(async () => {
    try {
      setError(null);
      const purchases = await purchaseManager.restorePurchases();

      // 各購入のレシートを検証
      for (const purchase of purchases) {
        try {
          await validateReceipt(purchase.transactionReceipt, purchase.transactionId);
          await purchaseManager.finishTransaction(purchase);
        } catch (err) {
          console.error('Failed to validate purchase:', err);
        }
      }

      // 状態を更新
      await fetchStatus();

      return { success: true, count: purchases.length };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '購入の復元に失敗しました';
      setError(errorMessage);
      console.error('Restore failed:', err);
      return { success: false, error: errorMessage };
    }
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
    purchaseSubscription,
    purchaseBoost,
    restorePurchases,
  };
}
