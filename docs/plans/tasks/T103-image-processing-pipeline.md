# T103: Image Processing Pipeline Implementation

## Task Overview
Sharp画像処理ライブラリを使用して、「contain + blurred background」アスペクト比フォーマット機能を実装する。食品画像をクロップせずに、指定されたアスペクト比に変換し、余白部分にぼかした背景を適用する。

## Dependencies
- **T101**: Backend Project Structure Setup (完了していること)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/src/services/imageProcessor.ts` (新規作成)
- `bananadish-backend/tests/services/imageProcessor.test.ts` (新規作成)
- `bananadish-backend/test-assets/sample-dish.jpg` (テスト用画像)
- `bananadish-backend/package.json` (依存関係追加)

## Implementation Steps

### Step 1: Sharp依存関係の追加

```bash
cd bananadish-backend

# Sharpをインストール (最新の安定版)
npm install sharp@^0.33.5
```

### Step 2: 画像処理モジュールの実装

`src/services/imageProcessor.ts` を作成:

```typescript
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
```

### Step 3: ユニットテストの作成

まず、テスト用画像を準備:

```bash
# test-assets ディレクトリを作成
mkdir -p bananadish-backend/test-assets

# テスト用の料理画像をダウンロード (または任意の画像を配置)
# サンプル: 800x600の料理画像
# ここでは、実際のプロジェクトで適切な画像を用意してください
```

`tests/services/imageProcessor.test.ts` を作成:

```typescript
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  formatNoCrop,
  formatMultipleImages,
  getImageMetadata,
  validateImage,
  AspectRatio,
} from '../../src/services/imageProcessor';

// テスト用画像のパス
const TEST_IMAGE_PATH = path.join(__dirname, '../../test-assets/sample-dish.jpg');

describe('Image Processor', () => {
  let testImageBuffer: Buffer;

  beforeAll(async () => {
    // テスト画像が存在しない場合はモック画像を生成
    try {
      testImageBuffer = await fs.readFile(TEST_IMAGE_PATH);
    } catch {
      // モック画像を生成 (800x600 JPEGの赤い四角)
      testImageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();
    }
  });

  describe('formatNoCrop', () => {
    it('should format image to 4:5 aspect ratio', async () => {
      const result = await formatNoCrop(testImageBuffer, '4:5');

      // 結果の検証
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1350);
      expect(metadata.format).toBe('jpeg');
    });

    it('should format image to 9:16 aspect ratio', async () => {
      const result = await formatNoCrop(testImageBuffer, '9:16');

      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    });

    it('should format image to 16:9 aspect ratio', async () => {
      const result = await formatNoCrop(testImageBuffer, '16:9');

      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(1920);
      expect(metadata.height).toBe(1080);
    });

    it('should format image to 1:1 aspect ratio', async () => {
      const result = await formatNoCrop(testImageBuffer, '1:1');

      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1080);
    });

    it('should produce valid JPEG output', async () => {
      const result = await formatNoCrop(testImageBuffer, '4:5');

      // JPEGとして読み込めることを確認
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('jpeg');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatMultipleImages', () => {
    it('should process 4 images in parallel', async () => {
      const buffers = [
        testImageBuffer,
        testImageBuffer,
        testImageBuffer,
        testImageBuffer,
      ];

      const startTime = Date.now();
      const results = await formatMultipleImages(buffers, '4:5');
      const duration = Date.now() - startTime;

      // 4つの画像が返される
      expect(results).toHaveLength(4);

      // 全て正しいサイズ
      for (const result of results) {
        const metadata = await sharp(result).metadata();
        expect(metadata.width).toBe(1080);
        expect(metadata.height).toBe(1350);
      }

      // 並列処理により高速 (5秒以内)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('getImageMetadata', () => {
    it('should return correct metadata', async () => {
      const metadata = await getImageMetadata(testImageBuffer);

      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(['jpeg', 'png']).toContain(metadata.format);
      expect(metadata.size).toBeGreaterThan(0);
    });

    it('should throw error for invalid image', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(getImageMetadata(invalidBuffer)).rejects.toThrow(
        'INVALID_IMAGE_FORMAT'
      );
    });
  });

  describe('validateImage', () => {
    it('should pass validation for valid image', async () => {
      await expect(validateImage(testImageBuffer)).resolves.not.toThrow();
    });

    it('should reject image too large', async () => {
      // 11MBのダミーバッファ
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      await expect(validateImage(largeBuffer)).rejects.toThrow(
        'FILE_TOO_LARGE'
      );
    });

    it('should reject invalid format', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(validateImage(invalidBuffer)).rejects.toThrow();
    });

    it('should reject image too small', async () => {
      // 320x240の小さい画像
      const smallImage = await sharp({
        create: {
          width: 320,
          height: 240,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      await expect(validateImage(smallImage)).rejects.toThrow(
        'IMAGE_TOO_SMALL'
      );
    });
  });
});
```

### Step 4: 視覚的検証スクリプトの作成 (オプション)

`scripts/test-image-processing.ts` を作成:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { formatNoCrop, AspectRatio } from '../src/services/imageProcessor';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: ts-node scripts/test-image-processing.ts <input-image>');
    process.exit(1);
  }

  const imageBuffer = await fs.readFile(inputPath);

  const aspects: AspectRatio[] = ['4:5', '9:16', '16:9', '1:1'];

  for (const aspect of aspects) {
    console.log(`Processing ${aspect}...`);
    const result = await formatNoCrop(imageBuffer, aspect);

    const outputPath = path.join(
      __dirname,
      `../output-${aspect.replace(':', '-')}.jpg`
    );
    await fs.writeFile(outputPath, result);
    console.log(`Saved to ${outputPath}`);
  }

  console.log('✅ All aspect ratios processed!');
}

main().catch(console.error);
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `sharp` パッケージがインストールされている
- [ ] `src/services/imageProcessor.ts` で画像処理機能が実装されている
- [ ] 以下の関数が実装されている:
  - [ ] `formatNoCrop()` - 単一画像のアスペクト比変換
  - [ ] `formatMultipleImages()` - 複数画像の並列処理
  - [ ] `getImageMetadata()` - 画像メタデータ取得
  - [ ] `validateImage()` - 画像バリデーション
- [ ] 全てのアスペクト比 (4:5, 9:16, 16:9, 1:1) がサポートされている
- [ ] "Contain + Blurred Background" アルゴリズムが正しく実装されている:
  - [ ] 背景: cover resize + blur(30)
  - [ ] 前景: contain resize (透明背景)
  - [ ] 合成: 前景を背景の上に重ねる
- [ ] 出力形式: JPEG, quality 88, mozjpeg圧縮
- [ ] ユニットテストが作成され、以下のシナリオをカバーしている:
  - [ ] 各アスペクト比で正しいサイズの画像が生成される
  - [ ] 4枚の画像を並列処理できる
  - [ ] 処理時間が5秒以内 (4枚)
  - [ ] 画像バリデーションが正しく動作する
  - [ ] 無効な画像でエラーが発生する
- [ ] テストが全てpass

## Verification Commands

```bash
# テストの実行
cd bananadish-backend
npm test -- imageProcessor.test.ts

# カバレッジ確認
npm run test:coverage -- imageProcessor.test.ts

# ビルド確認
npm run build

# 期待される結果:
# - 全テストがpass
# - 各アスペクト比で正しいサイズの画像が生成される
# - 並列処理が5秒以内に完了
```

**視覚的検証** (実際の画像で確認):

```bash
# テスト用の料理画像を用意
# 例: test-assets/sample-dish.jpg

# 処理スクリプト実行
npx ts-node scripts/test-image-processing.ts test-assets/sample-dish.jpg

# 出力画像を確認:
# - output-4-5.jpg (1080x1350)
# - output-9-16.jpg (1080x1920)
# - output-16-9.jpg (1920x1080)
# - output-1-1.jpg (1080x1080)

# 視覚的に確認すべき点:
# ✓ 料理全体が写っている (クロップされていない)
# ✓ 余白部分にぼかした背景が表示されている
# ✓ 背景が自然に見える
# ✓ 料理が中央に配置されている
```

## Troubleshooting

### 問題: "sharp installation failed"

**原因**: ネイティブモジュールのビルドエラー

**解決策**:
```bash
# macOSの場合
brew install vips

# Linuxの場合
sudo apt-get install libvips-dev

# 再インストール
npm install sharp --force
```

### 問題: メモリ不足エラー

**原因**: 大きな画像を複数同時処理

**解決策**:
```typescript
// 並列処理の数を制限
async function formatMultipleImagesWithLimit(
  imageBuffers: Buffer[],
  aspect: AspectRatio,
  concurrency: number = 2
): Promise<Buffer[]> {
  const results: Buffer[] = [];

  for (let i = 0; i < imageBuffers.length; i += concurrency) {
    const batch = imageBuffers.slice(i, i + concurrency);
    const processed = await Promise.all(
      batch.map((buffer) => formatNoCrop(buffer, aspect))
    );
    results.push(...processed);
  }

  return results;
}
```

### 問題: 画像が歪んで見える

**原因**: アスペクト比の計算ミス、または contain の設定ミス

**解決策**:
- `fit: 'contain'` が正しく設定されているか確認
- `background: { r: 0, g: 0, b: 0, alpha: 0 }` が設定されているか確認
- 出力画像のメタデータを確認

## Deliverables

- 画像処理モジュール: `src/services/imageProcessor.ts`
- ユニットテスト: `tests/services/imageProcessor.test.ts`
- テストスクリプト: `scripts/test-image-processing.ts` (オプション)
- 視覚的検証済みの出力サンプル (各アスペクト比)

## Notes

- **パフォーマンス**: Sharpは非常に高速だが、4枚同時処理は約2-4秒かかる (画像サイズによる)
- **メモリ**: 並列処理時はメモリ使用量に注意 (Cloud Runでは2GiB割り当て予定)
- **品質**: mozjpeg圧縮により、高品質でファイルサイズを抑える
- **次のタスク**: この画像処理機能はT105 (Generate API Endpoint) で使用される
- **設計意図**: 「クロップなし」は重要な制約 - 料理全体を必ず表示すること

## Estimated Time
2-3時間 (テスト・視覚的検証含む)
