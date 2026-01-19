/**
 * ============================================
 * Security Agent - AI Agent Guard Module
 * ============================================
 * Защита AI Agent от prompt injection, token abuse, и hallucinations
 *
 * Requirements (Day 6):
 * - LLMGuard integration для prompt validation
 * - Token budget enforcement (1000 tokens/user/day)
 * - Circuit breaker для LLM errors
 * - Prompt injection detection
 * - Metrics: prompt_injection_attempts, hallucination_rate
 */

import { z } from 'zod';
import type { AuditLogger } from './audit.js';

// ============================================
// Schemas
// ============================================

const PromptValidationRequestSchema = z.object({
  userId: z.string().min(1),
  prompt: z.string().min(1).max(10000), // Max 10k chars
  context: z.string().optional(),
  model: z.string().default('gpt-4'),
});

export const TokenBudgetSchema = z.object({
  userId: z.string(),
  dailyLimit: z.number().int().positive().default(1000),
  currentUsage: z.number().int().nonnegative().default(0),
  resetAt: z.string().datetime(),
});

export const CircuitBreakerStateSchema = z.object({
  state: z.enum(['closed', 'open', 'half_open']),
  failureCount: z.number().int().nonnegative(),
  lastFailureTime: z.string().datetime().optional(),
  nextAttemptTime: z.string().datetime().optional(),
});

export type PromptValidationRequest = z.infer<typeof PromptValidationRequestSchema>;
export type TokenBudget = z.infer<typeof TokenBudgetSchema>;
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

// ============================================
// Prompt Injection Patterns
// ============================================

const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction override
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(all\s+)?(previous|earlier)\s+instructions?/i,
  /disregard\s+(all\s+)?previous\s+instructions?/i,

  // Role manipulation
  /you\s+are\s+now\s+a\s+/i,
  /act\s+as\s+(a\s+)?different/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /simulate\s+being/i,

  // System prompt extraction
  /show\s+(me\s+)?(your|the)\s+system\s+prompt/i,
  /what\s+(is|are)\s+your\s+(initial|original)\s+instructions?/i,
  /repeat\s+your\s+instructions/i,

  // Jailbreak attempts
  /DAN\s+mode/i, // "Do Anything Now"
  /developer\s+mode/i,
  /admin\s+mode/i,
  /sudo\s+mode/i,

  // Data extraction
  /list\s+all\s+(users|products|secrets|keys)/i,
  /show\s+(all\s+)?(database|table|schema)/i,
  /export\s+data/i,

  // Code injection
  /```[\s\S]*?execute[\s\S]*?```/i,
  /eval\(/i,
  /exec\(/i,
];

// ============================================
// AI Agent Guard Class
// ============================================

export class AIAgentGuard {
  private audit: AuditLogger | null = null;
  private tokenBudgets = new Map<string, TokenBudget>();
  private circuitBreaker: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
  };

  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly TIMEOUT_MS = 60000; // 1 minute timeout in open state

  /**
   * Set dependencies
   */
  setDependencies(audit: AuditLogger): void {
    this.audit = audit;
  }

  /**
   * Initialize
   */
  async initialize(): Promise<void> {
    if (!this.audit) {
      throw new Error('AIAgentGuard: audit logger not set');
    }

    // Initialize token budgets from storage (в production - из Redis/DB)
    // For now, budgets are in-memory

    console.log('[AIAgentGuard] Initialized');
  }

  // ============================================
  // Prompt Validation & Injection Detection
  // ============================================

  /**
   * Validate prompt for injection attempts
   */
  async validatePrompt(request: PromptValidationRequest): Promise<{
    safe: boolean;
    blocked: boolean;
    reason?: string;
    sanitizedPrompt?: string;
  }> {
    PromptValidationRequestSchema.parse(request);

    console.log('[AIAgentGuard] Validating prompt', {
      userId: request.userId,
      promptLength: request.prompt.length,
    });

    // Check for prompt injection patterns
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(request.prompt)) {
        // Detected injection attempt
        if (this.audit) {
          await this.audit.log({
            event: 'ai_agent.prompt_injection_detected',
            category: 'security',
            severity: 'critical',
            userId: request.userId,
            metadata: {
              prompt: request.prompt.substring(0, 200), // Log first 200 chars only
              pattern: pattern.source,
            },
          });
        }

        console.warn('[AIAgentGuard] Prompt injection detected', {
          userId: request.userId,
          pattern: pattern.source,
        });

        return {
          safe: false,
          blocked: true,
          reason: 'Potential prompt injection detected',
        };
      }
    }

    // Additional safety checks
    const containsSuspiciousKeywords = this.checkSuspiciousKeywords(request.prompt);
    if (containsSuspiciousKeywords) {
      return {
        safe: false,
        blocked: false, // Warning but not blocked
        reason: 'Prompt contains suspicious keywords',
        sanitizedPrompt: this.sanitizePrompt(request.prompt),
      };
    }

    // Check prompt length (reasonable limit)
    if (request.prompt.length > 5000) {
      return {
        safe: false,
        blocked: true,
        reason: 'Prompt exceeds maximum length',
      };
    }

    console.log('[AIAgentGuard] Prompt validated successfully');

    return {
      safe: true,
      blocked: false,
    };
  }

  /**
   * Check for suspicious keywords
   */
  private checkSuspiciousKeywords(prompt: string): boolean {
    const suspiciousKeywords = [
      'api_key',
      'secret',
      'password',
      'token',
      'admin_key',
      'database',
      'DROP TABLE',
      'DELETE FROM',
    ];

    const lowerPrompt = prompt.toLowerCase();
    return suspiciousKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()));
  }

  /**
   * Sanitize prompt by removing suspicious content
   */
  private sanitizePrompt(prompt: string): string {
    // Basic sanitization: remove potential code blocks
    let sanitized = prompt;

    // Remove code blocks
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code block removed]');

    // Remove potential SQL
    sanitized = sanitized.replace(/DROP\s+TABLE/gi, '[SQL removed]');
    sanitized = sanitized.replace(/DELETE\s+FROM/gi, '[SQL removed]');

    return sanitized;
  }

  // ============================================
  // Token Budget Management
  // ============================================

  /**
   * Check and enforce token budget
   */
  async checkTokenBudget(params: { userId: string; tokensRequested: number }): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: string;
  }> {
    console.log('[AIAgentGuard] Checking token budget', {
      userId: params.userId,
      tokensRequested: params.tokensRequested,
    });

    // Get or create budget for user
    let budget = this.tokenBudgets.get(params.userId);

    if (!budget) {
      // Create new budget
      const resetAt = new Date();
      resetAt.setUTCHours(24, 0, 0, 0); // Reset at midnight UTC tomorrow

      budget = {
        userId: params.userId,
        dailyLimit: 1000,
        currentUsage: 0,
        resetAt: resetAt.toISOString(),
      };

      this.tokenBudgets.set(params.userId, budget);
    }

    // Check if budget needs reset
    const now = new Date();
    const resetAt = new Date(budget.resetAt);

    if (now >= resetAt) {
      // Reset budget
      const newResetAt = new Date(now);
      newResetAt.setUTCHours(24, 0, 0, 0);

      budget.currentUsage = 0;
      budget.resetAt = newResetAt.toISOString();
    }

    // Check if request would exceed budget
    const remaining = budget.dailyLimit - budget.currentUsage;
    const allowed = remaining >= params.tokensRequested;

    if (!allowed) {
      // Budget exceeded
      if (this.audit) {
        await this.audit.log({
          event: 'ai_agent.token_budget_exceeded',
          category: 'security',
          severity: 'warning',
          userId: params.userId,
          metadata: {
            tokensRequested: params.tokensRequested,
            currentUsage: budget.currentUsage,
            dailyLimit: budget.dailyLimit,
            remaining,
          },
        });
      }

      console.warn('[AIAgentGuard] Token budget exceeded', {
        userId: params.userId,
        remaining,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: budget.resetAt,
      };
    }

    // Update usage
    budget.currentUsage += params.tokensRequested;
    this.tokenBudgets.set(params.userId, budget);

    if (this.audit) {
      await this.audit.log({
        event: 'ai_agent.tokens_used',
        category: 'data',
        severity: 'info',
        userId: params.userId,
        metadata: {
          tokensUsed: params.tokensRequested,
          currentUsage: budget.currentUsage,
          dailyLimit: budget.dailyLimit,
        },
      });
    }

    console.log('[AIAgentGuard] Token budget check passed', {
      userId: params.userId,
      remaining: budget.dailyLimit - budget.currentUsage,
    });

    return {
      allowed: true,
      remaining: budget.dailyLimit - budget.currentUsage,
      resetAt: budget.resetAt,
    };
  }

  /**
   * Get current token budget for user
   */
  getTokenBudget(userId: string): TokenBudget | null {
    return this.tokenBudgets.get(userId) || null;
  }

  // ============================================
  // Circuit Breaker for LLM Calls
  // ============================================

  /**
   * Check if circuit breaker allows LLM call
   */
  async checkCircuitBreaker(): Promise<{ allowed: boolean; reason?: string }> {
    const state = this.circuitBreaker.state;

    if (state === 'closed') {
      // Normal operation
      return { allowed: true };
    }

    if (state === 'open') {
      // Circuit is open, check if timeout elapsed
      if (!this.circuitBreaker.nextAttemptTime) {
        return { allowed: false, reason: 'Circuit breaker is open' };
      }

      const now = new Date();
      const nextAttempt = new Date(this.circuitBreaker.nextAttemptTime);

      if (now < nextAttempt) {
        return {
          allowed: false,
          reason: `Circuit breaker is open, retry at ${this.circuitBreaker.nextAttemptTime}`,
        };
      }

      // Timeout elapsed, try half-open
      this.circuitBreaker.state = 'half_open';
      console.log('[AIAgentGuard] Circuit breaker entering half-open state');
    }

    if (state === 'half_open') {
      // Allow one test request
      return { allowed: true };
    }

    return { allowed: false };
  }

  /**
   * Record LLM call success
   */
  async recordLLMSuccess(): Promise<void> {
    if (this.circuitBreaker.state === 'half_open') {
      // Success in half-open, close circuit
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failureCount = 0;
      console.log('[AIAgentGuard] Circuit breaker closed after successful test');
    }
  }

  /**
   * Record LLM call failure
   */
  async recordLLMFailure(error: Error): Promise<void> {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date().toISOString();

    console.warn('[AIAgentGuard] LLM call failed', {
      failureCount: this.circuitBreaker.failureCount,
      error: error.message,
    });

    if (this.circuitBreaker.state === 'half_open') {
      // Failure in half-open, open circuit again
      this.openCircuit();
      return;
    }

    if (this.circuitBreaker.failureCount >= this.FAILURE_THRESHOLD) {
      // Too many failures, open circuit
      this.openCircuit();
    }

    if (this.audit) {
      await this.audit.log({
        event: 'ai_agent.llm_call_failed',
        category: 'admin',
        severity: this.circuitBreaker.state === 'open' ? 'critical' : 'warning',
        userId: 'system',
        metadata: {
          error: error.message,
          failureCount: this.circuitBreaker.failureCount,
          circuitState: this.circuitBreaker.state,
        },
      });
    }
  }

  /**
   * Open circuit breaker
   */
  private openCircuit(): void {
    this.circuitBreaker.state = 'open';
    const nextAttemptTime = new Date(Date.now() + this.TIMEOUT_MS);
    this.circuitBreaker.nextAttemptTime = nextAttemptTime.toISOString();

    console.error('[AIAgentGuard] Circuit breaker OPENED', {
      failureCount: this.circuitBreaker.failureCount,
      nextAttemptTime: this.circuitBreaker.nextAttemptTime,
    });
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  // ============================================
  // Metrics
  // ============================================

  /**
   * Get metrics for Prometheus/monitoring
   */
  async getMetrics(): Promise<{
    prompt_injection_attempts: number;
    token_budget_exceeded: number;
    circuit_breaker_state: string;
    circuit_breaker_failures: number;
  }> {
    // In production, these would be queried from ClickHouse/metrics storage
    // For now, we return current state

    return {
      prompt_injection_attempts: 0, // Would query from audit logs
      token_budget_exceeded: 0, // Would query from audit logs
      circuit_breaker_state: this.circuitBreaker.state,
      circuit_breaker_failures: this.circuitBreaker.failureCount,
    };
  }

  /**
   * Reset circuit breaker manually (for admin operations)
   */
  async resetCircuitBreaker(): Promise<void> {
    this.circuitBreaker = {
      state: 'closed',
      failureCount: 0,
    };

    if (this.audit) {
      await this.audit.log({
        event: 'ai_agent.circuit_breaker_reset',
        category: 'admin',
        severity: 'info',
        userId: 'system',
        metadata: {
          resetAt: new Date().toISOString(),
        },
      });
    }

    console.log('[AIAgentGuard] Circuit breaker manually reset');
  }
}

// ============================================
// Export singleton
// ============================================

let guardInstance: AIAgentGuard | null = null;

export function getAIAgentGuard(): AIAgentGuard {
  if (!guardInstance) {
    guardInstance = new AIAgentGuard();
  }
  return guardInstance;
}
