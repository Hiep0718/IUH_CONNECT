/**
 * Rate Limiter — Token Bucket Algorithm
 * Giới hạn số lượng API calls phía client để tránh spam/abuse.
 * 
 * Cách hoạt động:
 * - Mỗi bucket có số lượng tokens tối đa (maxTokens)
 * - Mỗi request tiêu tốn 1 token
 * - Tokens được refill theo thời gian (refillRate tokens/giây)
 * - Khi hết tokens → request bị từ chối (return false)
 */
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number = 10, refillRate: number = 2) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Kiểm tra và tiêu thụ 1 token.
   * @returns true nếu được phép gửi request, false nếu bị rate limited
   */
  canProceed(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    console.warn('⚠️ [RateLimiter] Request blocked — rate limit exceeded');
    return false;
  }

  /**
   * Refill tokens dựa trên thời gian đã trôi qua
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }

  /**
   * Số tokens còn lại
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Reset rate limiter về trạng thái ban đầu
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

/**
 * Rate limiter cho HTTP API calls (login, load contacts, etc.)
 * 50 tokens max, refill 10 tokens/giây
 * → Cho phép burst 50 request, sau đó 10 req/s bình thường
 */
export const apiRateLimiter = new RateLimiter(50, 10);

/**
 * Rate limiter cho chat messages (WebSocket send)
 * 20 tokens max, refill 5 token/giây
 */
export const chatRateLimiter = new RateLimiter(20, 5);

export default RateLimiter;
