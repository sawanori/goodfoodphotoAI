import { GeminiClient } from '../../src/services/geminiClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Generative AIをモック
jest.mock('@google/generative-ai');

describe('GeminiClient', () => {
  let geminiClient: GeminiClient;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    // モックのセットアップ
    mockGenerateContent = jest.fn();

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: mockGenerateContent,
      })),
    }));

    geminiClient = new GeminiClient('test-api-key');
  });

  describe('generateImages', () => {
    it('should generate images successfully', async () => {
      const mockImageData = Buffer.from('fake-image').toString('base64');
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const testImageBuffer = Buffer.from('test-image');
      const images = await geminiClient.generateImages(
        testImageBuffer,
        'image/jpeg',
        'natural'
      );

      expect(images).toHaveLength(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no candidates', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [],
        },
      });

      const testImageBuffer = Buffer.from('test-image');

      await expect(
        geminiClient.generateImages(testImageBuffer, 'image/jpeg', 'natural')
      ).rejects.toThrow('AI_GENERATION_FAILED');
    });
  });

  describe('generateWithRetry', () => {
    it('should return 4 images on first attempt', async () => {
      const mockImageData = Buffer.from('fake-image').toString('base64');
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: Array(4).fill({
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: mockImageData,
                  },
                }),
              },
            },
          ],
        },
      });

      const testImageBuffer = Buffer.from('test-image');
      const images = await geminiClient.generateWithRetry(
        testImageBuffer,
        'image/jpeg',
        'natural'
      );

      expect(images).toHaveLength(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should retry when less than 4 images returned', async () => {
      const mockImageData = Buffer.from('fake-image').toString('base64');

      // 1回目: 2枚だけ返す
      // 2回目: 2枚返す (合計4枚)
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: Array(2).fill({
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  }),
                },
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: Array(2).fill({
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  }),
                },
              },
            ],
          },
        });

      const testImageBuffer = Buffer.from('test-image');
      const images = await geminiClient.generateWithRetry(
        testImageBuffer,
        'image/jpeg',
        'natural'
      );

      expect(images).toHaveLength(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries with insufficient images', async () => {
      const mockImageData = Buffer.from('fake-image').toString('base64');

      // 常に1枚だけ返す (4枚に達しない)
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: mockImageData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const testImageBuffer = Buffer.from('test-image');

      await expect(
        geminiClient.generateWithRetry(testImageBuffer, 'image/jpeg', 'natural')
      ).rejects.toThrow('AI_GENERATION_FAILED');

      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // maxRetries = 3
    });
  });
});
