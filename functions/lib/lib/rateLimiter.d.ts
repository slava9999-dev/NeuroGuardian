/**
 * Sleep for specified milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Execute function with exponential backoff retry
 * Retries on 429 (Too Many Requests) and 5xx errors
 */
export declare function exponentialBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelayMs?: number, maxDelayMs?: number): Promise<T>;
/**
 * Rate limiter with sliding window
 */
export declare class RateLimiter {
    private timestamps;
    private readonly windowMs;
    private readonly maxRequests;
    constructor(maxRequests: number, windowMs: number);
    /**
     * Wait until a request can be made
     */
    acquire(): Promise<void>;
    /**
     * Get current request count in window
     */
    getCurrentCount(): number;
    /**
     * Reset the limiter
     */
    reset(): void;
}
/**
 * Create rate limiter for WB API (60 requests per minute)
 */
export declare function createWBRateLimiter(): RateLimiter;
/**
 * Create rate limiter for Ozon API (more generous)
 */
export declare function createOzonRateLimiter(): RateLimiter;
//# sourceMappingURL=rateLimiter.d.ts.map