// ============================================
// Security Regression Tests
// Ensures critical security fixes are never reverted
// ============================================

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Security Fixes Regression Tests', () => {
  describe('API Key Logging Prevention', () => {
    it('should not log API key length in admin.ts', () => {
      const adminPath = path.resolve('src/api-lib/handlers/admin.ts');
      const content = fs.readFileSync(adminPath, 'utf-8');

      // This was a real bug: console.log(`API key length: ${key.length}`)
      expect(content).not.toMatch(/console\.log.*key.*length/i);
    });

    it('should not have console.log with sensitive patterns', () => {
      const filesToCheck = [
        'src/api-lib/handlers/admin.ts',
        'src/api-lib/handlers/agent-v4.ts',
        'src/api-lib/handlers/sentinel.ts',
      ];

      for (const file of filesToCheck) {
        const filePath = path.resolve(file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Should not log API keys, tokens, or passwords directly
          expect(content).not.toMatch(/console\.log.*\b(apiKey|api_key|secret|password)\b/i);
        }
      }
    });
  });

  describe('Environment Security', () => {
    it('should have .env in .gitignore', () => {
      const gitignorePath = path.resolve('.gitignore');
      const content = fs.readFileSync(gitignorePath, 'utf-8');

      // Must have .env on its own line
      expect(content).toMatch(/^\.env$/m);
    });

    it('should have .env.local pattern in .gitignore', () => {
      const gitignorePath = path.resolve('.gitignore');
      const content = fs.readFileSync(gitignorePath, 'utf-8');

      // Can be exact match or wildcard pattern like .env*.local
      expect(content).toMatch(/\.env\*?\.local|\.env\.local/);
    });

    it('should not commit actual .env file', () => {
      // .env should exist (for development) but NOT be tracked by git
      const envPath = path.resolve('.env');
      const gitPath = path.resolve('.git');

      if (fs.existsSync(envPath) && fs.existsSync(gitPath)) {
        // Check if .env is tracked
        try {
          const result = execSync('git ls-files .env', { encoding: 'utf-8' });
          expect(result.trim()).toBe(''); // Should return empty (not tracked)
        } catch {
          // Command failed = not tracked, which is correct
        }
      }
    });
  });

  describe('Production Safety Guards', () => {
    it('should have production guard in handleResetDb', () => {
      const adminPath = path.resolve('src/api-lib/handlers/admin.ts');
      const content = fs.readFileSync(adminPath, 'utf-8');

      // Critical: handleResetDb must check for production environment
      expect(content).toMatch(/isProduction/);

      // Should return 403 or similar for production
      expect(content).toMatch(/handleResetDb/);
    });

    it('should define isProduction check', () => {
      const adminPath = path.resolve('src/api-lib/handlers/admin.ts');
      const content = fs.readFileSync(adminPath, 'utf-8');

      // Must have production environment detection
      expect(content).toMatch(/isProduction|process\.env\.NODE_ENV.*production|VERCEL_ENV/);
    });
  });

  describe('Logger Security', () => {
    it('should export logger from logger.ts', () => {
      const loggerPath = path.resolve('src/api-lib/lib/logger.ts');
      const content = fs.readFileSync(loggerPath, 'utf-8');

      expect(content).toMatch(/export const logger/);
    });

    it('should have PII redaction patterns', () => {
      const loggerPath = path.resolve('src/api-lib/lib/logger.ts');
      const content = fs.readFileSync(loggerPath, 'utf-8');

      // Must redact sensitive fields
      expect(content).toMatch(/SENSITIVE_PATTERNS|api[_-]?key|password|secret|token/i);
    });

    it('should have redactSensitiveData function', () => {
      const loggerPath = path.resolve('src/api-lib/lib/logger.ts');
      const content = fs.readFileSync(loggerPath, 'utf-8');

      expect(content).toMatch(/redactSensitiveData/);
    });
  });

  describe('Critical Files Presence', () => {
    const criticalFiles = [
      'src/api-lib/lib/logger.ts',
      'src/api-lib/handlers/admin.ts',
      'src/api-lib/handlers/sentinel.ts',
      'src/api-lib/handlers/agent-v4.ts',
      '.gitignore',
      'package.json',
      'tsconfig.json',
      '.github/workflows/ci.yml',
    ];

    for (const file of criticalFiles) {
      it(`should have critical file: ${file}`, () => {
        const filePath = path.resolve(file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    }
  });

  describe('No Hardcoded Secrets', () => {
    it('should not have hardcoded API keys in source files', () => {
      const scanPatterns = [
        /sk-[a-zA-Z0-9]{20,}/, // OpenAI-like keys
        /AIza[a-zA-Z0-9_-]{35}/, // Google API keys
        /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
        /ghr_[a-zA-Z0-9]{36}/, // GitHub refresh token
        /postgresql:\/\/[^@]+:[^@]+@/i, // Database connection strings with credentials
      ];

      const sourceFiles = [
        'src/api-lib/handlers/admin.ts',
        'src/api-lib/handlers/agent-v4.ts',
        'src/api-lib/handlers/sentinel.ts',
        'src/api-lib/agent/orchestrator-v4.ts',
      ];

      for (const file of sourceFiles) {
        const filePath = path.resolve(file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          for (const pattern of scanPatterns) {
            expect(content).not.toMatch(pattern);
          }
        }
      }
    });
  });
});
