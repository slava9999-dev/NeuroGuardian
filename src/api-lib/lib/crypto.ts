// ============================================
// NeuroGUARDIAN — Crypto Utilities
// API key encryption/decryption with AES-256-GCM
// ============================================

import * as crypto from 'crypto';
import { API_KEY_ENCRYPTION_KEY } from './constants.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt API key using AES-256-GCM
 * Format: iv:authTag:encryptedData (all hex)
 * @throws Will throw error if encryption key is not configured
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return apiKey;
  if (!API_KEY_ENCRYPTION_KEY) {
    throw new Error(
      'CRYPTOGRAPHIC_ERROR: API_KEY_ENCRYPTION_KEY is not configured. Refusing to store plaintext secrets.'
    );
  }

  try {
    const key = Buffer.from(API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
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

  if (!API_KEY_ENCRYPTION_KEY) {
    throw new Error(
      'CRYPTOGRAPHIC_ERROR: API_KEY_ENCRYPTION_KEY is not configured. Cannot decrypt secrets.'
    );
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error(
        'CRYPTOGRAPHIC_ERROR: Invalid encrypted key format. Missing required components.'
      );
    }

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
    throw new Error(
      'CRYPTOGRAPHIC_ERROR: Failed to decrypt API key. The key may be corrupted or the encryption key may have changed.'
    );
  }
}
