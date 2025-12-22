// ============================================
// NeuroGUARDIAN — Crypto Utils Tests
// Tests for API key encryption/decryption
// ============================================

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Since api/index.ts is a monolith, we'll extract and test the logic directly
// This test validates the encryption pattern used in the app

// MUST be exactly 32 characters for AES-256
const API_KEY_ENCRYPTION_KEY = '12345678901234567890123456789012';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function encryptApiKey(apiKey: string, encryptionKey: string = API_KEY_ENCRYPTION_KEY): string {
  if (!apiKey || !encryptionKey || encryptionKey.length < 32) return apiKey;

  try {
    const key = Buffer.from(encryptionKey.slice(0, 32), 'utf8');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return apiKey;
  }
}

function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return '';

  if (!encryptedKey.includes(':') || !API_KEY_ENCRYPTION_KEY) {
    return encryptedKey;
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encrypted) return encryptedKey;

    const key = Buffer.from(API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedKey;
  }
}

describe('Crypto Utils', () => {
  describe('encryptApiKey', () => {
    it('should encrypt and decrypt API key correctly', () => {
      const originalKey = 'wb-api-key-12345';
      const encrypted = encryptApiKey(originalKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const originalKey = 'test-key';
      const encrypted1 = encryptApiKey(originalKey);
      const encrypted2 = encryptApiKey(originalKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return empty string for empty input', () => {
      expect(decryptApiKey('')).toBe('');
    });

    it('should return original if not encrypted format', () => {
      const unencrypted = 'plain-api-key';
      expect(decryptApiKey(unencrypted)).toBe(unencrypted);
    });

    it('should handle special characters in API key', () => {
      const specialKey = 'wb_key+test/special=chars!@#$%^&*()';
      const encrypted = encryptApiKey(specialKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(specialKey);
    });

    it('should produce encrypted format with 3 parts separated by colons', () => {
      const encrypted = encryptApiKey('test-key');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[a-f0-9]+$/); // IV (hex)
      expect(parts[1]).toMatch(/^[a-f0-9]+$/); // Auth tag (hex)
      expect(parts[2]).toMatch(/^[a-f0-9]+$/); // Ciphertext (hex)
    });
  });
});
