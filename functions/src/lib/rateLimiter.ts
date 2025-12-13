// ============================================
// NeuroGUARDIAN — Rate Limiter
// Exponential backoff for API calls
// ============================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with exponential backoff retry
 * Retries on 429 (Too Many Requests) and 5xx errors
 */
export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry
      const status = error.response?.status;
      const shouldRetry = status === 429 || (status >= 500 && status < 600);
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms (status: ${status})`);
      
      // Check for Retry-After header
      const retryAfter = error.response?.headers?.['retry-after'];
      if (retryAfter) {
        const retryDelayMs = parseInt(retryAfter, 10) * 1000;
        if (!isNaN(retryDelayMs) && retryDelayMs > 0) {
          console.log(`Retry-After header: waiting ${retryAfter}s`);
          await sleep(Math.min(retryDelayMs, maxDelayMs));
          continue;
        }
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Rate limiter with sliding window
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  /**
   * Wait until a request can be made
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Remove old timestamps outside the window
    this.timestamps = this.timestamps.filter(
      (ts) => now - ts < this.windowMs
    );
    
    if (this.timestamps.length >= this.maxRequests) {
      // Calculate wait time
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp);
      
      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${waitTime}ms`);
        await sleep(waitTime);
        return this.acquire(); // Recursive call
      }
    }
    
    this.timestamps.push(Date.now());
  }
  
  /**
   * Get current request count in window
   */
  getCurrentCount(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (ts) => now - ts < this.windowMs
    );
    return this.timestamps.length;
  }
  
  /**
   * Reset the limiter
   */
  reset(): void {
    this.timestamps = [];
  }
}

/**
 * Create rate limiter for WB API (60 requests per minute)
 */
export function createWBRateLimiter(): RateLimiter {
  return new RateLimiter(60, 60 * 1000);
}

/**
 * Create rate limiter for Ozon API (more generous)
 */
export function createOzonRateLimiter(): RateLimiter {
  return new RateLimiter(100, 60 * 1000);
}
