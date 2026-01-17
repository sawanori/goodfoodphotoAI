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
