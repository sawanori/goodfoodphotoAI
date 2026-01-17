# T104: Gemini AI Integration

## Task Overview
Gemini 2.0 Flash Expモデル (最新版) を統合し、料理写真から4枚の高品質な画像を生成する機能を実装する。リトライロジックとサーキットブレーカーパターンを組み込み、AI生成の安定性を確保する。

## Dependencies
- **T101**: Backend Project Structure Setup (完了していること)
- **T003**: Development Environment Configuration (Gemini API keyがSecret Managerに保存済み)

## Target Files
以下のファイルを作成・変更:
- `bananadish-backend/src/services/geminiClient.ts` (新規作成)
- `bananadish-backend/src/utils/circuitBreaker.ts` (新規作成)
- `bananadish-backend/tests/services/geminiClient.test.ts` (新規作成)
- `bananadish-backend/package.json` (依存関係追加)
- `bananadish-backend/.env.example` (環境変数テンプレート更新)

## Implementation Steps

### Step 1: Gemini SDK依存関係の追加

```bash
cd bananadish-backend

# 正しいGemini SDKパッケージをインストール
npm install @google/generative-ai@^0.21.0
```

### Step 2: サーキットブレーカーの実装

`src/utils/circuitBreaker.ts` を作成:

```typescript
/**
 * Circuit Breaker Pattern Implementation
 *
 * 連続してエラーが発生した場合、一定期間リクエストをブロックし、
 * サービスの過負荷を防ぐ。
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  /**
   * @param threshold 開放するまでの連続失敗回数 (デフォルト: 5)
   * @param timeout 開放後、再試行を許可するまでの時間 (ミリ秒、デフォルト: 60秒)
   */
  constructor(threshold: number = 5, timeout: number = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  /**
   * 関数を実行し、サーキットブレーカーの状態を管理
   *
   * @param fn 実行する非同期関数
   * @returns 関数の結果
   * @throws SERVICE_UNAVAILABLE (サーキットが開いている場合)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('SERVICE_UNAVAILABLE');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * サーキットが開いているかチェック
   */
  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.timeout) {
        console.warn(
          `Circuit breaker is OPEN. Failures: ${this.failures}. Retry after ${
            (this.timeout - elapsed) / 1000
          } seconds.`
        );
        return true; // サーキット開放中
      } else {
        console.info('Circuit breaker attempting reset...');
        this.reset(); // タイムアウト後、リセットして再試行
      }
    }
    return false;
  }

  /**
   * 成功時の処理
   */
  private onSuccess() {
    this.failures = 0;
  }

  /**
   * 失敗時の処理
   */
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    console.error(`Circuit breaker failure count: ${this.failures}`);
  }

  /**
   * サーキットブレーカーをリセット
   */
  private reset() {
    this.failures = 0;
  }

  /**
   * 現在の状態を取得 (デバッグ用)
   */
  getStatus() {
    return {
      failures: this.failures,
      isOpen: this.isOpen(),
      lastFailureTime: this.lastFailureTime,
    };
  }
}
```

### Step 3: Gemini Clientの実装

`src/services/geminiClient.ts` を作成:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CircuitBreaker } from '../utils/circuitBreaker';

/**
 * スタイルオプション
 */
export type StyleOption = 'natural' | 'bright' | 'moody';

/**
 * Gemini API Client
 */
export class GeminiClient {
  private ai: GoogleGenerativeAI;
  private circuitBreaker: CircuitBreaker;
  private readonly model = 'gemini-2.0-flash-exp'; // 最新モデル

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.ai = new GoogleGenerativeAI(apiKey);
    this.circuitBreaker = new CircuitBreaker(5, 60000); // 5回失敗で60秒ブロック
  }

  /**
   * プロンプト生成 (スタイルに応じた日本語プロンプト)
   *
   * @param style 画像スタイル
   * @returns プロンプト文字列
   */
  private generatePrompt(style: StyleOption): string {
    const basePrompt = `この料理写真をベースに、料理そのものは変えずに、より美味しそうに見える写真を4パターン作ってください。

条件:
- 料理の形や盛り付けは維持してください（別の料理にしない）
- 照明を改善してください（自然光または柔らかいトップライトなど）
- ツヤと質感を上げてください（油・ソース・水分の立体感）
- 背景はうるさくしないでください（料理が主役）
- 文字やロゴは入れないでください
- 写真風でリアルに仕上げてください`;

    const styleModifiers: Record<StyleOption, string> = {
      natural: '自然な色味と柔らかい光で、温かみのある雰囲気にしてください。',
      bright: '明るく鮮やかな色で、活気のある印象にしてください。',
      moody: '落ち着いたトーンと繊細な影で、高級感のある雰囲気にしてください。',
    };

    return `${basePrompt}\n\nスタイル: ${styleModifiers[style]}`;
  }

  /**
   * 画像生成を実行
   *
   * @param imageBuffer 元画像のBuffer
   * @param mimeType 画像のMIMEタイプ (image/jpeg, image/png)
   * @param style スタイルオプション
   * @returns 生成された画像のBuffer配列
   */
  async generateImages(
    imageBuffer: Buffer,
    mimeType: string,
    style: StyleOption = 'natural'
  ): Promise<Buffer[]> {
    const prompt = this.generatePrompt(style);
    const base64Image = imageBuffer.toString('base64');

    console.log(`Generating images with Gemini (style: ${style})...`);

    const model = this.ai.getGenerativeModel({ model: this.model });

    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      },
      { text: prompt },
    ]);

    // レスポンスから画像を抽出
    const candidate = response.response.candidates?.[0];
    if (!candidate) {
      throw new Error('AI_GENERATION_FAILED: No candidates in response');
    }

    const parts = candidate.content?.parts || [];
    const images = parts
      .filter((p) => p.inlineData?.mimeType?.startsWith('image/'))
      .map((p) => {
        if (!p.inlineData?.data) {
          throw new Error('AI_GENERATION_FAILED: Missing image data');
        }
        return Buffer.from(p.inlineData.data, 'base64');
      });

    console.log(`Gemini returned ${images.length} images`);
    return images;
  }

  /**
   * リトライ付き画像生成 (4枚未満の場合に再試行)
   *
   * @param imageBuffer 元画像のBuffer
   * @param mimeType 画像のMIMEタイプ
   * @param style スタイルオプション
   * @param maxRetries 最大リトライ回数 (デフォルト: 3)
   * @returns 生成された4枚の画像Buffer配列
   * @throws AI_GENERATION_FAILED (リトライ後も4枚未満の場合)
   */
  async generateWithRetry(
    imageBuffer: Buffer,
    mimeType: string,
    style: StyleOption = 'natural',
    maxRetries: number = 3
  ): Promise<Buffer[]> {
    return this.circuitBreaker.execute(async () => {
      let allImages: Buffer[] = [];
      let attempts = 0;

      while (allImages.length < 4 && attempts < maxRetries) {
        attempts++;
        console.log(`Attempt ${attempts}/${maxRetries}`);

        try {
          const newImages = await this.generateImages(imageBuffer, mimeType, style);
          allImages.push(...newImages);

          if (allImages.length >= 4) {
            console.log(`✅ Successfully generated 4 images on attempt ${attempts}`);
            return allImages.slice(0, 4); // 最初の4枚を返す
          }

          console.warn(
            `⚠️ Only ${allImages.length} images so far. Retrying...`
          );

          // リトライ前に待機 (exponential backoff)
          if (attempts < maxRetries) {
            const waitTime = 1000 * attempts;
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        } catch (error) {
          console.error(`Attempt ${attempts} failed:`, error);

          // 最後の試行でエラーの場合は例外を投げる
          if (attempts >= maxRetries) {
            throw error;
          }

          // 次の試行前に待機
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }

      // リトライ後も4枚未満の場合
      throw new Error(
        `AI_GENERATION_FAILED: Only got ${allImages.length} images after ${attempts} attempts`
      );
    });
  }

  /**
   * サーキットブレーカーの状態を取得
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }
}

// シングルトンインスタンス
let geminiClientInstance: GeminiClient | null = null;

/**
 * Gemini Clientのインスタンスを取得
 *
 * @param apiKey Gemini API Key
 * @returns GeminiClientインスタンス
 */
export function getGeminiClient(apiKey?: string): GeminiClient {
  if (!geminiClientInstance) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    geminiClientInstance = new GeminiClient(key);
  }
  return geminiClientInstance;
}
```

### Step 4: 環境変数テンプレート更新

`.env.example` を作成・更新:

```bash
# Gemini API Key (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Service Account (for local development)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json

# Server Port
PORT=8080
```

### Step 5: ユニットテストの作成

`tests/services/geminiClient.test.ts` を作成:

```typescript
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
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] `@google/generative-ai` パッケージがインストールされている
- [ ] `src/utils/circuitBreaker.ts` でサーキットブレーカーが実装されている
- [ ] `src/services/geminiClient.ts` でGemini統合が実装されている
- [ ] 以下の機能が実装されている:
  - [ ] `generatePrompt()` - スタイル別プロンプト生成
  - [ ] `generateImages()` - 単一生成リクエスト
  - [ ] `generateWithRetry()` - リトライロジック (最大3回)
  - [ ] サーキットブレーカーパターン
- [ ] 正しいモデル名が使用されている: `gemini-2.0-flash-exp`
- [ ] 日本語プロンプトが実装されている
- [ ] 3つのスタイル (natural, bright, moody) がサポートされている
- [ ] 4枚未満の場合にリトライする
- [ ] リトライ時にexponential backoffを実装
- [ ] サーキットブレーカーが5回連続失敗で60秒ブロック
- [ ] ユニットテストが作成され、以下のシナリオをカバーしている:
  - [ ] 正常に4枚生成される
  - [ ] 候補なしエラー
  - [ ] リトライで4枚到達
  - [ ] リトライ後も4枚未満でエラー
- [ ] テストが全てpass

## Verification Commands

```bash
# テストの実行
cd bananadish-backend
npm test -- geminiClient.test.ts

# カバレッジ確認
npm run test:coverage -- geminiClient.test.ts

# ビルド確認
npm run build

# 期待される結果:
# - 全テストがpass
# - モックが正しく動作
```

**手動テスト** (実際のGemini APIを使用):

```bash
# 環境変数を設定
export GEMINI_API_KEY="your_actual_api_key"

# テストスクリプトを作成: scripts/test-gemini.ts
```

`scripts/test-gemini.ts`:

```typescript
import fs from 'fs/promises';
import { getGeminiClient } from '../src/services/geminiClient';

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: ts-node scripts/test-gemini.ts <image-path>');
    process.exit(1);
  }

  const imageBuffer = await fs.readFile(imagePath);
  const geminiClient = getGeminiClient();

  console.log('Generating images with Gemini...');
  const images = await geminiClient.generateWithRetry(
    imageBuffer,
    'image/jpeg',
    'natural'
  );

  console.log(`✅ Generated ${images.length} images`);

  // 画像を保存
  for (let i = 0; i < images.length; i++) {
    await fs.writeFile(`output-gemini-${i + 1}.jpg`, images[i]);
  }

  console.log('Images saved!');
}

main().catch(console.error);
```

実行:

```bash
npx ts-node scripts/test-gemini.ts test-assets/sample-dish.jpg

# 期待される結果:
# - "Generated 4 images" が表示される
# - output-gemini-1.jpg ~ output-gemini-4.jpg が保存される
# - 各画像が料理写真として自然に見える
```

## Troubleshooting

### 問題: "GEMINI_API_KEY is not set"

**解決策**:
```bash
# API Keyを取得 (Google AI Studio)
# https://aistudio.google.com/app/apikey

# 環境変数に設定
export GEMINI_API_KEY="your_api_key"

# または .env ファイルに追加
echo "GEMINI_API_KEY=your_api_key" >> .env
```

### 問題: "AI_GENERATION_FAILED: Only got 2 images"

**原因**: Gemini APIが4枚生成できなかった

**解決策**:
- リトライロジックが正しく実装されているか確認
- プロンプトを調整 (「4パターン」を強調)
- モデル名が正しいか確認: `gemini-2.0-flash-exp`

### 問題: サーキットブレーカーが開きっぱなし

**原因**: 連続して5回エラーが発生

**解決策**:
```typescript
// サーキットブレーカーの状態を確認
const status = geminiClient.getCircuitBreakerStatus();
console.log(status);

// 手動でリセット (デバッグ用)
// 60秒待つか、サーバーを再起動
```

## Deliverables

- Gemini Clientモジュール: `src/services/geminiClient.ts`
- サーキットブレーカー: `src/utils/circuitBreaker.ts`
- ユニットテスト: `tests/services/geminiClient.test.ts`
- テストスクリプト: `scripts/test-gemini.ts`
- 環境変数テンプレート: `.env.example`

## Notes

- **API Key管理**: 本番環境ではGCP Secret Managerから取得 (T107で設定)
- **コスト**: 1回の生成で約1290トークン消費 (画像生成は高コスト)
- **モデル**: `gemini-2.0-flash-exp` は2026年1月時点での最新モデル
- **プロンプト**: 日本語で具体的に指示することで品質が向上
- **次のタスク**: このGemini ClientはT105 (Generate API Endpoint) で使用される
- **重要**: 正しいパッケージ名は `@google/generative-ai`、クラス名は `GoogleGenerativeAI`

## Estimated Time
2-3時間 (テスト・実際のAPI確認含む)
