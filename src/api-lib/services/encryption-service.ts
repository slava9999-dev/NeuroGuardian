import crypto from 'crypto';

/**
 * INDUSTRIAL SECURITY LAYER: AES-256-GCM Encryption
 * Used for protecting sensitive API keys in the database.
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    // MASTER_KEY must be a 32-byte hex string or base64
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      console.warn('⚠️ ENCRYPTION_MASTER_KEY not found. Using fallback for dev (NOT SECURE).');
      this.key = crypto.scryptSync('dev-fallback-key', 'salt', 32);
    } else {
      this.key = Buffer.from(masterKey, 'hex');
    }
  }

  /**
   * Encrypts plain text into a secure token
   * Format: iv:authTag:encryptedData
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts token back to plain text
   */
  decrypt(token: string): string {
    try {
      const [ivHex, authTagHex, encryptedData] = token.split(':');
      if (!ivHex || !authTagHex || !encryptedData) {
        // Handle legacy unencrypted keys during transition
        return token;
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (e) {
      console.error('[EncryptionService] Decryption failed:', e);
      return token; // Fallback to raw for transition
    }
  }

  /**
   * Utility to check if a string is likely encrypted
   */
  isEncrypted(text: string): boolean {
    return text.includes(':') && text.split(':').length === 3;
  }
}

export const encryptionService = new EncryptionService();
