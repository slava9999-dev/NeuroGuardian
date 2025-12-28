/**
 * ============================================
 * Security Agent - Authorization Guard SDK
 * ============================================
 * AG-1: All API endpoints declare requiredPermissions
 * AG-2: JWT contains permissions claim
 * AG-3: Middleware checks requiredPermissions ⊆ userPermissions
 * AG-4: Every denial logged with userId, endpoint, missingPermissions
 * AG-5: Rate limiting by userId + permission
 * ============================================
 */

import { createHmac } from 'crypto';
import {
  AuthzCheckRequest,
  AuthzCheckRequestSchema,
  AuthzCheckResponse,
  Permission,
  UserPermissions,
  RateLimitConfig,
  RateLimitResult,
  AuthorizationError,
  RateLimitError,
  SecurityAgentError,
  type SecurityAgentConfig,
} from './types.js';
import { AuditLogger } from './audit.js';

// Redis client interface
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
}

// Permission hierarchy - higher roles include lower permissions
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'price:read',
    'price:update',
    'price:bulk_update',
    'inventory:read',
    'inventory:update',
    'stoploss:read',
    'stoploss:set',
    'stoploss:delete',
    'product:read',
    'product:sync',
    'analytics:read',
    'analytics:export',
    'admin:read',
    'admin:write',
    'admin:users',
    'admin:secrets',
    'workflow:read',
    'workflow:execute',
    'workflow:modify',
    'agent:chat',
    'agent:execute',
    'agent:confirm',
  ],
  pro: [
    'price:read',
    'price:update',
    'price:bulk_update',
    'inventory:read',
    'inventory:update',
    'stoploss:read',
    'stoploss:set',
    'stoploss:delete',
    'product:read',
    'product:sync',
    'analytics:read',
    'analytics:export',
    'agent:chat',
    'agent:execute',
    'agent:confirm',
  ],
  basic: [
    'price:read',
    'price:update',
    'inventory:read',
    'stoploss:read',
    'stoploss:set',
    'product:read',
    'analytics:read',
    'agent:chat',
  ],
  free: ['price:read', 'inventory:read', 'product:read', 'agent:chat'],
};

// Rate limits by permission
const PERMISSION_RATE_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  'price:update': { limit: 10, windowSeconds: 60 },
  'price:bulk_update': { limit: 5, windowSeconds: 60 },
  'inventory:update': { limit: 20, windowSeconds: 60 },
  'stoploss:set': { limit: 10, windowSeconds: 60 },
  'product:sync': { limit: 5, windowSeconds: 300 },
  'agent:execute': { limit: 30, windowSeconds: 60 },
  'admin:write': { limit: 10, windowSeconds: 60 },
  'workflow:execute': { limit: 20, windowSeconds: 60 },
};

/**
 * Authorization Guard - Permission checking and rate limiting
 */
export class AuthorizationGuard {
  private redis: RedisClient | null = null;
  private auditLogger: AuditLogger | null = null;

  // Local permission cache (for when Redis is unavailable)
  private permissionCache: Map<string, { permissions: UserPermissions; expiresAt: Date }> =
    new Map();

  // Cache TTL in seconds
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(private readonly config: SecurityAgentConfig) {}

  /**
   * Set the audit logger for integration
   */
  setAuditLogger(logger: AuditLogger): void {
    this.auditLogger = logger;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.redis.url) {
        // Use Upstash Redis
        const { Redis } = await import('@upstash/redis');
        const upstash = new Redis({
          url: this.config.redis.url,
          token: this.config.redis.password || '',
        });

        // Wrap in our interface
        this.redis = {
          get: async key => (await upstash.get(key)) as string | null,
          set: async (key, value, options) => {
            if (options?.EX) {
              await upstash.setex(key, options.EX, value);
            } else {
              await upstash.set(key, value);
            }
          },
          incr: async key => await upstash.incr(key),
          expire: async (key, seconds) => {
            await upstash.expire(key, seconds);
          },
          ttl: async key => await upstash.ttl(key),
        };
      } else {
        // Use ioredis for local Redis
        const ioredis = await import('ioredis');
        const RedisClient = ioredis.default || ioredis;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new (RedisClient as any)({
          host: this.config.redis.host || 'localhost',
          port: this.config.redis.port || 6379,
          password: this.config.redis.password,
        });

        this.redis = {
          get: async key => await client.get(key),
          set: async (key, value, options) => {
            if (options?.EX) {
              await client.setex(key, options.EX, value);
            } else {
              await client.set(key, value);
            }
          },
          incr: async key => await client.incr(key),
          expire: async (key, seconds) => {
            await client.expire(key, seconds);
          },
          ttl: async key => await client.ttl(key),
        };
      }

      console.log('[AuthorizationGuard] Redis connected');
    } catch (error) {
      console.warn('[AuthorizationGuard] Redis connection failed, using local cache only', error);
      // Continue without Redis - use local cache
    }
  }

  /**
   * Check if user has required permissions
   *
   * @example
   * const result = await authz.check({
   *   userId: 'user_123',
   *   requiredPermissions: ['price:update', 'inventory:read'],
   *   resource: { type: 'product', id: 'prod_456' }
   * });
   */
  async check(request: AuthzCheckRequest): Promise<AuthzCheckResponse> {
    // Validate request
    const validatedRequest = AuthzCheckRequestSchema.parse(request);
    const { userId, requiredPermissions, resource } = validatedRequest;

    // Get user permissions
    const userPermissions = await this.getUserPermissions(userId);

    // Check if user has all required permissions
    const missingPermissions = requiredPermissions.filter(
      perm => !userPermissions.permissions.includes(perm)
    );

    const allowed = missingPermissions.length === 0;

    // Log the decision
    if (this.auditLogger) {
      await this.auditLogger.logAuthzDecision(
        userId,
        requiredPermissions,
        allowed,
        missingPermissions
      );
    }

    // If not allowed and not in permissive mode, log and potentially throw
    if (!allowed) {
      console.warn('[AuthorizationGuard] Permission denied', {
        userId,
        requiredPermissions,
        missingPermissions,
        resource,
      });

      if (!this.config.permissiveMode) {
        throw new AuthorizationError(userId, missingPermissions);
      }
    }

    const response: AuthzCheckResponse = {
      allowed,
      missingPermissions,
      cachedUntil: new Date(Date.now() + this.CACHE_TTL * 1000),
    };

    if (!allowed) {
      response.reason = `Missing permissions: ${missingPermissions.join(', ')}`;
    }

    return response;
  }

  /**
   * Check rate limit for a specific action
   */
  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, windowSeconds, userId } = config;
    const redisKey = `ratelimit:${userId}:${key}`;

    try {
      if (!this.redis) {
        // No Redis - allow all (with warning)
        console.warn('[AuthorizationGuard] Rate limiting disabled - no Redis');
        return {
          allowed: true,
          remaining: limit,
          resetAt: new Date(Date.now() + windowSeconds * 1000),
          total: limit,
        };
      }

      // Increment counter
      const count = await this.redis.incr(redisKey);

      // Set expiry on first request
      if (count === 1) {
        await this.redis.expire(redisKey, windowSeconds);
      }

      // Get TTL for reset time
      const ttl = await this.redis.ttl(redisKey);
      const resetAt = new Date(Date.now() + ttl * 1000);

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      if (!allowed) {
        console.warn('[AuthorizationGuard] Rate limit exceeded', {
          userId,
          key,
          count,
          limit,
        });

        // Log to audit
        if (this.auditLogger) {
          await this.auditLogger.log({
            event: 'rate_limit.exceeded',
            category: 'security',
            severity: 'warning',
            userId,
            metadata: { key, count, limit },
          });
        }

        if (!this.config.permissiveMode) {
          throw new RateLimitError(userId, key, resetAt);
        }
      }

      return {
        allowed,
        remaining,
        resetAt,
        total: limit,
      };
    } catch (error) {
      if (error instanceof RateLimitError) throw error;

      // Redis error - allow through with warning
      console.error('[AuthorizationGuard] Rate limit check failed', error);
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
        total: limit,
      };
    }
  }

  /**
   * Check rate limit based on permission
   */
  async checkPermissionRateLimit(userId: string, permission: Permission): Promise<RateLimitResult> {
    const limits = PERMISSION_RATE_LIMITS[permission];

    if (!limits) {
      // No rate limit for this permission
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 60000),
        total: Infinity,
      };
    }

    return this.checkRateLimit({
      key: permission,
      limit: limits.limit,
      windowSeconds: limits.windowSeconds,
      userId,
    });
  }

  /**
   * Get user permissions from cache or database
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    // Check local cache first
    const cached = this.permissionCache.get(userId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.permissions;
    }

    // Check Redis cache
    if (this.redis) {
      const redisKey = `permissions:${userId}`;
      const cachedJson = await this.redis.get(redisKey);

      if (cachedJson) {
        const permissions = JSON.parse(cachedJson) as UserPermissions;

        // Update local cache
        this.permissionCache.set(userId, {
          permissions,
          expiresAt: new Date(Date.now() + this.CACHE_TTL * 1000),
        });

        return permissions;
      }
    }

    // Fetch from database (would be implemented with actual DB call)
    const permissions = await this.fetchUserPermissions(userId);

    // Cache in Redis
    if (this.redis) {
      const redisKey = `permissions:${userId}`;
      await this.redis.set(redisKey, JSON.stringify(permissions), { EX: this.CACHE_TTL });
    }

    // Cache locally
    this.permissionCache.set(userId, {
      permissions,
      expiresAt: new Date(Date.now() + this.CACHE_TTL * 1000),
    });

    return permissions;
  }

  /**
   * Set user permissions (called when user subscription changes)
   */
  async setUserPermissions(userId: string, roles: string[]): Promise<void> {
    // Calculate permissions from roles
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (rolePerms) {
        rolePerms.forEach(p => permissions.add(p));
      }
    }

    const userPermissions: UserPermissions = {
      userId,
      permissions: Array.from(permissions),
      roles,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Update caches
    this.permissionCache.set(userId, {
      permissions: userPermissions,
      expiresAt: new Date(Date.now() + this.CACHE_TTL * 1000),
    });

    if (this.redis) {
      const redisKey = `permissions:${userId}`;
      await this.redis.set(redisKey, JSON.stringify(userPermissions), { EX: 86400 }); // 24 hours
    }

    console.log('[AuthorizationGuard] Permissions updated', {
      userId,
      roles,
      permissionCount: permissions.size,
    });
  }

  /**
   * Invalidate user permission cache
   */
  async invalidateCache(userId: string): Promise<void> {
    this.permissionCache.delete(userId);

    if (this.redis) {
      const redisKey = `permissions:${userId}`;
      await this.redis.set(redisKey, '', { EX: 1 }); // Expire immediately
    }
  }

  /**
   * Check resource ownership (for user-specific data)
   */
  async checkOwnership(
    userId: string,
    resourceType: string,
    resourceId: string,
    resourceOwnerId: string
  ): Promise<boolean> {
    // Admin can access everything
    const permissions = await this.getUserPermissions(userId);
    if (permissions.permissions.includes('admin:read')) {
      return true;
    }

    // Otherwise, must be the owner
    const isOwner = userId === resourceOwnerId;

    if (!isOwner) {
      console.warn('[AuthorizationGuard] Ownership check failed', {
        userId,
        resourceType,
        resourceId,
        resourceOwnerId,
      });

      if (this.auditLogger) {
        await this.auditLogger.log({
          event: 'ownership.denied',
          category: 'auth',
          severity: 'warning',
          userId,
          resourceType,
          resourceId,
          metadata: { resourceOwnerId },
        });
      }
    }

    return isOwner;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async fetchUserPermissions(userId: string): Promise<UserPermissions> {
    // TODO: This should fetch from the database
    // For now, return default free tier permissions
    // In production, this would query the users table and subscription status

    console.log('[AuthorizationGuard] Fetching permissions from DB for', userId);

    // Default to free tier
    return {
      userId,
      permissions: ROLE_PERMISSIONS.free || [],
      roles: ['free'],
    };
  }
}

// ============================================
// Middleware Decorator
// ============================================

export interface HandlerConfig {
  requiredPermissions?: Permission[];
  rateLimit?: { limit: number; windowSeconds: number };
  requireOwnership?: boolean;
}

/**
 * Decorator for API handlers to enforce authorization
 *
 * @example
 * export const config: HandlerConfig = {
 *   requiredPermissions: ['price:update', 'inventory:read'],
 *   rateLimit: { limit: 10, windowSeconds: 60 }
 * };
 */
export function withAuthorization<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  config: HandlerConfig,
  authz: AuthorizationGuard
): T {
  return (async (...args: unknown[]) => {
    const [req] = args as [
      { userId?: string; body?: { resourceId?: string; resourceOwnerId?: string } },
    ];
    const userId = req?.userId;

    if (!userId) {
      throw new SecurityAgentError(
        'User ID is required for authorization',
        'USER_ID_REQUIRED',
        401
      );
    }

    // Check permissions
    if (config.requiredPermissions && config.requiredPermissions.length > 0) {
      await authz.check({
        userId,
        requiredPermissions: config.requiredPermissions,
      });
    }

    // Check rate limit
    if (config.rateLimit) {
      await authz.checkRateLimit({
        key: handler.name || 'handler',
        ...config.rateLimit,
        userId,
      });
    }

    // Check ownership if required
    if (config.requireOwnership && req?.body?.resourceId && req?.body?.resourceOwnerId) {
      await authz.checkOwnership(userId, 'resource', req.body.resourceId, req.body.resourceOwnerId);
    }

    // Call original handler
    return handler(...args);
  }) as T;
}

// ============================================
// JWT Utilities
// ============================================

interface JWTPayload {
  sub: string; // userId
  permissions?: Permission[];
  roles?: string[];
  exp?: number;
  iat?: number;
}

/**
 * Extract permissions from JWT token
 */
export function extractPermissionsFromJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1] || '', 'base64').toString('utf-8'));

    return {
      sub: payload.sub,
      permissions: payload.permissions,
      roles: payload.roles,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

/**
 * Verify JWT token (basic verification - use proper library in production)
 */
export function verifyJWT(token: string, secret: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, payload, signature] = parts;
    const expectedSignature = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return signature === expectedSignature;
  } catch {
    return false;
  }
}
