export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[] = [];

  constructor(config: { maxRequests: number; windowMs: number }) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove expired timestamps
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const timeToWait = this.windowMs - (now - oldestRequest);
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
        return this.acquire(); // Retry
      }
    }

    this.requests.push(now);
  }
}
