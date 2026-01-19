/**
 * ============================================
 * Security Agent - Secrets Guard SDK
 * ============================================
 * SG-1: All secrets stored in Vault, no plain-text in code
 * SG-2: Access only with userId, purpose, ttl
 * SG-3: No logging of secret values
 * SG-4: Automatic rotation support
 * SG-5: Leak detection - blocks and alerts
 * ============================================
 */

import { createHmac, randomUUID } from 'crypto';
import {
  type SecretAccessRequest,
  SecretAccessRequestSchema,
  type SecretAccessResponse,
  type SecretMetadata,
  SecretAccessDeniedError,
  SecretLeakDetectedError,
  SecurityAgentError,
  type SecurityAgentConfig,
} from './types.js';

// Native Vault client interface (no node-vault dependency)
interface VaultClient {
  read(path: string): Promise<{ data: { data: Record<string, string> } }>;
  write(path: string, data: Record<string, unknown>): Promise<unknown>;
  delete(path: string): Promise<void>;
}

// Native fetch-based Vault client implementation
class NativeVaultClient implements VaultClient {
  private readonly endpoint: string;
  private readonly token: string;
  private readonly namespace: string | undefined;

  constructor(options: { endpoint: string; token: string; namespace?: string | undefined }) {
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.token = options.token;
    this.namespace = options.namespace;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Vault-Token': this.token,
    };
    if (this.namespace) {
      headers['X-Vault-Namespace'] = this.namespace;
    }
    return headers;
  }

  async read(path: string): Promise<{ data: { data: Record<string, string> } }> {
    const response = await fetch(`${this.endpoint}/v1/${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Vault read failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as { data: { data: Record<string, string> } };
  }

  async write(path: string, data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Vault write failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/v1/${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Vault delete failed: ${response.status} ${response.statusText}`);
    }
  }
}

// In-memory lease tracking
interface SecretLease {
  leaseId: string;
  key: string;
  userId: string;
  expiresAt: Date;
  purpose: string;
}

/**
 * Secrets Guard - Secure access to secrets via Vault
 */
export class SecretsGuard {
  private client: VaultClient | null = null;
  private leases: Map<string, SecretLease> = new Map();
  private accessLog: Map<string, { count: number; lastAccess: Date }> = new Map();
  private initialized = false;

  // Known secret patterns for leak detection
  private static readonly SECRET_PATTERNS = [
    /sk-(?:proj-)?[a-zA-Z0-9]{20,}/, // OpenAI (sk-xxx or sk-proj-xxx)
    /gsk_[a-zA-Z0-9]{20,}/, // Groq
    /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Slack
    /\d{9,10}:[a-zA-Z0-9_-]{35}/, // Telegram Bot Token (9-10 digit ID:35 char token)
    /AKIA[0-9A-Z]{16}/, // AWS Access Key
    /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, // Private keys
  ];

  private readonly config: SecurityAgentConfig;

  constructor(config: SecurityAgentConfig) {
    this.config = config;
  }

  /**
   * Initialize connection to Vault
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // In test environment, immediately switch to fallback mode
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.client = null;
      this.initialized = true;
      console.log('[SecretsGuard] Running in fallback mode (TEST/DEV)');
      return;
    }

    try {
      // Use native fetch-based Vault client (no node-vault dependency)
      if (!this.config.vault.token) {
        throw new Error('Vault token is required');
      }

      this.client = new NativeVaultClient({
        endpoint: this.config.vault.address,
        token: this.config.vault.token,
        namespace: this.config.vault.namespace,
      });

      // Verify connection
      await this.client.read('sys/health');

      this.initialized = true;
      console.log('[SecretsGuard] Connected to Vault at', this.config.vault.address);
    } catch (error) {
      // In permissive mode or test environment, fallback to env vars
      if (this.config.permissiveMode || process.env.NODE_ENV === 'test') {
        console.warn(
          '[SecretsGuard] Vault connection failed, running in fallback mode (env vars)',
          error instanceof Error ? error.message : 'Unknown error'
        );
        this.client = null; // Will use fallback in get()
        this.initialized = true;
        return;
      }

      throw new SecurityAgentError(
        `Failed to connect to Vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VAULT_CONNECTION_FAILED',
        503
      );
    }
  }

  /**
   * Get a secret from Vault with full audit trail
   *
   * @example
   * const secret = await secrets.get({
   *   userId: 'user_123',
   *   key: 'wb_api_key',
   *   purpose: 'price_sync',
   *   ttl: 300
   * });
   */
  async get(request: SecretAccessRequest): Promise<SecretAccessResponse> {
    // Validate request
    const validatedRequest = SecretAccessRequestSchema.parse(request);
    const { userId, key, purpose, ttl } = validatedRequest;

    // Generate trace ID for this access
    const traceId = randomUUID();

    try {
      await this.ensureInitialized();

      // Check if user has permission to access this secret
      await this.validateAccess(userId, key, purpose);

      let secretValue: string;

      // Fallback to env vars if Vault is not available (test/dev mode)
      if (!this.client) {
        console.warn('[SecretsGuard] Using fallback: reading from process.env');
        // Map common keys to env var names
        const envVarMap: Record<string, string> = {
          'n8n/api_key': 'N8N_API_KEY',
          telegram_bot_token: 'TELEGRAM_BOT_TOKEN',
          'users/demo_user/wb_api_key': 'WB_API_KEY',
          'users/demo_user/ozon_api_key': 'OZON_CLIENT_ID',
        };
        const envVarName = envVarMap[key] || key.toUpperCase().replace(/\//g, '_');
        secretValue = process.env[envVarName] || 'test-secret-fallback';
      } else {
        // Read from Vault
        const secretPath = `secret/data/neuroguardian/${key}`;
        const response = await this.client.read(secretPath);

        if (!response?.data?.data?.value) {
          throw new SecretAccessDeniedError(key, 'Secret not found');
        }

        secretValue = response.data.data.value;
      }

      // Create lease
      const leaseId = randomUUID();
      const expiresAt = new Date(Date.now() + ttl * 1000);

      this.leases.set(leaseId, {
        leaseId,
        key,
        userId,
        expiresAt,
        purpose,
      });

      // Update access log (for metrics, not the actual value!)
      const accessKey = `${userId}:${key}`;
      const existing = this.accessLog.get(accessKey);
      this.accessLog.set(accessKey, {
        count: (existing?.count || 0) + 1,
        lastAccess: new Date(),
      });

      // Schedule lease cleanup
      setTimeout(() => this.revokeLease(leaseId), ttl * 1000);

      // Log access (NEVER log the secret value!)
      console.log('[SecretsGuard] Secret accessed', {
        traceId,
        userId,
        key,
        purpose,
        ttl,
        leaseId,
        // value: NEVER LOGGED
      });

      return {
        value: secretValue,
        expiresAt,
        leaseId,
        renewable: true,
      };
    } catch (error) {
      // Log failure
      console.error('[SecretsGuard] Secret access failed', {
        traceId,
        userId,
        key,
        purpose,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Store a secret in Vault
   */
  async set(
    key: string,
    value: string,
    userId: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    await this.ensureInitialized();

    const secretPath = `secret/data/neuroguardian/${key}`;

    await this.client!.write(secretPath, {
      data: {
        value,
        ...metadata,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      },
    });

    console.log('[SecretsGuard] Secret stored', {
      key,
      userId,
      // value: NEVER LOGGED
    });
  }

  /**
   * Delete a secret from Vault
   */
  async delete(key: string, userId: string): Promise<void> {
    await this.ensureInitialized();

    const secretPath = `secret/data/neuroguardian/${key}`;
    await this.client!.delete(secretPath);

    console.log('[SecretsGuard] Secret deleted', {
      key,
      userId,
    });
  }

  /**
   * Revoke a lease, invalidating access to the secret
   */
  async revokeLease(leaseId: string): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (lease) {
      this.leases.delete(leaseId);
      console.log('[SecretsGuard] Lease revoked', {
        leaseId,
        key: lease.key,
        userId: lease.userId,
      });
    }
  }

  /**
   * Get metadata about a secret (without the value)
   */
  async getMetadata(key: string): Promise<SecretMetadata | null> {
    await this.ensureInitialized();

    try {
      const secretPath = `secret/metadata/neuroguardian/${key}`;
      const response = await this.client!.read(secretPath);
      const createdTime = response.data.data.created_time || response.data.data.updated_time;
      const currentVersion = response.data.data.current_version;

      return {
        key,
        createdAt: createdTime ? new Date(createdTime) : new Date(),
        lastAccessedAt: new Date(),
        accessCount: this.accessLog.get(key)?.count || 0,
        version: typeof currentVersion === 'number' ? currentVersion : 1,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verify if a secret needs rotation based on age (Automated Security Check)
   */
  async verifyRotation(key: string, maxAgeDays = 90): Promise<{ stale: boolean; ageDays: number }> {
    const metadata = await this.getMetadata(key);
    if (!metadata) return { stale: false, ageDays: 0 };

    const ageMs = Date.now() - metadata.createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const stale = ageDays >= maxAgeDays;

    if (stale) {
      console.warn(
        `[SecretsGuard] ⚠️ SECRET ROTATION REQUIRED: '${key}' is ${ageDays} days old (Limit: ${maxAgeDays})`
      );
    }

    return { stale, ageDays };
  }

  /**
   * Check a string for potential secret leaks
   * This should be called on any string being logged or sent externally
   */
  detectLeak(content: string, context: string): void {
    if (!this.config.enableLeakDetection) return;

    for (const pattern of SecretsGuard.SECRET_PATTERNS) {
      if (pattern.test(content)) {
        // This is a CRITICAL security event
        const error = new SecretLeakDetectedError(context);

        console.error('[SecretsGuard] CRITICAL: Secret leak detected!', {
          context,
          patternMatched: pattern.toString(),
          // content: NEVER LOGGED
        });

        // In production, we would:
        // 1. Send alert to PagerDuty
        // 2. Block the operation
        // 3. Log to security incident table

        if (!this.config.permissiveMode) {
          throw error;
        }
      }
    }
  }

  /**
   * Create a wrapped version of console that detects leaks
   */
  createSafeLogger() {
    return {
      log: (...args: unknown[]) => {
        const content = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        this.detectLeak(content, 'console.log');
        console.log(...args);
      },
      info: (...args: unknown[]) => {
        const content = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        this.detectLeak(content, 'console.info');
        console.info(...args);
      },
      warn: (...args: unknown[]) => {
        const content = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        this.detectLeak(content, 'console.warn');
        console.warn(...args);
      },
      error: (...args: unknown[]) => {
        const content = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        this.detectLeak(content, 'console.error');
        console.error(...args);
      },
    };
  }

  /**
   * Get all active leases for a user
   */
  getActiveLeases(userId: string): SecretLease[] {
    const now = new Date();
    return Array.from(this.leases.values()).filter(
      lease => lease.userId === userId && lease.expiresAt > now
    );
  }

  /**
   * Revoke all leases for a user (e.g., on logout)
   */
  async revokeAllUserLeases(userId: string): Promise<number> {
    const userLeases = this.getActiveLeases(userId);
    for (const lease of userLeases) {
      await this.revokeLease(lease.leaseId);
    }
    return userLeases.length;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    // Note: this.client may be null in fallback mode (test/dev) - this is OK
  }

  private async validateAccess(userId: string, key: string, purpose: string): Promise<void> {
    // In production, this would check:
    // 1. User has permission to access this key
    // 2. Purpose is valid for this key
    // 3. Rate limiting hasn't been exceeded

    // For now, we log and allow (will be enhanced with OPA policies)
    console.log('[SecretsGuard] Validating access', { userId, key, purpose });
  }
}

// ============================================
// Environment Variable Interceptor
// ============================================

/**
 * Creates a proxy that blocks direct access to process.env
 * and forces use of the SecretsGuard
 */
export function createEnvProxy(
  _secrets: SecretsGuard, // Reserved for future OPA policy checks
  allowedEnvVars: string[] = []
): typeof process.env {
  // Variables that are safe to access directly (non-secrets)
  const safeVars = new Set([
    'NODE_ENV',
    'VERCEL_ENV',
    'DEBUG',
    'CI',
    'TEST_MODE',
    'VERCEL_URL',
    'VERCEL_REGION',
    ...allowedEnvVars,
  ]);

  return new Proxy(process.env, {
    get(target, prop: string) {
      // Allow safe variables
      if (safeVars.has(prop)) {
        return target[prop];
      }

      // Block secret access
      throw new SecretAccessDeniedError(
        prop,
        'Direct access to environment variables is not allowed. Use SecurityAgent.secrets.get() instead.'
      );
    },
  });
}

// ============================================
// Utility: Generate signature for audit
// ============================================

export function generateSignature(data: Record<string, unknown>, signingKey: string): string {
  const payload = JSON.stringify(data, Object.keys(data).sort());
  return createHmac('sha256', signingKey).update(payload).digest('hex');
}

export function verifySignature(
  data: Record<string, unknown>,
  signature: string,
  signingKey: string
): boolean {
  const expected = generateSignature(data, signingKey);
  return signature === expected;
}
