// ============================================
// Logger PII Redaction Tests
// Ensures sensitive data is never logged in plain text
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger } from '../../src/api-lib/lib/logger.js';

describe('Logger PII Redaction', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('API Key Redaction', () => {
    it('should redact api_key values', () => {
      logger.info('Test message', { api_key: 'sk-secret123456789' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('sk-s***[REDACTED]');
      expect(logOutput).not.toContain('sk-secret123456789');
    });

    it('should redact apiKey values', () => {
      logger.info('Test message', { apiKey: 'my-super-secret-key' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('my-super-secret-key');
    });

    it('should redact api-key values', () => {
      logger.info('Test message', { 'api-key': 'another-secret-key-here' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('another-secret-key-here');
    });
  });

  describe('Password Redaction', () => {
    it('should redact password values', () => {
      logger.info('Test message', { password: 'mypassword123' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('mypassword123');
    });

    it('should redact userPassword values', () => {
      logger.info('Test message', { userPassword: 'secret-pass-456' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('secret-pass-456');
    });
  });

  describe('Token Redaction', () => {
    it('should redact token values', () => {
      logger.info('Test message', { token: 'jwt-token-value-12345' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('jwt-token-value-12345');
    });

    it('should redact accessToken values', () => {
      logger.info('Test message', { accessToken: 'bearer-access-token' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('bearer-access-token');
    });

    it('should redact refreshToken values', () => {
      logger.info('Test message', { refreshToken: 'refresh-token-xyz' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('refresh-token-xyz');
    });
  });

  describe('Authorization Redaction', () => {
    it('should redact authorization values', () => {
      logger.info('Test message', { authorization: 'Bearer my-jwt-token' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('Bearer my-jwt-token');
    });
  });

  describe('Secret Redaction', () => {
    it('should redact secret values', () => {
      logger.info('Test message', { secret: 'my-secret-value' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('my-secret-value');
    });

    it('should redact clientSecret values', () => {
      logger.info('Test message', { clientSecret: 'oauth-client-secret' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('oauth-client-secret');
    });
  });

  describe('Client ID Redaction', () => {
    it('should redact client_id values', () => {
      logger.info('Test message', { client_id: 'client-12345678' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('client-12345678');
    });

    it('should redact clientId values', () => {
      logger.info('Test message', { clientId: 'clientid-abc123' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('clientid-abc123');
    });
  });

  describe('Nested Object Redaction', () => {
    it('should redact sensitive data in nested objects', () => {
      logger.info('Test message', {
        user: {
          name: 'John',
          password: 'nested-password-123',
        },
      });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('John');
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('nested-password-123');
    });

    it('should redact sensitive data in deeply nested objects', () => {
      logger.info('Test message', {
        config: {
          auth: {
            credentials: {
              api_key: 'deep-secret-key',
            },
          },
        },
      });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('deep-secret-key');
    });
  });

  describe('Array Redaction', () => {
    it('should redact sensitive data in arrays', () => {
      logger.info('Test message', {
        accounts: [
          { name: 'Account1', api_key: 'key-1-secret' },
          { name: 'Account2', api_key: 'key-2-secret' },
        ],
      });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('Account1');
      expect(logOutput).toContain('Account2');
      expect(logOutput).not.toContain('key-1-secret');
      expect(logOutput).not.toContain('key-2-secret');
    });
  });

  describe('Non-Sensitive Data', () => {
    it('should NOT redact non-sensitive fields', () => {
      logger.info('Test message', {
        userId: 123,
        email: 'user@example.com',
        action: 'update_price',
        productId: 'SKU-12345',
      });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('user@example.com');
      expect(logOutput).toContain('update_price');
      expect(logOutput).toContain('SKU-12345');
    });
  });

  describe('Short Values Handling', () => {
    it('should fully redact short values without showing prefix', () => {
      logger.info('Test message', { password: 'abc' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('***[REDACTED]');
      expect(logOutput).not.toContain('abc');
    });
  });

  describe('Log Levels', () => {
    it('should redact in warn level logs', () => {
      logger.warn('Warning message', { api_key: 'warn-secret-key' });

      const logOutput = consoleWarnSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('warn-secret-key');
    });

    it('should redact in error level logs', () => {
      logger.error('Error message', new Error('test'), { api_key: 'error-secret-key' });

      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('error-secret-key');
    });
  });

  describe('Child Logger', () => {
    it('should redact sensitive data in child logger', () => {
      const childLogger = createLogger({ correlationId: 'test-123' });
      childLogger.info('Child log', { password: 'child-password' });

      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('test-123');
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).not.toContain('child-password');
    });
  });
});
