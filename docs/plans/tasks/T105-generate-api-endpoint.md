# T105: Generate API Endpoint Implementation

## Task Overview
POST /v1/generate エンドポイントを実装し、画像生成パイプライン全体をオーケストレーションする。認証、クォータチェック、AI生成、画像処理、使用量更新までの一連の処理を統合する。

## Dependencies
- **T102**: Authentication Middleware (完了していること)
- **T103**: Image Processing Pipeline (完了していること)
- **T104**: Gemini AI Integration (完了していること)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/src/routes/generate.ts` (新規作成)
- `bananadish-backend/src/services/quotaManager.ts` (新規作成)
- `bananadish-backend/src/server.ts` (ルート追加)
- `bananadish-backend/tests/routes/generate.test.ts` (新規作成)
- `bananadish-backend/package.json` (依存関係追加)

## Implementation Steps

### Step 1: 必要な依存関係の追加

```bash
cd bananadish-backend

# multer (ファイルアップロード処理)
npm install multer@^1.4.5-lts.1

# 型定義
npm install --save-dev @types/multer
```

### Step 2: Quota Managerの実装

`src/services/quotaManager.ts` を作成:

```typescript
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
```

### Step 3: Generate Routeの実装

`src/routes/generate.ts` を作成:

```typescript
import { Request, Response } from 'express';
import multer from 'multer';
import { verifyAuth } from '../middleware/auth';
import { getGeminiClient } from '../services/geminiClient';
import { formatMultipleImages, validateImage, AspectRatio } from '../services/imageProcessor';
import { checkQuota, incrementUsage, getUserQuota } from '../services/quotaManager';

// Multer設定 (メモリストレージ)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // MIME typeチェック
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(new Error('INVALID_IMAGE_FORMAT'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /v1/generate
 *
 * 画像生成エンドポイント
 */
export const generateHandler = [
  verifyAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      // Step 1: リクエストバリデーション
      if (!req.file) {
        res.status(400).json({
          error: {
            code: 'INVALID_IMAGE',
            message: '画像ファイルが見つかりません',
            retryable: false,
          },
        });
        return;
      }

      const imageBuffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      // アスペクト比のバリデーション
      const aspect = (req.body.aspect || '4:5') as AspectRatio;
      const validAspects: AspectRatio[] = ['4:5', '9:16', '16:9', '1:1'];
      if (!validAspects.includes(aspect)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ASPECT',
            message: '無効なアスペクト比です',
            retryable: false,
          },
        });
        return;
      }

      // スタイルのバリデーション
      const style = req.body.style || 'natural';
      const validStyles = ['natural', 'bright', 'moody'];
      if (!validStyles.includes(style)) {
        res.status(400).json({
          error: {
            code: 'INVALID_STYLE',
            message: '無効なスタイルです',
            retryable: false,
          },
        });
        return;
      }

      // 画像バリデーション
      await validateImage(imageBuffer);

      // Step 2: クォータチェック
      const userId = req.user!.uid;
      const hasQuota = await checkQuota(userId);

      if (!hasQuota) {
        const quota = await getUserQuota(userId);
        res.status(402).json({
          error: {
            code: 'QUOTA_EXCEEDED',
            message: '今月の生成回数上限に達しました',
            retryable: false,
          },
          quota: {
            used: quota.used,
            limit: quota.limit,
            remaining: quota.remaining,
          },
        });
        return;
      }

      console.log(`User ${userId}: Generating images (aspect: ${aspect}, style: ${style})`);

      // Step 3: AI生成 (4枚)
      const geminiClient = getGeminiClient();
      const generatedImages = await geminiClient.generateWithRetry(
        imageBuffer,
        mimeType,
        style
      );

      // Step 4: アスペクト比フォーマット
      console.log(`Formatting ${generatedImages.length} images to ${aspect}...`);
      const formattedImages = await formatMultipleImages(generatedImages, aspect);

      // Step 5: 使用量をインクリメント
      await incrementUsage(userId);

      // Step 6: レスポンス
      const quota = await getUserQuota(userId);

      res.status(200).json({
        aspect: aspect,
        count: formattedImages.length,
        images: formattedImages.map((buffer) => ({
          mime: 'image/jpeg',
          b64: buffer.toString('base64'),
        })),
        usage: {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
        },
      });
    } catch (error: any) {
      console.error('Generation failed:', error);

      // エラーハンドリング
      if (error.message === 'FILE_TOO_LARGE') {
        res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: '画像ファイルが大きすぎます（最大10MB）',
            retryable: false,
          },
        });
        return;
      }

      if (error.message === 'INVALID_IMAGE_FORMAT') {
        res.status(400).json({
          error: {
            code: 'INVALID_IMAGE_FORMAT',
            message: '画像形式が無効です（JPEG/PNGのみ）',
            retryable: false,
          },
        });
        return;
      }

      if (error.message === 'IMAGE_TOO_SMALL') {
        res.status(400).json({
          error: {
            code: 'IMAGE_TOO_SMALL',
            message: '画像が小さすぎます（最低640x480px）',
            retryable: false,
          },
        });
        return;
      }

      if (error.message?.includes('AI_GENERATION_FAILED')) {
        res.status(502).json({
          error: {
            code: 'AI_GENERATION_FAILED',
            message: 'AI画像生成に失敗しました。もう一度お試しください',
            retryable: true,
          },
        });
        return;
      }

      if (error.message === 'SERVICE_UNAVAILABLE') {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'サービスが一時的に利用できません。しばらく待ってからお試しください',
            retryable: true,
          },
        });
        return;
      }

      // その他のエラー
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
          retryable: true,
        },
      });
    }
  },
];
```

### Step 4: server.tsにルート追加

`src/server.ts` を更新:

```typescript
import express from 'express';
import { initializeFirebase } from './firebase';
import { generateHandler } from './routes/generate';

// Firebase初期化
initializeFirebase();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('ok');
});

// Generate endpoint
app.post('/v1/generate', ...generateHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
```

### Step 5: 統合テストの作成

`tests/routes/generate.test.ts` を作成:

```typescript
import request from 'supertest';
import app from '../../src/server';
import { checkQuota, incrementUsage } from '../../src/services/quotaManager';
import { getGeminiClient } from '../../src/services/geminiClient';
import { validateImage } from '../../src/services/imageProcessor';

// モック
jest.mock('../../src/services/quotaManager');
jest.mock('../../src/services/geminiClient');
jest.mock('../../src/services/imageProcessor');
jest.mock('../../src/middleware/auth', () => ({
  verifyAuth: (req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-123', email: 'test@example.com' };
    next();
  },
}));

describe('POST /v1/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate images successfully', async () => {
    // モックの設定
    (checkQuota as jest.Mock).mockResolvedValue(true);
    (validateImage as jest.Mock).mockResolvedValue(undefined);

    const mockGeminiClient = {
      generateWithRetry: jest.fn().mockResolvedValue([
        Buffer.from('image1'),
        Buffer.from('image2'),
        Buffer.from('image3'),
        Buffer.from('image4'),
      ]),
    };
    (getGeminiClient as jest.Mock).mockReturnValue(mockGeminiClient);

    const { formatMultipleImages } = require('../../src/services/imageProcessor');
    formatMultipleImages.mockResolvedValue([
      Buffer.from('formatted1'),
      Buffer.from('formatted2'),
      Buffer.from('formatted3'),
      Buffer.from('formatted4'),
    ]);

    const { getUserQuota } = require('../../src/services/quotaManager');
    getUserQuota.mockResolvedValue({
      used: 1,
      limit: 30,
      remaining: 29,
    });

    // リクエスト
    const response = await request(app)
      .post('/v1/generate')
      .attach('image', Buffer.from('fake-image'), 'test.jpg')
      .field('aspect', '4:5')
      .field('style', 'natural');

    // 検証
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(4);
    expect(response.body.images).toHaveLength(4);
    expect(response.body.usage.used).toBe(1);
    expect(incrementUsage).toHaveBeenCalledWith('test-user-123');
  });

  it('should reject when quota exceeded', async () => {
    (checkQuota as jest.Mock).mockResolvedValue(false);
    (validateImage as jest.Mock).mockResolvedValue(undefined);

    const { getUserQuota } = require('../../src/services/quotaManager');
    getUserQuota.mockResolvedValue({
      used: 30,
      limit: 30,
      remaining: 0,
    });

    const response = await request(app)
      .post('/v1/generate')
      .attach('image', Buffer.from('fake-image'), 'test.jpg');

    expect(response.status).toBe(402);
    expect(response.body.error.code).toBe('QUOTA_EXCEEDED');
  });

  it('should reject missing image', async () => {
    const response = await request(app).post('/v1/generate');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_IMAGE');
  });

  it('should reject invalid aspect ratio', async () => {
    (validateImage as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post('/v1/generate')
      .attach('image', Buffer.from('fake-image'), 'test.jpg')
      .field('aspect', 'invalid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ASPECT');
  });

  it('should handle AI generation failure', async () => {
    (checkQuota as jest.Mock).mockResolvedValue(true);
    (validateImage as jest.Mock).mockResolvedValue(undefined);

    const mockGeminiClient = {
      generateWithRetry: jest.fn().mockRejectedValue(new Error('AI_GENERATION_FAILED')),
    };
    (getGeminiClient as jest.Mock).mockReturnValue(mockGeminiClient);

    const response = await request(app)
      .post('/v1/generate')
      .attach('image', Buffer.from('fake-image'), 'test.jpg');

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('AI_GENERATION_FAILED');
    expect(response.body.error.retryable).toBe(true);
  });
});
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `multer` パッケージがインストールされている
- [ ] `src/services/quotaManager.ts` でクォータ管理が実装されている
- [ ] `src/routes/generate.ts` で生成エンドポイントが実装されている
- [ ] 以下の処理フローが実装されている:
  1. [ ] リクエストバリデーション (画像、アスペクト比、スタイル)
  2. [ ] 画像バリデーション (サイズ、形式、解像度)
  3. [ ] クォータチェック
  4. [ ] AI画像生成 (4枚)
  5. [ ] アスペクト比フォーマット
  6. [ ] 使用量インクリメント
  7. [ ] レスポンス返却
- [ ] エラーハンドリングが包括的:
  - [ ] 画像なし → 400 INVALID_IMAGE
  - [ ] 無効なアスペクト比 → 400 INVALID_ASPECT
  - [ ] クォータ超過 → 402 QUOTA_EXCEEDED
  - [ ] ファイル大きすぎ → 413 FILE_TOO_LARGE
  - [ ] AI生成失敗 → 502 AI_GENERATION_FAILED
  - [ ] サービス利用不可 → 503 SERVICE_UNAVAILABLE
- [ ] レスポンスに使用量情報が含まれる
- [ ] 統合テストが作成され、以下のシナリオをカバーしている:
  - [ ] 正常な生成フロー
  - [ ] クォータ超過
  - [ ] 画像なし
  - [ ] 無効なパラメータ
  - [ ] AI生成失敗
- [ ] テストが全てpass

## Verification Commands

```bash
# テストの実行
cd bananadish-backend
npm test -- generate.test.ts

# サーバー起動
npm start

# 別ターミナルで手動テスト
```

**手動テスト**:

```bash
# 1. Firebase ID tokenを取得 (Firebase Console or SDK)
export ID_TOKEN="your_firebase_id_token"

# 2. 正常リクエスト
curl -X POST http://localhost:8080/v1/generate \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "image=@test-assets/sample-dish.jpg" \
  -F "aspect=4:5" \
  -F "style=natural" \
  -v

# 期待される結果:
# - 200 OK
# - JSON: { "aspect": "4:5", "count": 4, "images": [...], "usage": {...} }
# - images配列に4つの画像 (base64)

# 3. クォータ超過テスト (Firestoreで usage.currentPeriodUsed を limit と同じにする)
curl -X POST http://localhost:8080/v1/generate \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "image=@test-assets/sample-dish.jpg"

# 期待される結果:
# - 402 QUOTA_EXCEEDED

# 4. 無効なアスペクト比
curl -X POST http://localhost:8080/v1/generate \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "image=@test-assets/sample-dish.jpg" \
  -F "aspect=invalid"

# 期待される結果:
# - 400 INVALID_ASPECT
```

## Troubleshooting

### 問題: "Cannot read property 'buffer' of undefined"

**原因**: multerが正しくセットアップされていない

**解決策**:
```typescript
// multer.single('image') がルートハンドラー配列に含まれているか確認
export const generateHandler = [
  verifyAuth,
  upload.single('image'), // これが必要
  async (req: Request, res: Response) => { ... }
];
```

### 問題: Firestoreで "Permission denied"

**原因**: Firestore security rulesがアクセスをブロック

**解決策**:
```javascript
// バックエンドはFirebase Admin SDKを使用するため、security rulesを無視できる
// admin.initializeApp() が正しく初期化されているか確認
```

### 問題: レスポンスが30秒以上かかる

**原因**: AI生成 + 画像処理が遅い

**解決策**:
- Gemini APIのレスポンスタイムを確認
- 並列処理が正しく動作しているか確認
- Cloud Runのメモリ/CPU設定を確認 (T107)

## Deliverables

- Quota Managerモジュール: `src/services/quotaManager.ts`
- Generate Route: `src/routes/generate.ts`
- 統合テスト: `tests/routes/generate.test.ts`
- 更新されたサーバー: `src/server.ts`

## Notes

- **パフォーマンス**: 全処理で20-30秒かかる (AI生成が大部分)
- **レート制限**: 今後のタスクで実装予定 (10 requests/min per user)
- **ログ**: Cloud Loggingで全リクエストをトラッキング
- **次のタスク**: T106でサブスクリプションAPIを実装、T107でCloud Runにデプロイ
- **重要**: このエンドポイントがアプリの中核機能

## Estimated Time
3-4時間 (テスト・手動検証含む)
