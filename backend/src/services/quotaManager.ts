import { firebaseAdmin } from '../firebase';

const db = firebaseAdmin.firestore();

/**
 * ユーザーのクォータ情報
 */
export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  periodStartDate: Date;
}

/**
 * ユーザーのクォータ情報を取得
 *
 * @param userId ユーザーID
 * @returns クォータ情報
 */
export async function getUserQuota(userId: string): Promise<QuotaInfo> {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    // ユーザーが存在しない場合は作成 (free tier)
    await createDefaultUser(userId);
    return {
      limit: 5,
      used: 0,
      remaining: 5,
      periodStartDate: new Date(),
    };
  }

  const data = userDoc.data()!;
  const usage = data.usage || {};

  // 期間リセットのチェック (月初にリセット)
  const periodStart = usage.periodStartDate?.toDate() || new Date();
  const now = new Date();

  if (shouldResetPeriod(periodStart, now)) {
    // 新しい月に入ったのでリセット
    await resetMonthlyUsage(userId);
    return {
      limit: usage.monthlyLimit || 5,
      used: 0,
      remaining: usage.monthlyLimit || 5,
      periodStartDate: now,
    };
  }

  return {
    limit: usage.monthlyLimit || 5,
    used: usage.currentPeriodUsed || 0,
    remaining: Math.max(0, (usage.monthlyLimit || 5) - (usage.currentPeriodUsed || 0)),
    periodStartDate: periodStart,
  };
}

/**
 * クォータをチェック (残りがあるかどうか)
 *
 * @param userId ユーザーID
 * @returns クォータが残っている場合true
 */
export async function checkQuota(userId: string): Promise<boolean> {
  const quota = await getUserQuota(userId);
  return quota.remaining > 0;
}

/**
 * 使用量をインクリメント
 *
 * @param userId ユーザーID
 */
export async function incrementUsage(userId: string): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await userRef.update({
    'usage.currentPeriodUsed': firebaseAdmin.firestore.FieldValue.increment(1),
  });

  console.log(`Incremented usage for user ${userId}`);
}

/**
 * デフォルトユーザーを作成 (free tier)
 *
 * @param userId ユーザーID
 */
async function createDefaultUser(userId: string): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await userRef.set({
    createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    subscription: {
      tier: 'free',
      status: 'active',
      startDate: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      renewDate: null,
      appleReceiptData: null,
    },
    usage: {
      monthlyLimit: 5,
      currentPeriodUsed: 0,
      periodStartDate: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    },
  });

  console.log(`Created default user: ${userId}`);
}

/**
 * 月次使用量をリセット
 *
 * @param userId ユーザーID
 */
async function resetMonthlyUsage(userId: string): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await userRef.update({
    'usage.currentPeriodUsed': 0,
    'usage.periodStartDate': firebaseAdmin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Reset monthly usage for user ${userId}`);
}

/**
 * 期間リセットが必要かチェック
 *
 * @param periodStart 期間開始日
 * @param now 現在日時
 * @returns リセットが必要な場合true
 */
function shouldResetPeriod(periodStart: Date, now: Date): boolean {
  // 月が変わったかチェック
  return (
    periodStart.getFullYear() !== now.getFullYear() ||
    periodStart.getMonth() !== now.getMonth()
  );
}
