import sharp from 'sharp';
import {
  formatNoCrop,
  formatMultipleImages,
  getImageMetadata,
  validateImage,
  AspectRatio,
} from '../../src/services/imageProcessor';

describe('Image Processor', () => {
  let testImageBuffer: Buffer;

  beforeAll(async () => {
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
