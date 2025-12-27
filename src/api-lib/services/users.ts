import { sql } from '@vercel/postgres';

export interface MarketplaceAccount {
  id: number;
  user_id: string;
  name: string;
  marketplace: 'wb' | 'ozon';
  is_active: boolean;
  wb_token?: string;
  ozon_client_id?: string;
  ozon_api_key?: string;
  created_at: string;
  last_sync_at?: string;
}

export async function getMarketplaceAccounts(telegramId: number): Promise<MarketplaceAccount[]> {
  const { rows } =
    await sql`SELECT * FROM marketplace_accounts WHERE user_id = ${telegramId} ORDER BY created_at DESC`;
  return rows as MarketplaceAccount[];
}

export async function getAccountById(accountId: number): Promise<MarketplaceAccount | null> {
  const { rows } = await sql`SELECT * FROM marketplace_accounts WHERE id = ${accountId}`;
  return (rows[0] as MarketplaceAccount) || null;
}

export async function addMarketplaceAccount(
  account: Omit<MarketplaceAccount, 'id' | 'created_at'>
): Promise<MarketplaceAccount> {
  const { rows } = await sql`
        INSERT INTO marketplace_accounts (user_id, name, marketplace, is_active, wb_token, ozon_client_id, ozon_api_key)
        VALUES (${account.user_id}, ${account.name}, ${account.marketplace}, ${account.is_active ?? true}, ${account.wb_token}, ${account.ozon_client_id}, ${account.ozon_api_key})
        RETURNING *
    `;
  return rows[0] as MarketplaceAccount;
}

export async function getAllUsers(): Promise<Array<{ telegram_id: number }>> {
  const { rows } = await sql`SELECT id as telegram_id FROM users`;
  return rows as Array<{ telegram_id: number }>;
}
