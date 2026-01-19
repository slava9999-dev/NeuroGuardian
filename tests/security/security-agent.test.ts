import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SecurityAgent,
  InjectionDetectedError,
  type SecurityAgentConfig,
} from '@neuroguardian/security-agent';

describe('SecurityAgent Integration', () => {
  let agent: SecurityAgent;

  beforeEach(() => {
    // Reset env for each test
    process.env.NODE_ENV = 'test';
    const config: SecurityAgentConfig = {
      vault: { address: 'http://localhost:8200', token: 'test', tlsEnabled: false },
      redis: { host: 'localhost', port: 6379 },
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

    const next = vi.fn();
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkBody: true },
      });

      await middleware(maliciousReq as any, res, next);
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

    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkBody: true },
      });
      await middleware(maliciousReq as any, res, next);
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

    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    try {
      const middleware = agent.createMiddleware({
        inputValidation: { checkQuery: true },
      });
      await middleware(maliciousReq as any, res, next);
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
