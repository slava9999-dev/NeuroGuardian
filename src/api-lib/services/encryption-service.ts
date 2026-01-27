import { encryptApiKey, decryptApiKey } from '../lib/crypto.js';

/**
 * INDUSTRIAL SECURITY LAYER: AES-256-GCM Encryption
 * Used for protecting sensitive API keys in the database.
 * Unified with the main crypto library for cross-service compatibility.
 */
export class EncryptionService {
  /**
   * Encrypts plain text into a secure token
   */
  encrypt(text: string): string {
    if (!text) return '';
    return encryptApiKey(text);
  }

  /**
   * Decrypts token back to plain text
   */
  decrypt(token: string): string {
    if (!token) return '';
    return decryptApiKey(token);
  }

  /**
   * Utility to check if a string is likely encrypted
   */
  isEncrypted(text: string): boolean {
    return text.includes(':') && text.split(':').length === 3;
  }
}

export const encryptionService = new EncryptionService();
