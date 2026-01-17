import { Request, Response } from 'express';
import multer from 'multer';
import { verifyAuth } from '../middleware/auth';
import { getGeminiClient } from '../services/geminiClient';
import { formatMultipleImages, validateImage, AspectRatio } from '../services/imageProcessor';
import { checkQuota, incrementUsage, getUserQuota } from '../services/quotaManager';
import { getFirestore, firebaseAdmin } from '../firebase';

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
 * Firestore生成ログ記録関数
 *
 * @param userId - ユーザーID
 * @param aspectRatio - アスペクト比
 * @param imageCount - 生成画像数
 * @param generatedImages - 生成された画像のbase64データ配列
 */
const logGeneration = async (
  userId: string,
  aspectRatio: string,
  imageCount: number,
  generatedImages: string[]
): Promise<void> => {
  try {
    const db = getFirestore();
    await db.collection('generations').add({
      userId,
      aspectRatio,
      imageCount,
      generatedImages,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Generation logged for user ${userId}: ${imageCount} images`);
  } catch (error) {
    console.error('Failed to log generation:', error);
    // ログ失敗はエラーとしない
  }
};

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

      // Step 5.5: 生成ログをFirestoreに記録
      const imageBase64Array = formattedImages.map((buffer) => buffer.toString('base64'));
      await logGeneration(userId, aspect, formattedImages.length, imageBase64Array);

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
