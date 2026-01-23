import { sql } from '../../api-lib/services/database.js';
import { encryptionService } from '../../api-lib/services/encryption-service.js';

export interface MarketplaceAccountKeys {
  wb?: string;
  ozon?: { clientId: string; apiKey: string };
}

export class MarketplaceAccountRepository {
  async getKeys(userId: number, accountId?: number): Promise<MarketplaceAccountKeys> {
    const keys: MarketplaceAccountKeys = {};

    if (accountId) {
      const result = await sql`
        SELECT marketplace, wb_token, ozon_client_id, ozon_api_key 
        FROM marketplace_accounts 
        WHERE id = ${accountId} AND user_id = ${userId}
      `;

      const account = result.rows[0];
      if (!account) return keys;

      const mkt = account.marketplace?.toLowerCase();
      if (mkt === 'wb' && account.wb_token) {
        keys.wb = encryptionService.decrypt(account.wb_token);
      } else if (mkt === 'ozon' && account.ozon_client_id && account.ozon_api_key) {
        const clientId = encryptionService.decrypt(account.ozon_client_id);
        const apiKey = encryptionService.decrypt(account.ozon_api_key);
        if (clientId && apiKey) {
          keys.ozon = { clientId, apiKey };
        }
      }
      return keys;
    }

    // Fallback to user table (Legacy Single Account)
    const result = await sql`
      SELECT api_key_wb, api_key_ozon, ozon_client_id 
      FROM users 
      WHERE id = ${userId}
    `;
    const user = result.rows[0];
    if (!user) return keys;

    if (user.api_key_wb) {
      keys.wb = encryptionService.decrypt(user.api_key_wb);
    }

    if (user.api_key_ozon) {
      const ozonKey = encryptionService.decrypt(user.api_key_ozon);
      if (ozonKey) {
        if (ozonKey.includes(':')) {
          const [clientId, apiKey] = ozonKey.split(':');
          if (clientId && apiKey) keys.ozon = { clientId, apiKey };
        } else if (user.ozon_client_id) {
          const clientId = encryptionService.decrypt(user.ozon_client_id);
          if (clientId) keys.ozon = { clientId, apiKey: ozonKey };
        }
      }
    }

    return keys;
  }
}

export const marketplaceAccountRepository = new MarketplaceAccountRepository();
