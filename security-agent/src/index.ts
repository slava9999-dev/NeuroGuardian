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

import { SecretsGuard, createEnvProxy, generateSignature, verifySignature } from './secrets.js';
import { AuditLogger, createAuditContext } from './audit.js';
import { AuthorizationGuard, extractPermissionsFromJWT, verifyJWT } from './authz.js';
import type { SecurityAgentConfig } from './types.js';

// Re-export all types
export * from './types.js';

// Re-export modules
export { SecretsGuard, createEnvProxy, generateSignature, verifySignature } from './secrets.js';
export { AuditLogger, createAuditContext } from './audit.js';
export { AuthorizationGuard, extractPermissionsFromJWT, verifyJWT } from './authz.js';

/**
 * Main Security Agent class
 * Provides unified access to all security modules
 */
export class SecurityAgent {
  public readonly secrets: SecretsGuard;
  public readonly audit: AuditLogger;
  public readonly authz: AuthorizationGuard;

  private initialized = false;

  constructor(config: SecurityAgentConfig) {
    this.secrets = new SecretsGuard(config);
    this.audit = new AuditLogger(config);
    this.authz = new AuthorizationGuard(config);

    // Connect authz to audit for logging
    this.authz.setAuditLogger(this.audit);
  }

  /**
   * Initialize all modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SecurityAgent] Initializing...');

    await Promise.all([
      this.secrets.initialize(),
      this.audit.initialize(),
      this.authz.initialize(),
    ]);

    this.initialized = true;
    console.log('[SecurityAgent] Initialized successfully');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[SecurityAgent] Shutting down...');
    await this.audit.shutdown();
    this.initialized = false;
    console.log('[SecurityAgent] Shutdown complete');
  }

  /**
   * Get initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a Security Agent instance from environment
 */
export function createSecurityAgentFromEnv(): SecurityAgent {
  const config: SecurityAgentConfig = {
    vault: {
      address: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
      namespace: process.env.VAULT_NAMESPACE,
      tlsEnabled: process.env.VAULT_TLS_ENABLED === 'true',
    },
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
      database: process.env.CLICKHOUSE_DATABASE || 'security_audit',
      username: process.env.CLICKHOUSE_USER || 'security_agent',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    },
    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    environment:
      (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    signingKey: process.env.SECURITY_SIGNING_KEY || 'dev-signing-key-change-in-production',
    enableLeakDetection: process.env.ENABLE_LEAK_DETECTION !== 'false',
    permissiveMode: process.env.SECURITY_PERMISSIVE_MODE === 'true',
  };

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
}

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
  handler: T
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

    const agent = getSecurityAgent();

    // Ensure initialized
    if (!agent.isInitialized()) {
      await agent.initialize();
    }

    // Set audit context
    if (req.headers) {
      const context = createAuditContext({
        headers: req.headers,
        url: req.url,
        method: req.method,
      });
      agent.audit.setContext(context);
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
  // @ts-expect-error - Intentionally replacing process.env
  process.env = proxy;

  console.log('[SecurityAgent] Secure environment enabled');
}
