import { sql } from '../../api-lib/services/database.js';
import type { TelegramUser } from '../../api-lib/services/database.js';
import { encryptApiKey, decryptApiKey } from '../../api-lib/lib/index.js';

export class UserRepository {
  async getById(id: string | number): Promise<TelegramUser | null> {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    const user = result.rows[0] as TelegramUser;
    return user ? this.decryptUser(user) : null;
  }

  async createOrUpdate(user: Partial<TelegramUser>): Promise<TelegramUser> {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    // 1. Upsert User (with Trial for new users)
    const result = await sql`
      INSERT INTO users (
        id, username, first_name, last_name, photo_url,
        api_key_wb, api_key_ozon, ozon_client_id, updated_at,
        subscription_active, subscription_end, subscription_plan,
        protection_enabled, is_active
      )
      VALUES (
        ${user.id}, ${user.username || null}, ${user.first_name}, 
        ${user.last_name || null}, ${user.photo_url || null},
        ${user.api_key_wb ? encryptApiKey(user.api_key_wb) : null}, 
        ${user.api_key_ozon ? encryptApiKey(user.api_key_ozon) : null}, 
        ${user.ozon_client_id ? encryptApiKey(user.ozon_client_id) : null}, 
        NOW(),
        true, ${trialEnd.toISOString()}, 'trial',
        true, true
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        photo_url = EXCLUDED.photo_url,
        updated_at = NOW()
      RETURNING *
    `;

    // 2. Ensure Subscription Record Exists (Repair/Init)
    // If user has no subscription record, give them a trial
    const subCheck = await sql`SELECT user_id FROM subscriptions WHERE user_id = ${user.id}`;

    if (subCheck.rows.length === 0) {
      await sql`
        INSERT INTO subscriptions (
          user_id, tier, status, max_products, max_accounts, trial_ends_at
        ) VALUES (
          ${user.id}, 'pro', 'trial', 100, 3, ${trialEnd.toISOString()}
        )
      `;

      // Also ensure users table reflects this (if it was an update of an old user without sub)
      await sql`
        UPDATE users 
        SET subscription_active = true, 
            subscription_end = ${trialEnd.toISOString()}, 
            subscription_plan = 'trial'
        WHERE id = ${user.id} AND subscription_active = false
      `;
    }

    const dbUser = result.rows[0] as TelegramUser;
    return this.decryptUser(dbUser);
  }

  async setProtectionEnabled(id: string | number, enabled: boolean): Promise<void> {
    await sql`UPDATE users SET protection_enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`;
  }

  async setDefenseMode(
    id: string | number,
    mode: 'zero_stock' | 'price_correction'
  ): Promise<void> {
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
        AND protection_enabled = true
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
