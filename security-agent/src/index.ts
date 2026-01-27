/**
 * ============================================
 * Security Agent - Main Entry Point
 * ============================================
 * Unified SDK for all security operations:
 * - Secrets Guard (Vault integration)
 * - Audit Logger (ClickHouse)
 * - Authorization Guard (Permissions, Rate Limiting)
 * ============================================
 */

import { SecretsGuard, createEnvProxy } from './secrets.js';
import { AuditLogger, createAuditContext } from './audit.js';
import { AuthorizationGuard } from './authz.js';
import { N8nGuardian } from './n8n.js';
import { RegressionShield } from './regression.js';
import { AIAgentGuard } from './ai-guard.js';
import { EmergencyResponse } from './emergency.js';
import { InjectionDetectedError, type SecurityAgentConfig } from './types.js';

// Re-export all types
export * from './types.js';

// Re-export modules
export { SecretsGuard, createEnvProxy, generateSignature, verifySignature } from './secrets.js';
export { AuditLogger, createAuditContext } from './audit.js';
export { AuthorizationGuard, extractPermissionsFromJWT, verifyJWT } from './authz.js';
export { N8nGuardian, getN8nGuardian } from './n8n.js';
export { RegressionShield, getRegressionShield } from './regression.js';
export { AIAgentGuard, getAIAgentGuard } from './ai-guard.js';
export { EmergencyResponse, getEmergencyResponse } from './emergency.js';

/**
 * Main Security Agent class
 * Provides unified access to all security modules
 */
export class SecurityAgent {
  public readonly secrets: SecretsGuard;
  public readonly audit: AuditLogger;
  public readonly authz: AuthorizationGuard;
  public readonly n8n: N8nGuardian;
  public readonly regression: RegressionShield;
  public readonly aiGuard: AIAgentGuard;
  public readonly emergency: EmergencyResponse;

  private initialized = false;

  constructor(config: SecurityAgentConfig) {
    this.secrets = new SecretsGuard(config);
    this.audit = new AuditLogger(config);
    this.authz = new AuthorizationGuard(config);
    this.n8n = new N8nGuardian();
    this.regression = new RegressionShield();
    this.aiGuard = new AIAgentGuard();
    this.emergency = new EmergencyResponse();

    // Connect authz to audit for logging
    this.authz.setAuditLogger(this.audit);

    // Connect n8n to secrets and audit
    this.n8n.setDependencies(this.secrets, this.audit);

    // Connect regression to audit
    this.regression.setDependencies(this.audit);

    // Connect AI guard to audit
    this.aiGuard.setDependencies(this.audit);

    // Connect emergency response to audit
    this.emergency.setDependencies(this.audit);
  }

  /**
   * Initialize all modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (process.env.NODE_ENV !== 'test') {
      console.log('[SecurityAgent] Initializing...');
    }

    await Promise.all([
      this.secrets.initialize(),
      this.audit.initialize(),
      this.authz.initialize(),
      this.n8n.initialize(),
      this.regression.initialize(),
      this.aiGuard.initialize(),
      this.emergency.initialize(),
    ]);

    this.initialized = true;
    if (process.env.NODE_ENV !== 'test') {
      console.log('[SecurityAgent] Initialized successfully');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[SecurityAgent] Shutting down...');
    }
    await this.audit.shutdown();
    this.initialized = false;
    if (process.env.NODE_ENV !== 'test') {
      console.log('[SecurityAgent] Shutdown complete');
    }
  }

  /**
   * Get initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create middleware using this agent's configuration
   */
  createMiddleware(options: SecurityMiddlewareOptions) {
    return securityMiddleware(
      options,
      async (req: unknown, res: unknown) => {
        return { success: true, req, res };
      },
      this
    );
  }
}

/**
 * Create a Security Agent instance from environment
 */
export function createSecurityAgentFromEnv(): SecurityAgent {
  // Auto-detect Vercel environment without Vault
  const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_URL;
  const hasVault = !!process.env.VAULT_TOKEN && process.env.VAULT_ADDR !== 'http://localhost:8200';
  const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL;

  // Enable permissive mode if on Vercel without proper infrastructure
  const autoPermissive = isVercel && (!hasVault || !hasUpstash);

  const vaultConfig: SecurityAgentConfig['vault'] = {
    address: process.env.VAULT_ADDR || 'http://localhost:8200',
    tlsEnabled: process.env.VAULT_TLS_ENABLED === 'true',
  };
  if (process.env.VAULT_TOKEN) vaultConfig.token = process.env.VAULT_TOKEN;
  if (process.env.VAULT_NAMESPACE) vaultConfig.namespace = process.env.VAULT_NAMESPACE;

  const redisConfig: SecurityAgentConfig['redis'] = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };

  // Support REDIS_URL from .env
  if (process.env.REDIS_URL) {
    redisConfig.url = process.env.REDIS_URL;
  }

  // Only use Upstash if URL is provided (overrides REDIS_URL)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    redisConfig.url = process.env.UPSTASH_REDIS_REST_URL;
    redisConfig.password = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  }

  const config: SecurityAgentConfig = {
    vault: vaultConfig,
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
      database: process.env.CLICKHOUSE_DATABASE || 'security_audit',
      username: process.env.CLICKHOUSE_USER || 'security_agent',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    },
    redis: redisConfig,
    environment:
      (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    signingKey: process.env.SECURITY_SIGNING_KEY || 'dev-signing-key-change-in-production',
    enableLeakDetection: process.env.ENABLE_LEAK_DETECTION !== 'false',
    // Auto-enable permissive mode on Vercel without infrastructure
    permissiveMode: process.env.SECURITY_PERMISSIVE_MODE === 'true' || autoPermissive,
  };

  if (autoPermissive) {
    console.log('[SecurityAgent] Auto-enabled permissive mode (Vercel without Vault/Upstash)');
  }

  return new SecurityAgent(config);
}

// ============================================
// Global Instance (Singleton Pattern)
// ============================================

let globalAgent: SecurityAgent | null = null;

/**
 * Get or create the global Security Agent instance
 */
export function getSecurityAgent(): SecurityAgent {
  if (!globalAgent) {
    globalAgent = createSecurityAgentFromEnv();
  }
  return globalAgent;
}

/**
 * Initialize the global Security Agent
 */
export async function initializeSecurityAgent(): Promise<SecurityAgent> {
  const agent = getSecurityAgent();
  await agent.initialize();
  return agent;
}

// ============================================
// Middleware for Vercel/Express
// ============================================

export interface SecurityMiddlewareOptions {
  requiredPermissions?: string[];
  rateLimit?: { limit: number; windowSeconds: number };
  auditEvent?: string;
  inputValidation?: import('./types.js').InputValidationOptions;
}

/**
 * Common attack patterns for Pseudo-RASP protection
 */
const RASP_PATTERNS = {
  SQL_INJECTION:
    /select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table|union\s+select/i,
  XSS: /<script\b[^>]*>([\s\S]*?)<\/script>|on\w+\s*=\s*["'][^"']*["']/i,
  SHELL_INJECTION: /;\s*(rm|cat|ls|grep|bash|sh|curl|wget)\b/i,
  NOSQL_INJECTION: /\$where|\$regex|\$gt|\$lt|\$ne|\$in/i,
};

/**
 * Create middleware that enforces security policies
 *
 * @example
 * // In api/handlers/price.ts
 * import { securityMiddleware } from '@neuroguardian/security-agent';
 *
 * export default securityMiddleware({
 *   requiredPermissions: ['price:update'],
 *   rateLimit: { limit: 10, windowSeconds: 60 },
 *   auditEvent: 'price.update'
 * }, async (req, res) => {
 *   // Handler code
 * });
 */
export function securityMiddleware<T extends (...args: unknown[]) => Promise<unknown>>(
  options: SecurityMiddlewareOptions,
  handler: T,
  providedAgent?: SecurityAgent
): T {
  return (async (...args: unknown[]) => {
    const [req] = args as [
      {
        headers?: Record<string, string>;
        userId?: string;
        method?: string;
        url?: string;
      },
    ];

    const agent = providedAgent || getSecurityAgent();

    // Ensure initialized
    if (!agent.isInitialized()) {
      await agent.initialize();
    }

    // Set audit context
    // Set audit context
    if (req.headers) {
      // Cast headers to match what createAuditContext accepts (checking for presence manually if needed, or trusting the type compatibility for string | undefined)
      // Since req.headers is Record<string, string>, it satisfies string | undefined.
      // The issue is likely url and method.
      const ctxReq: {
        headers: Record<string, string | undefined>;
        url?: string;
        method?: string;
      } = { headers: req.headers };

      if (req.url) ctxReq.url = req.url;
      if (req.method) ctxReq.method = req.method;

      const context = createAuditContext(ctxReq);
      agent.audit.setContext(context);
    }

    // Pseudo-RASP: Input Validation
    const validation = options.inputValidation || { checkBody: true, checkQuery: true };
    const targets: Record<string, unknown> = {};
    if (validation.checkBody && (req as { body?: unknown }).body)
      targets.body = (req as { body: unknown }).body;
    if (validation.checkQuery && (req as { query?: unknown }).query)
      targets.query = (req as { query: unknown }).query;

    for (const [targetName, content] of Object.entries(targets)) {
      const serialized = JSON.stringify(content);
      for (const [threatType, pattern] of Object.entries(RASP_PATTERNS)) {
        if (pattern.test(serialized)) {
          const error = new InjectionDetectedError(
            req.userId || 'anonymous',
            targetName,
            threatType
          );

          // Log to audit system
          await agent.audit.log({
            event: 'security.injection_attempt',
            category: 'security',
            userId: req.userId || 'anonymous',
            severity: 'critical',
            metadata: { threatType, target: targetName, payload: serialized.slice(0, 100) },
          });

          throw error;
        }
      }
    }

    try {
      // Check authorization
      if (options.requiredPermissions && req.userId) {
        await agent.authz.check({
          userId: req.userId,
          requiredPermissions: options.requiredPermissions as import('./types.js').Permission[],
        });
      }

      // Check rate limit
      if (options.rateLimit && req.userId) {
        await agent.authz.checkRateLimit({
          key: options.auditEvent || handler.name || 'handler',
          limit: options.rateLimit.limit,
          windowSeconds: options.rateLimit.windowSeconds,
          userId: req.userId,
        });
      }

      // Execute handler
      const result = await handler(...args);

      // Log success if audit event specified
      if (options.auditEvent && req.userId) {
        await agent.audit.log({
          event: options.auditEvent,
          category: 'data',
          userId: req.userId,
          severity: 'info',
        });
      }

      return result;
    } finally {
      // Clear audit context
      agent.audit.clearContext();
    }
  }) as T;
}

// ============================================
// Helper: Wrap process.env
// ============================================

/**
 * Replace global process.env with secure proxy
 * Call this early in application startup
 *
 * @example
 * import { enableSecureEnv } from '@neuroguardian/security-agent';
 * enableSecureEnv(['NODE_ENV', 'DEBUG']); // Only these can be accessed directly
 */
export function enableSecureEnv(allowedVars: string[] = []): void {
  const agent = getSecurityAgent();
  const proxy = createEnvProxy(agent.secrets, allowedVars);

  // This is a dangerous operation - only use in production!
  process.env = proxy;

  console.log('[SecurityAgent] Secure environment enabled');
}
