import { sql } from '../../api-lib/services/database.js';
import type { TelegramUser } from '../../api-lib/services/database.js';
import { encryptApiKey, decryptApiKey } from '../../api-lib/lib/index.js';

export class UserRepository {
  async getById(id: number): Promise<TelegramUser | null> {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    const user = result.rows[0] as TelegramUser;
    return user ? this.decryptUser(user) : null;
  }

  async createOrUpdate(user: Partial<TelegramUser>): Promise<TelegramUser> {
    const result = await sql`
      INSERT INTO users (
        id, username, first_name, last_name, photo_url,
        api_key_wb, api_key_ozon, ozon_client_id, updated_at
      )
      VALUES (
        ${user.id}, ${user.username || null}, ${user.first_name}, 
        ${user.last_name || null}, ${user.photo_url || null},
        ${user.api_key_wb ? encryptApiKey(user.api_key_wb) : null}, 
        ${user.api_key_ozon ? encryptApiKey(user.api_key_ozon) : null}, 
        ${user.ozon_client_id ? encryptApiKey(user.ozon_client_id) : null}, 
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        photo_url = EXCLUDED.photo_url,
        updated_at = NOW()
      RETURNING *
    `;
    return result.rows[0] as TelegramUser;
  }

  async setProtectionEnabled(id: number, enabled: boolean): Promise<void> {
    await sql`UPDATE users SET protection_enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`;
  }

  async setDefenseMode(id: number, mode: 'zero_stock' | 'price_correction'): Promise<void> {
    await sql`UPDATE users SET defense_mode = ${mode}, updated_at = NOW() WHERE id = ${id}`;
  }

  async getAll(): Promise<TelegramUser[]> {
    const result = await sql`SELECT * FROM users ORDER BY created_at DESC`;
    return (result.rows as TelegramUser[]).map(u => this.decryptUser(u));
  }

  async getActiveForSentinel(): Promise<TelegramUser[]> {
    const result = await sql`
      SELECT * FROM users 
      WHERE is_active = true 
        AND (protection_enabled = true OR subscription_active = true)
    `;
    return (result.rows as TelegramUser[]).map(u => this.decryptUser(u));
  }

  private decryptUser(user: TelegramUser): TelegramUser {
    if (!user) return user;
    try {
      if (user.api_key_wb) user.api_key_wb = decryptApiKey(user.api_key_wb);
      if (user.api_key_ozon) user.api_key_ozon = decryptApiKey(user.api_key_ozon);
      if (user.ozon_client_id) user.ozon_client_id = decryptApiKey(user.ozon_client_id);
    } catch (e) {
      console.warn(`Failed to decrypt keys for user ${user.id}`, e);
    }
    return user;
  }
}

export const userRepository = new UserRepository();
