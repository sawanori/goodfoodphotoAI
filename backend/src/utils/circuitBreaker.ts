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
