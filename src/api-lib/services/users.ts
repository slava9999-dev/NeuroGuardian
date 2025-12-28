import { sql } from '@vercel/postgres';

export interface MarketplaceAccount {
  id: number;
  user_id: number;
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
  account: Omit<MarketplaceAccount, 'id' | 'created_at' | 'last_sync_at'>
): Promise<MarketplaceAccount> {
  const { rows } = await sql`
        INSERT INTO marketplace_accounts (user_id, name, marketplace, is_active, wb_token, ozon_client_id, ozon_api_key)
        VALUES (${account.user_id}, ${account.name}, ${account.marketplace}, ${account.is_active ?? true}, ${account.wb_token}, ${account.ozon_client_id || null}, ${account.ozon_api_key || null})
        RETURNING *
    `;
  return rows[0] as MarketplaceAccount;
}

export async function updateMarketplaceAccount(
  accountId: number,
  userId: number,
  updates: Partial<Omit<MarketplaceAccount, 'id' | 'user_id' | 'created_at'>>
): Promise<MarketplaceAccount | null> {
  // Construct dynamic update query
  // Since @vercel/postgres doesn't support dynamic SET easily, we check fields explicitly or use helper
  // For simplicity, we'll update fields if they are provided

  const existing = await getAccountById(accountId);
  if (!existing || Number(existing.user_id) !== userId) return null;

  const result = await sql`
    UPDATE marketplace_accounts SET
      name = ${updates.name ?? existing.name},
      is_active = ${updates.is_active ?? existing.is_active},
      wb_token = ${updates.wb_token !== undefined ? updates.wb_token : existing.wb_token},
      ozon_client_id = ${updates.ozon_client_id !== undefined ? updates.ozon_client_id : existing.ozon_client_id},
      ozon_api_key = ${updates.ozon_api_key !== undefined ? updates.ozon_api_key : existing.ozon_api_key},
      updated_at = NOW()
    WHERE id = ${accountId} AND user_id = ${userId}
    RETURNING *
  `;
  return (result.rows[0] as MarketplaceAccount) || null;
}

export async function deleteMarketplaceAccount(
  accountId: number,
  userId: number
): Promise<boolean> {
  const result = await sql`
    DELETE FROM marketplace_accounts 
    WHERE id = ${accountId} AND user_id = ${userId}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function getAllUsers(): Promise<Array<{ telegram_id: number }>> {
  const { rows } = await sql`SELECT id as telegram_id FROM users`;
  return rows as Array<{ telegram_id: number }>;
}
