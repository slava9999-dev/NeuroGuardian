import { sql } from './database.js';
import type { DBUser } from '../lib/types.js';

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

export async function getAllUsers(): Promise<Array<{ id: number; telegram_id: number }>> {
  const { rows } = await sql`SELECT id, id as telegram_id FROM users WHERE is_active = true`;
  return rows as Array<{ id: number; telegram_id: number }>;
}

export async function getUsersStats() {
  const total = await sql`SELECT COUNT(*) as count FROM users`;
  const active = await sql`SELECT COUNT(*) as count FROM users WHERE is_active = true`;
  const newToday =
    await sql`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '24 hours'`;

  return {
    total: parseInt(total.rows[0].count as string),
    active: parseInt(active.rows[0].count as string),
    newToday: parseInt(newToday.rows[0].count as string),
  };
}

export interface UserSummary {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_active: boolean;
  created_at: string; // The DBUser uses Date, but frontend might expect string. Keeping string for now or converting? Standardizing on Date is better but check usage.
  subscription_plan: string;
  total_products: number;
  platforms: string[];
}

export async function getUsersPaginated(
  limit: number,
  offset: number,
  search?: string
): Promise<UserSummary[]> {
  let query;

  if (search) {
    const searchPattern = `%${search}%`;
    query = sql`
      SELECT id, first_name, last_name, username, is_active, created_at, subscription_plan, total_products, api_key_wb, api_key_ozon
      FROM users 
      WHERE 
        first_name ILIKE ${searchPattern} OR 
        last_name ILIKE ${searchPattern} OR 
        username ILIKE ${searchPattern} OR
        CAST(id AS TEXT) ILIKE ${searchPattern}
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    query = sql`
      SELECT id, first_name, last_name, username, is_active, created_at, subscription_plan, total_products, api_key_wb, api_key_ozon
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  const { rows } = await query;

  return (rows as DBUser[]).map(row => ({
    id: Number(row.id), // Ensure number
    first_name: row.first_name,
    last_name: row.last_name || undefined,
    username: row.username || undefined,
    is_active: row.is_active,
    created_at: new Date(row.created_at).toISOString(),
    subscription_plan: row.subscription_plan || 'trial',
    total_products: row.total_products,
    platforms: [row.api_key_wb ? 'wb' : null, row.api_key_ozon ? 'ozon' : null].filter(
      (p): p is string => p !== null
    ),
  }));
}
