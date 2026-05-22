/**
 * Retry Service — Retry with Delay 3-5s
 * Tự động retry HTTP API calls khi thất bại.
 * Mỗi lần retry cách nhau 3-5 giây (random) để tránh thundering herd.
 * 
 * Lưu ý: Chỉ áp dụng cho HTTP API calls.
 * WebSocket messages đã có cơ chế retry riêng (offlineQueue + exponential backoff).
 */

/**
 * Retry một async function với delay 3-5 giây giữa các lần thử.
 * 
 * @param fn - Function cần retry (HTTP API call)
 * @param options - Cấu hình retry
 * @returns Kết quả của function khi thành công
 * @throws Error khi đã hết số lần retry
 * 
 * @example
 * ```typescript
 * const response = await retryWithDelay(
 *   () => fetch(`${API_URL}/api/v1/chat/conversations`, { headers }),
 *   { maxRetries: 3, minDelay: 3000, maxDelay: 5000 }
 * );
 * ```
 */
export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    minDelay?: number;  // milliseconds (default: 3000)
    maxDelay?: number;  // milliseconds (default: 5000)
    shouldRetry?: (error: any) => boolean; // Custom retry condition
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    minDelay = 3000,
    maxDelay = 5000,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if this error is retryable
      if (!shouldRetry(error)) {
        console.log(`🚫 [Retry] Non-retryable error, aborting: ${error}`);
        break;
      }

      // Random delay between 3-5 seconds
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      console.log(
        `🔄 [Retry] Attempt ${attempt + 1}/${maxRetries} failed. ` +
        `Retrying in ${Math.round(delay / 1000)}s...`,
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Default retry condition:
 * - Retry on network errors (TypeError: Network request failed)
 * - Retry on 5xx server errors
 * - Do NOT retry on 4xx client errors (401, 403, 404, etc.)
 */
function defaultShouldRetry(error: any): boolean {
  // Network errors (no internet, DNS failure, etc.)
  if (error instanceof TypeError && error.message.includes('Network')) {
    return true;
  }

  // HTTP errors with status code
  if (error?.status) {
    // Retry on server errors (5xx)
    return error.status >= 500 && error.status < 600;
  }

  // Retry on unknown errors
  return true;
}

/**
 * Wrapper cho fetch() với retry logic.
 * Kết hợp fetch + retry + error handling.
 * 
 * @example
 * ```typescript
 * const data = await fetchWithRetry(`${API_URL}/api/v1/contacts`, {
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions?: Parameters<typeof retryWithDelay>[1],
): Promise<Response> {
  return retryWithDelay(async () => {
    const response = await fetch(url, options);

    // Throw on server errors to trigger retry
    if (response.status >= 500) {
      const error: any = new Error(`Server error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response;
  }, retryOptions);
}
