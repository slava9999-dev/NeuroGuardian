// ============================================
// NeuroGUARDIAN — Circuit Breaker v1.0.0
// Prevents cascade failures on external service outages
// Pattern: Closed → Open → Half-Open
// ============================================

import { logger } from './logger.js';

// ============================================
// TYPES
// ============================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  /** Name of the service (for logging) */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open state before closing */
  successThreshold: number;
  /** Optional: timeout for each call in ms */
  callTimeoutMs?: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  consecutiveSuccesses: number;
}

// ============================================
// DEFAULT CONFIGS FOR COMMON SERVICES
// ============================================

export const CircuitBreakerPresets = {
  /** External APIs (WB, Ozon) - more tolerant */
  MARKETPLACE_API: {
    failureThreshold: 5,
    resetTimeoutMs: 60_000, // 1 minute
    successThreshold: 2,
    callTimeoutMs: 30_000,
  },
  /** LLM APIs (Gemini, OpenAI) - less tolerant */
  LLM_API: {
    failureThreshold: 3,
    resetTimeoutMs: 30_000, // 30 seconds
    successThreshold: 1,
    callTimeoutMs: 60_000,
  },
  /** Local services (Redis, Chroma) - fast recovery */
  LOCAL_SERVICE: {
    failureThreshold: 3,
    resetTimeoutMs: 10_000, // 10 seconds
    successThreshold: 1,
    callTimeoutMs: 5_000,
  },
  /** Database - critical, needs fast recovery */
  DATABASE: {
    failureThreshold: 2,
    resetTimeoutMs: 5_000, // 5 seconds
    successThreshold: 1,
    callTimeoutMs: 10_000,
  },
} as const;

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitBreakerState;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...config,
      callTimeoutMs: config.callTimeoutMs ?? 30_000,
    };

    this.state = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveSuccesses: 0,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() - this.state.lastFailureTime >= this.config.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.config.name, this.getRemainingResetTime());
      }
    }

    try {
      // Execute with timeout if configured
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute a function with fallback on circuit open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn(`[CircuitBreaker:${this.config.name}] Circuit open, using fallback`);
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Get current state for monitoring
   */
  getStatus(): {
    name: string;
    state: CircuitState;
    failures: number;
    lastFailure: string | null;
    resetIn: number | null;
  } {
    return {
      name: this.config.name,
      state: this.state.state,
      failures: this.state.failures,
      lastFailure: this.state.lastFailureTime
        ? new Date(this.state.lastFailureTime).toISOString()
        : null,
      resetIn: this.state.state === 'OPEN' ? this.getRemainingResetTime() : null,
    };
  }

  /**
   * Force reset the circuit (for admin use)
   */
  forceReset(): void {
    logger.info(`[CircuitBreaker:${this.config.name}] Force reset`);
    this.state = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveSuccesses: 0,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeout = this.config.callTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${this.config.name} call timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.state.successes++;
    this.state.lastSuccessTime = Date.now();
    this.state.consecutiveSuccesses++;

    if (this.state.state === 'HALF_OPEN') {
      if (this.state.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state.state === 'CLOSED') {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    this.state.consecutiveSuccesses = 0;

    logger.warn(`[CircuitBreaker:${this.config.name}] Failure #${this.state.failures}`, {
      error: error instanceof Error ? error.message : String(error),
      threshold: this.config.failureThreshold,
    });

    if (this.state.state === 'HALF_OPEN') {
      // Any failure in half-open state reopens the circuit
      this.transitionTo('OPEN');
    } else if (this.state.failures >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;
    this.state.state = newState;

    logger.info(`[CircuitBreaker:${this.config.name}] State: ${oldState} → ${newState}`, {
      failures: this.state.failures,
      successThreshold: this.config.successThreshold,
    });

    if (newState === 'CLOSED') {
      this.state.failures = 0;
      this.state.consecutiveSuccesses = 0;
    } else if (newState === 'HALF_OPEN') {
      this.state.consecutiveSuccesses = 0;
    }
  }

  private getRemainingResetTime(): number {
    return Math.max(0, this.config.resetTimeoutMs - (Date.now() - this.state.lastFailureTime));
  }
}

// ============================================
// ERROR CLASS
// ============================================

export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(
      `Circuit breaker for ${serviceName} is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
  }
}

// ============================================
// CIRCUIT BREAKER REGISTRY (Singleton)
// ============================================

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a service
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      const preset = this.getPresetForName(name);
      breaker = new CircuitBreaker({
        name,
        ...preset,
        ...config,
      });
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus(): ReturnType<CircuitBreaker['getStatus']>[] {
    return Array.from(this.breakers.values()).map(b => b.getStatus());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(b => b.forceReset());
  }

  private getPresetForName(
    name: string
  ): (typeof CircuitBreakerPresets)[keyof typeof CircuitBreakerPresets] {
    const lowerName = name.toLowerCase();

    if (
      lowerName.includes('wb') ||
      lowerName.includes('ozon') ||
      lowerName.includes('marketplace')
    ) {
      return CircuitBreakerPresets.MARKETPLACE_API;
    }
    if (lowerName.includes('llm') || lowerName.includes('gemini') || lowerName.includes('openai')) {
      return CircuitBreakerPresets.LLM_API;
    }
    if (
      lowerName.includes('redis') ||
      lowerName.includes('chroma') ||
      lowerName.includes('local')
    ) {
      return CircuitBreakerPresets.LOCAL_SERVICE;
    }
    if (
      lowerName.includes('db') ||
      lowerName.includes('postgres') ||
      lowerName.includes('database')
    ) {
      return CircuitBreakerPresets.DATABASE;
    }

    // Default to marketplace API config
    return CircuitBreakerPresets.MARKETPLACE_API;
  }
}

// Singleton instance
export const circuitBreakers = new CircuitBreakerRegistry();

// ============================================
// CONVENIENCE WRAPPER
// ============================================

/**
 * Wrap an async function with circuit breaker protection
 * @example
 * const result = await withCircuitBreaker('ozon-api', () => fetchOzonProducts());
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  const breaker = circuitBreakers.get(serviceName);

  if (fallback) {
    return breaker.executeWithFallback(fn, fallback);
  }

  return breaker.execute(fn);
}
