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
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey || !API_KEY_ENCRYPTION_KEY) return apiKey;

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
    return apiKey; // Fallback
  }
}

/**
 * Decrypt API key using AES-256-GCM
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return '';

  // Check if key is encrypted (contains colons for iv:authTag:data format)
  if (!encryptedKey.includes(':') || !API_KEY_ENCRYPTION_KEY) {
    return encryptedKey; // Not encrypted or no key configured
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
    return encryptedKey; // Return as-is if decryption fails
  }
}
