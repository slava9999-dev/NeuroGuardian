import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SecurityAgent,
  InjectionDetectedError,
  type SecurityAgentConfig,
} from '@neuroguardian/security-agent';

describe('SecurityAgent Integration', () => {
  let agent: SecurityAgent;

  // Mock ioredis to suppress NOAUTH logs during testing
  vi.mock('ioredis', () => {
    const Redis = vi.fn();
    Redis.prototype.connect = vi.fn().mockResolvedValue(undefined);
    Redis.prototype.ping = vi.fn().mockResolvedValue('PONG');
    Redis.prototype.get = vi.fn().mockResolvedValue(null);
    Redis.prototype.set = vi.fn().mockResolvedValue('OK');
    Redis.prototype.setex = vi.fn().mockResolvedValue('OK');
    Redis.prototype.incr = vi.fn().mockResolvedValue(1);
    Redis.prototype.expire = vi.fn().mockResolvedValue(1);
    Redis.prototype.ttl = vi.fn().mockResolvedValue(300);
    Redis.prototype.disconnect = vi.fn().mockResolvedValue(undefined);
    Redis.prototype.on = vi.fn();
    return { default: Redis };
  });

  beforeEach(() => {
    // Reset env for each test
    process.env.NODE_ENV = 'test';
    const config: SecurityAgentConfig = {
      vault: { address: 'http://localhost:8200', token: 'test', tlsEnabled: false },
      redis: {
        url: process.env.REDIS_URL || 'redis://:localredispass@localhost:6379',
      },
      clickhouse: {
        host: 'localhost',
        port: 8123,
        database: 'test',
        username: 'test',
        password: '',
      },
      signingKey: 'test-key',
      environment: 'development',
      permissiveMode: true,
      enableLeakDetection: true,
    };
    agent = new SecurityAgent(config);
  });

  it('should detect SQL injection attempts', async () => {
    const maliciousReq = {
      method: 'POST',
      body: { query: 'SELECT * FROM users; DROP TABLE products;--' },
      userId: 'attacker_123',
      headers: { 'user-agent': 'test' },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkBody: true },
      });

      await middleware(maliciousReq as unknown as Request, res);
      // If it doesn't throw, it's a failure
      expect(true, 'Middleware should have thrown for SQL injection').toBe(false);
    } catch (error: unknown) {
      if (error instanceof InjectionDetectedError) {
        expect(error.name).toBe('InjectionDetectedError');
        expect(error.code).toBe('INJECTION_ATTEMPT');
        expect(error.details?.threatType).toBe('SQL_INJECTION');
      } else {
        throw error;
      }
    }
  });

  it('should detect XSS attempts', async () => {
    const maliciousReq = {
      method: 'POST',
      body: { comment: '<script>alert("xss")</script>' },
      userId: 'attacker_123',
      headers: { 'user-agent': 'test' },
    };

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkBody: true },
      });
      await middleware(maliciousReq as unknown as Request, res);
      expect(true, 'Middleware should have thrown for XSS').toBe(false);
    } catch (error: unknown) {
      if (error instanceof InjectionDetectedError) {
        expect(error.details?.threatType).toBe('XSS');
      } else {
        throw error;
      }
    }
  });

  it('should detect NoSQL injection', async () => {
    const maliciousReq = {
      method: 'GET',
      query: { filter: { id: { $ne: null } } },
      userId: 'attacker_123',
      headers: { 'user-agent': 'test' },
    };

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkQuery: true },
      });
      await middleware(maliciousReq as unknown as Request, res);
      expect(true, 'Middleware should have thrown for NoSQL injection').toBe(false);
    } catch (error: unknown) {
      if (error instanceof InjectionDetectedError) {
        expect(error.details?.threatType).toBe('NOSQL_INJECTION');
      } else {
        throw error;
      }
    }
  });
});
