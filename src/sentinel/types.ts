import type { DBUser, DBProduct } from '../api-lib/lib/types.js';

export interface SentinelRunResult {
  usersProcessed: number;
  threatsDetected: number;
  actionsTaken: number;
  errors: string[];
  productsScanned: { wb: number; ozon: number };
  defenseDetails?: Array<{ product: string; action: string; marketplace: string }>;
}

export interface UserCycleResult {
  userId: string | number;
  telegramId: string | number;
  firstName?: string;
  productsScanned: { wb: number; ozon: number };
  threatsDetected: number;
  actionsTaken: number;
  defenseDetails: Array<{
    product: string;
    action: string;
    marketplace: string;
    savedAmount: number;
  }>;
  errors: string[];
}

export interface PriceMonitor {
  fetchAll(
    user: DBUser,
    products: DBProduct[]
  ): Promise<{
    wb: Map<string, number>;
    ozon: Map<string, number>;
    errors: string[];
  }>;
}
