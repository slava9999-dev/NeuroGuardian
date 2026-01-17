// ============================================
// NeuroGUARDIAN — Crypto Utilities
// API key encryption/decryption with AES-256-GCM
// ============================================

import * as crypto from 'crypto';
import { config } from '../../infrastructure/config/env.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt API key using AES-256-GCM
 * Format: iv:authTag:encryptedData (all hex)
 * @throws Will throw error if encryption key is not configured
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return apiKey;

  try {
    // Key must be exactly 32 bytes for aes-256
    let key: Buffer;
    const rawKey = config.API_KEY_ENCRYPTION_KEY;

    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      // It's a hex string (32 bytes)
      key = Buffer.from(rawKey, 'hex');
    } else {
      // It's a plaintext string, take first 32 chars or pad
      key = Buffer.alloc(32);
      Buffer.from(rawKey, 'utf8').copy(key);
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(
      'CRYPTOGRAPHIC_ERROR: Failed to encrypt API key. This is a critical security failure.'
    );
  }
}

/**
 * Decrypt API key using AES-256-GCM
 * @throws Will throw error if decryption fails or key is not configured
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return '';

  // Check if key is encrypted (contains colons for iv:authTag:data format)
  if (!encryptedKey.includes(':')) {
    // AUDIT-FIX: Allow legacy plaintext keys during migration
    // console.warn('CRYPTOGRAPHIC_WARNING: Legacy plaintext key detected.');
    return encryptedKey;
  }

  const parts = encryptedKey.split(':');
  if (parts.length !== 3) {
    return encryptedKey;
  }

  try {
    const [ivHex, authTagHex, encrypted] = parts;
    const rawKey = config.API_KEY_ENCRYPTION_KEY;

    let key: Buffer;
    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      key = Buffer.from(rawKey, 'hex');
    } else {
      key = Buffer.alloc(32);
      Buffer.from(rawKey, 'utf8').copy(key);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(
      'CRYPTOGRAPHIC_ERROR: Failed to decrypt API key. The key may be corrupted or the encryption key may have changed.'
    );
  }
}
