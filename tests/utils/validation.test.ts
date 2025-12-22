// ============================================
// NeuroGUARDIAN — Validation Tests
// Tests for input validation and sanitization
// ============================================

import { describe, it, expect } from 'vitest';

// Extracted validation logic from api/index.ts
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function isValidTelegramId(id: unknown): boolean {
  if (typeof id === 'number') {
    return Number.isInteger(id) && id > 0;
  }
  if (typeof id === 'string') {
    const num = parseInt(id, 10);
    return !isNaN(num) && num > 0;
  }
  return false;
}

function isValidPrice(price: unknown): boolean {
  if (typeof price !== 'number') return false;
  return price >= 0 && price <= 10000000 && Number.isFinite(price);
}

function isValidPercentage(percent: unknown): boolean {
  if (typeof percent !== 'number') return false;
  return percent >= 0 && percent <= 100;
}

describe('Input Validation', () => {
  describe('sanitizeInput', () => {
    it('should escape HTML tags', () => {
      expect(sanitizeInput('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape quotes', () => {
      expect(sanitizeInput('test "value" here')).toBe('test &quot;value&quot; here');
    });

    it('should escape single quotes', () => {
      expect(sanitizeInput("test 'value'")).toBe('test &#x27;value&#x27;');
    });

    it('should handle empty string', () => {
      expect(sanitizeInput('')).toBe('');
    });

    it('should return empty for non-string input', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });
  });

  describe('isValidTelegramId', () => {
    it('should accept valid numeric IDs', () => {
      expect(isValidTelegramId(123456789)).toBe(true);
      expect(isValidTelegramId(1)).toBe(true);
    });

    it('should accept valid string IDs', () => {
      expect(isValidTelegramId('123456789')).toBe(true);
    });

    it('should reject invalid IDs', () => {
      expect(isValidTelegramId(0)).toBe(false);
      expect(isValidTelegramId(-1)).toBe(false);
      expect(isValidTelegramId('abc')).toBe(false);
      expect(isValidTelegramId(null)).toBe(false);
      expect(isValidTelegramId(undefined)).toBe(false);
    });
  });

  describe('isValidPrice', () => {
    it('should accept valid prices', () => {
      expect(isValidPrice(0)).toBe(true);
      expect(isValidPrice(100)).toBe(true);
      expect(isValidPrice(9999.99)).toBe(true);
      expect(isValidPrice(10000000)).toBe(true);
    });

    it('should reject invalid prices', () => {
      expect(isValidPrice(-1)).toBe(false);
      expect(isValidPrice(10000001)).toBe(false);
      expect(isValidPrice(Infinity)).toBe(false);
      expect(isValidPrice(NaN)).toBe(false);
      expect(isValidPrice('100')).toBe(false);
    });
  });

  describe('isValidPercentage', () => {
    it('should accept valid percentages', () => {
      expect(isValidPercentage(0)).toBe(true);
      expect(isValidPercentage(50)).toBe(true);
      expect(isValidPercentage(100)).toBe(true);
    });

    it('should reject invalid percentages', () => {
      expect(isValidPercentage(-1)).toBe(false);
      expect(isValidPercentage(101)).toBe(false);
      expect(isValidPercentage(NaN)).toBe(false);
    });
  });
});
