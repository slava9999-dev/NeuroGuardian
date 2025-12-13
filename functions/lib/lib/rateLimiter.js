"use strict";
// ============================================
// NeuroGUARDIAN — Rate Limiter
// Exponential backoff for API calls
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
exports.sleep = sleep;
exports.exponentialBackoff = exponentialBackoff;
exports.createWBRateLimiter = createWBRateLimiter;
exports.createOzonRateLimiter = createOzonRateLimiter;
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Execute function with exponential backoff retry
 * Retries on 429 (Too Many Requests) and 5xx errors
 */
async function exponentialBackoff(fn, maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if we should retry
            const status = error.response?.status;
            const shouldRetry = status === 429 || (status >= 500 && status < 600);
            if (!shouldRetry || attempt === maxRetries) {
                throw error;
            }
            // Calculate delay with exponential backoff + jitter
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);
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
class RateLimiter {
    timestamps = [];
    windowMs;
    maxRequests;
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }
    /**
     * Wait until a request can be made
     */
    async acquire() {
        const now = Date.now();
        // Remove old timestamps outside the window
        this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
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
    getCurrentCount() {
        const now = Date.now();
        this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
        return this.timestamps.length;
    }
    /**
     * Reset the limiter
     */
    reset() {
        this.timestamps = [];
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Create rate limiter for WB API (60 requests per minute)
 */
function createWBRateLimiter() {
    return new RateLimiter(60, 60 * 1000);
}
/**
 * Create rate limiter for Ozon API (more generous)
 */
function createOzonRateLimiter() {
    return new RateLimiter(100, 60 * 1000);
}
//# sourceMappingURL=rateLimiter.js.map