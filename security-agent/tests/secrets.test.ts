/**
 * ============================================
 * Security Agent - Secrets Guard Tests
 * ============================================
 * Tests for SG-1 through SG-5 requirements
 * ============================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecretsGuard, createEnvProxy } from '../src/secrets.js';
import {
  SecretAccessDeniedError,
  SecretLeakDetectedError,
  type SecurityAgentConfig,
} from '../src/types.js';

// Mock Vault client
vi.mock('node-vault', () => ({
  default: () => ({
    read: vi.fn().mockResolvedValue({
      data: { data: { value: 'test-secret-value' } },
    }),
    write: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  }),
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
    host: 'localhost',
    port: 6379,
  },
  environment: 'development',
  signingKey: 'test-signing-key',
  enableLeakDetection: true,
  permissiveMode: false,
};

describe('SecretsGuard', () => {
  let secrets: SecretsGuard;

  beforeEach(() => {
    secrets = new SecretsGuard(testConfig);
  });

  describe('SG-1: Secrets stored in Vault', () => {
    it('should connect to Vault on initialization', async () => {
      await secrets.initialize();
      // If no error, connection succeeded
      expect(true).toBe(true);
    });
  });

  describe('SG-2: Access with userId, purpose, ttl', () => {
    it('should require userId for secret access', async () => {
      await expect(
        secrets.get({
          userId: '',
          key: 'test-key',
          purpose: 'test',
          ttl: 300,
        })
      ).rejects.toThrow();
    });

    it('should require purpose for secret access', async () => {
      await expect(
        secrets.get({
          userId: 'user_123',
          key: 'test-key',
          purpose: '',
          ttl: 300,
        })
      ).rejects.toThrow();
    });

    it('should require ttl <= 3600 seconds', async () => {
      await expect(
        secrets.get({
          userId: 'user_123',
          key: 'test-key',
          purpose: 'test',
          ttl: 7200, // 2 hours - too long
        })
      ).rejects.toThrow();
    });

    it('should return secret with lease info', async () => {
      await secrets.initialize();
      const result = await secrets.get({
        userId: 'user_123',
        key: 'wb_api_key',
        purpose: 'price_sync',
        ttl: 300,
      });

      expect(result.value).toBe('test-secret-value');
      expect(result.leaseId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('SG-5: Leak detection', () => {
    it('should detect OpenAI API key pattern', () => {
      const secrets = new SecretsGuard(testConfig);

      expect(() =>
        secrets.detectLeak(
          'Using key sk-proj-abcdefghij1234567890abcdefghij1234567890abcdefgh',
          'test'
        )
      ).toThrow(SecretLeakDetectedError);
    });

    it('should detect Groq API key pattern', () => {
      const secrets = new SecretsGuard(testConfig);

      expect(() =>
        secrets.detectLeak('gsk_abcdefghij1234567890abcdefghij1234567890abcdefghij12', 'test')
      ).toThrow(SecretLeakDetectedError);
    });

    it('should detect Telegram bot token pattern', () => {
      const secrets = new SecretsGuard(testConfig);
      // Telegram token format: 9-10 digit ID : 35 character token
      // ABCdefGHI-jklMNOpq_rsTUVwxyz1234567 = 35 chars
      expect(() =>
        secrets.detectLeak('Token: 1234567890:ABCdefGHI-jklMNOpq_rsTUVwxyz1234567', 'test')
      ).toThrow(SecretLeakDetectedError);
    });

    it('should detect private key pattern', () => {
      const secrets = new SecretsGuard(testConfig);

      expect(() => secrets.detectLeak('-----BEGIN RSA PRIVATE KEY-----', 'test')).toThrow(
        SecretLeakDetectedError
      );
    });

    it('should not throw for normal content', () => {
      const secrets = new SecretsGuard(testConfig);

      expect(() =>
        secrets.detectLeak('This is normal log content without secrets', 'test')
      ).not.toThrow();
    });

    it('should respect permissive mode', () => {
      const permissiveConfig = { ...testConfig, permissiveMode: true };
      const secrets = new SecretsGuard(permissiveConfig);

      // Should not throw even with secret pattern
      expect(() =>
        secrets.detectLeak('sk-proj-abcdefghij1234567890abcdefghij1234567890abcdefgh', 'test')
      ).not.toThrow();
    });
  });
});

describe('createEnvProxy', () => {
  it('should allow access to safe variables', () => {
    const secrets = new SecretsGuard(testConfig);
    const proxy = createEnvProxy(secrets, ['MY_SAFE_VAR']);

    // Set a safe variable
    process.env.NODE_ENV = 'test';

    expect(proxy.NODE_ENV).toBe('test');
  });

  it('should block access to secret variables', () => {
    const secrets = new SecretsGuard(testConfig);
    const proxy = createEnvProxy(secrets, []);

    expect(() => proxy.WB_API_KEY).toThrow(SecretAccessDeniedError);
    expect(() => proxy.OPENAI_API_KEY).toThrow(SecretAccessDeniedError);
    expect(() => proxy.ADMIN_API_KEY).toThrow(SecretAccessDeniedError);
  });

  it('should allow custom safe variables', () => {
    const secrets = new SecretsGuard(testConfig);
    process.env.MY_CUSTOM_VAR = 'custom-value';

    const proxy = createEnvProxy(secrets, ['MY_CUSTOM_VAR']);

    expect(proxy.MY_CUSTOM_VAR).toBe('custom-value');
  });
});
