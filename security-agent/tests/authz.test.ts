/**
 * ============================================
 * Security Agent - Authorization Guard Tests
 * ============================================
 * Tests for AG-1 through AG-5 requirements
 * ============================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthorizationGuard } from '../src/authz.js';
import { AuthorizationError, type SecurityAgentConfig } from '../src/types.js';

// Mock Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(60),
  })),
}));

const testConfig: SecurityAgentConfig = {
  vault: {
    address: 'http://localhost:8200',
    token: 'test-token',
    tlsEnabled: false,
  },
  clickhouse: {
    host: 'localhost',
    port: 8123,
    database: 'test',
    username: 'test',
    password: 'test',
  },
  redis: {
    url: 'https://test-redis.upstash.io',
  },
  environment: 'development',
  signingKey: 'test-signing-key',
  enableLeakDetection: true,
  permissiveMode: false,
};

describe('AuthorizationGuard', () => {
  let authz: AuthorizationGuard;

  beforeEach(async () => {
    authz = new AuthorizationGuard(testConfig);
    await authz.initialize();
  });

  describe('AG-1/AG-3: Permission checking', () => {
    it('should allow access when user has all required permissions', async () => {
      // Set admin permissions
      await authz.setUserPermissions('admin_user', ['admin']);

      const result = await authz.check({
        userId: 'admin_user',
        requiredPermissions: ['price:read', 'price:update'],
      });

      expect(result.allowed).toBe(true);
      expect(result.missingPermissions).toHaveLength(0);
    });

    it('should deny access when user lacks permissions', async () => {
      // Set free tier permissions
      await authz.setUserPermissions('free_user', ['free']);

      await expect(
        authz.check({
          userId: 'free_user',
          requiredPermissions: ['price:update'], // Free tier doesn't have this
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('should return missing permissions in error', async () => {
      await authz.setUserPermissions('basic_user', ['basic']);

      try {
        await authz.check({
          userId: 'basic_user',
          requiredPermissions: ['admin:write', 'workflow:modify'],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthorizationError);
        expect((error as AuthorizationError).details?.missingPermissions).toContain('admin:write');
        expect((error as AuthorizationError).details?.missingPermissions).toContain(
          'workflow:modify'
        );
      }
    });
  });

  describe('AG-5: Rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const result = await authz.checkRateLimit({
        key: 'test-endpoint',
        limit: 10,
        windowSeconds: 60,
        userId: 'user_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track remaining requests', async () => {
      // First request
      const result1 = await authz.checkRateLimit({
        key: 'test-endpoint-2',
        limit: 5,
        windowSeconds: 60,
        userId: 'user_123',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
    });

    it('should provide reset time', async () => {
      const result = await authz.checkRateLimit({
        key: 'test-endpoint-3',
        limit: 10,
        windowSeconds: 60,
        userId: 'user_123',
      });

      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Role-based permissions', () => {
    it('should expand admin role to all permissions', async () => {
      await authz.setUserPermissions('admin_user', ['admin']);
      const permissions = await authz.getUserPermissions('admin_user');

      expect(permissions.permissions).toContain('price:read');
      expect(permissions.permissions).toContain('price:update');
      expect(permissions.permissions).toContain('admin:write');
      expect(permissions.permissions).toContain('workflow:modify');
    });

    it('should expand pro role correctly', async () => {
      await authz.setUserPermissions('pro_user', ['pro']);
      const permissions = await authz.getUserPermissions('pro_user');

      expect(permissions.permissions).toContain('price:bulk_update');
      expect(permissions.permissions).toContain('analytics:export');
      expect(permissions.permissions).not.toContain('admin:write');
    });

    it('should expand free role with minimal permissions', async () => {
      await authz.setUserPermissions('free_user', ['free']);
      const permissions = await authz.getUserPermissions('free_user');

      expect(permissions.permissions).toContain('price:read');
      expect(permissions.permissions).toContain('agent:chat');
      expect(permissions.permissions).not.toContain('price:update');
      expect(permissions.permissions).not.toContain('stoploss:set');
    });
  });

  describe('Resource ownership', () => {
    it('should allow owner to access their resource', async () => {
      await authz.setUserPermissions('user_123', ['basic']);

      const allowed = await authz.checkOwnership(
        'user_123',
        'product',
        'prod_456',
        'user_123' // Same user
      );

      expect(allowed).toBe(true);
    });

    it('should deny non-owner access', async () => {
      await authz.setUserPermissions('user_123', ['basic']);

      const allowed = await authz.checkOwnership(
        'user_123',
        'product',
        'prod_456',
        'other_user' // Different user
      );

      expect(allowed).toBe(false);
    });

    it('should allow admin access to any resource', async () => {
      await authz.setUserPermissions('admin_user', ['admin']);

      const allowed = await authz.checkOwnership(
        'admin_user',
        'product',
        'prod_456',
        'other_user' // Different user, but admin can access
      );

      expect(allowed).toBe(true);
    });
  });

  describe('Permission caching', () => {
    it('should cache permissions after first fetch', async () => {
      await authz.setUserPermissions('cached_user', ['pro']);

      // First call
      const perms1 = await authz.getUserPermissions('cached_user');

      // Second call should use cache
      const perms2 = await authz.getUserPermissions('cached_user');

      expect(perms1.permissions).toEqual(perms2.permissions);
    });

    it('should invalidate cache on request', async () => {
      await authz.setUserPermissions('cache_test', ['basic']);
      await authz.getUserPermissions('cache_test');

      // Invalidate
      await authz.invalidateCache('cache_test');

      // Update permissions
      await authz.setUserPermissions('cache_test', ['pro']);

      const perms = await authz.getUserPermissions('cache_test');
      expect(perms.roles).toContain('pro');
    });
  });
});

describe('Permissive mode', () => {
  it('should not throw in permissive mode', async () => {
    const permissiveConfig = { ...testConfig, permissiveMode: true };
    const authz = new AuthorizationGuard(permissiveConfig);
    await authz.initialize();

    await authz.setUserPermissions('test_user', ['free']);

    // Should not throw even without permission
    const result = await authz.check({
      userId: 'test_user',
      requiredPermissions: ['admin:write'],
    });

    expect(result.allowed).toBe(false);
    expect(result.missingPermissions).toContain('admin:write');
  });
});
