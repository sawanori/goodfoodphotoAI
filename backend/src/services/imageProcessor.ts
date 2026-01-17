import sharp from 'sharp';

/**
 * サポートするアスペクト比
 */
export type AspectRatio = '4:5' | '9:16' | '16:9' | '1:1';

/**
 * アスペクト比ごとの出力サイズ定義
 * Instagram等のSNSで推奨されるサイズ
 */
const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  '4:5': { w: 1080, h: 1350 },   // Instagram portrait
  '9:16': { w: 1080, h: 1920 },  // Instagram story/reel
  '16:9': { w: 1920, h: 1080 },  // YouTube thumbnail
  '1:1': { w: 1080, h: 1080 },   // Instagram square
};

/**
 * "Contain + Blurred Background" 方式で画像をアスペクト比変換
 *
 * アルゴリズム:
 * 1. 背景レイヤー: 元画像をcover resizeでトリミング + 強いブラー
 * 2. 前景レイヤー: 元画像をcontain resizeで全体を収める (透明背景)
 * 3. 合成: 前景を背景の上に重ねる
 *
 * @param imageBuffer 元画像のBuffer
 * @param aspect 目標アスペクト比
 * @returns フォーマット済み画像のBuffer (JPEG)
 */
export async function formatNoCrop(
  imageBuffer: Buffer,
  aspect: AspectRatio
): Promise<Buffer> {
  const { w, h } = ASPECT_RATIO_DIMENSIONS[aspect];

  try {
    // Step 1: ぼかし背景の作成
    // 元画像をターゲットサイズにcover resize (中央部分をトリミング)
    // その後、強いブラー効果を適用
    const background = await sharp(imageBuffer)
      .resize(w, h, {
        fit: 'cover',           // 画像全体をカバー (一部がクロップされる)
        position: 'centre',      // 中央を基準にクロップ
      })
      .blur(30)                  // ブラー強度30 (自然な背景効果)
      .jpeg({ quality: 80 })     // 背景は若干低品質でOK
      .toBuffer();

    // Step 2: 前景画像の作成 (contain = クロップなし)
    // 元画像をターゲットサイズに収める (全体が見える)
    // 透明背景を維持するためにPNG形式
    const foreground = await sharp(imageBuffer)
      .resize(w, h, {
        fit: 'contain',          // 画像全体を収める (クロップなし)
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
      })
      .png()                     // 透明度保持のためPNG
      .toBuffer();

    // Step 3: 合成
    // 背景の上に前景を重ねる
    const output = await sharp(background)
      .composite([
        {
          input: foreground,
          gravity: 'center',     // 中央配置
        },
      ])
      .jpeg({
        quality: 88,             // 高品質 (SNS投稿に適した品質)
        mozjpeg: true,           // mozjpeg圧縮 (高品質で軽量)
      })
      .toBuffer();

    return output;
  } catch (error) {
    console.error('Image processing failed:', error);
    throw new Error('IMAGE_PROCESSING_ERROR');
  }
}

/**
 * 複数画像を並列処理 (4枚同時処理)
 *
 * @param imageBuffers 画像Bufferの配列
 * @param aspect 目標アスペクト比
 * @returns フォーマット済み画像Bufferの配列
 */
export async function formatMultipleImages(
  imageBuffers: Buffer[],
  aspect: AspectRatio
): Promise<Buffer[]> {
  // Promise.allで並列処理 (メモリに注意)
  const formattedImages = await Promise.all(
    imageBuffers.map((buffer) => formatNoCrop(buffer, aspect))
  );

  return formattedImages;
}

/**
 * 画像の基本情報を取得 (バリデーション用)
 *
 * @param imageBuffer 画像Buffer
 * @returns メタデータ { width, height, format, size }
 */
export async function getImageMetadata(imageBuffer: Buffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: imageBuffer.length,
    };
  } catch (error) {
    throw new Error('INVALID_IMAGE_FORMAT');
  }
}

/**
 * 画像バリデーション
 *
 * @param imageBuffer 画像Buffer
 * @throws エラー (バリデーション失敗時)
 */
export async function validateImage(imageBuffer: Buffer): Promise<void> {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const MIN_WIDTH = 640;
  const MIN_HEIGHT = 480;

  // サイズチェック
  if (imageBuffer.length > MAX_SIZE) {
    throw new Error('FILE_TOO_LARGE');
  }

  // メタデータ取得
  const metadata = await getImageMetadata(imageBuffer);

  // フォーマットチェック
  if (!['jpeg', 'jpg', 'png'].includes(metadata.format)) {
    throw new Error('INVALID_IMAGE_FORMAT');
  }

  // 解像度チェック
  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    throw new Error('IMAGE_TOO_SMALL');
  }
}
