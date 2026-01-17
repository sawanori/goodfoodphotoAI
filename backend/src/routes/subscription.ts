import { Request, Response, Router } from 'express';
import { verifyAuth } from '../middleware/auth';
import { getFirestore } from '../firebase';
import {
  validateReceipt,
  updateSubscriptionFromReceipt,
} from '../services/receiptValidator';

const db = getFirestore();
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
