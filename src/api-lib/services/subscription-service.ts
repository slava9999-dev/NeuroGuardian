// NeuroGUARDIAN — Subscription Service
// Business logic for subscription management

import { sql } from './database.js';
import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionCheckResult,
  SubscriptionLimits,
  SubscriptionTierConfig,
} from '../types/subscription.js';

/**
 * Subscription Service
 * Handles all subscription-related business logic
 */
export class SubscriptionService {
  /**
   * Get user's subscription
   */
  static async getSubscription(userId: string | number): Promise<Subscription | null> {
    try {
      const result = await sql`
        SELECT * FROM subscriptions
        WHERE user_id = ${userId}
        LIMIT 1
      `;

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as Subscription;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription (trial or paid)
   */
  static async isActive(userId: string | number): Promise<boolean> {
    try {
      const result = await sql`
        SELECT is_subscription_active(${userId}) as is_active
      `;

      return result.rows[0]?.is_active === true;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get detailed subscription check with limits
   */
  static async checkSubscription(userId: string | number): Promise<SubscriptionCheckResult> {
    try {
      const subscription = await this.getSubscription(userId);

      if (!subscription) {
        return {
          is_active: false,
          status: 'expired',
          tier: 'free',
          limits: {
            max_products: 0,
            max_accounts: 0,
            current_products: 0,
            current_accounts: 0,
            can_add_product: false,
            can_add_account: false,
          },
          upgrade_required: true,
          upgrade_reason: 'No subscription found',
        };
      }

      // Get current usage
      const usage = await this.getCurrentUsage(userId);

      // Calculate days remaining
      let days_remaining: number | undefined;
      if (subscription.status === 'trial') {
        const now = new Date();
        const trialEnd = new Date(subscription.trial_ends_at);
        days_remaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (subscription.status === 'active' && subscription.current_period_end) {
        const now = new Date();
        const periodEnd = new Date(subscription.current_period_end);
        days_remaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const limits: SubscriptionLimits = {
        max_products: subscription.max_products,
        max_accounts: subscription.max_accounts,
        current_products: usage.products,
        current_accounts: usage.accounts,
        can_add_product: usage.products < subscription.max_products,
        can_add_account: usage.accounts < subscription.max_accounts,
      };

      const is_active = await this.isActive(userId);

      return {
        is_active,
        status: subscription.status,
        tier: subscription.plan_id as SubscriptionTier,
        days_remaining,

        limits,
        upgrade_required: !limits.can_add_product || !limits.can_add_account,
        upgrade_reason: !limits.can_add_product
          ? `Достигнут лимит товаров (${limits.max_products})`
          : !limits.can_add_account
            ? `Достигнут лимит магазинов (${limits.max_accounts})`
            : undefined,
      };
    } catch (error) {
      console.error('Failed to check subscription:', error);
      throw error;
    }
  }

  /**
   * Get current usage (products and accounts count)
   */
  private static async getCurrentUsage(
    userId: string | number
  ): Promise<{ products: number; accounts: number }> {
    try {
      const result = await sql`
        SELECT 
          (SELECT COUNT(*) FROM products WHERE user_id = ${userId}) as products,
          (SELECT COUNT(*) FROM marketplace_accounts WHERE user_id = ${userId}) as accounts
      `;

      return {
        products: Number(result.rows[0]?.products || 0),
        accounts: Number(result.rows[0]?.accounts || 0),
      };
    } catch (error) {
      console.error('Failed to get usage:', error);
      return { products: 0, accounts: 0 };
    }
  }

  /**
   * Create or update subscription
   */
  static async createOrUpdate(
    userId: string | number,
    tier: SubscriptionTier,
    status: SubscriptionStatus = 'trial'
  ): Promise<Subscription> {
    try {
      // Get tier config
      const tierConfig = await this.getTierConfig(tier);

      if (!tierConfig) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      // Check if subscription exists
      const existing = await this.getSubscription(userId);

      if (existing) {
        // Update existing
        const result = await sql`
          UPDATE subscriptions
          SET 
            plan_id = ${tier},
            status = ${status},
            max_products = ${tierConfig.max_products},
            max_accounts = ${tierConfig.max_accounts},
            updated_at = NOW()

          WHERE user_id = ${userId}
          RETURNING *
        `;

        return result.rows[0] as Subscription;
      } else {
        // Create new
        const result = await sql`
          INSERT INTO subscriptions (
            user_id, plan_id, status, max_products, max_accounts
          ) VALUES (
            ${userId}, ${tier}, ${status}, ${tierConfig.max_products}, ${tierConfig.max_accounts}
          )

          RETURNING *
        `;

        return result.rows[0] as Subscription;
      }
    } catch (error) {
      console.error('Failed to create/update subscription:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription to paid tier
   */
  static async upgrade(
    userId: string | number,
    newTier: SubscriptionTier,
    billingPeriod: 'monthly' | 'yearly' = 'monthly'
  ): Promise<Subscription> {
    try {
      const tierConfig = await this.getTierConfig(newTier);

      if (!tierConfig) {
        throw new Error(`Invalid tier: ${newTier}`);
      }

      const now = new Date();
      const periodEnd = new Date(now);

      if (billingPeriod === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const result = await sql`
        UPDATE subscriptions
        SET 
          plan_id = ${newTier},
          status = 'active',
          max_products = ${tierConfig.max_products},
          max_accounts = ${tierConfig.max_accounts},
          current_period_start = NOW(),
          current_period_end = ${periodEnd.toISOString()},
          updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING *
      `;

      // Sync with users table for backward compatibility
      await sql`
        UPDATE users
        SET 
          subscription_plan = ${newTier},
          subscription_end = ${periodEnd.toISOString()},
          subscription_active = true,
          updated_at = NOW()
        WHERE id = ${userId}
      `;

      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      return result.rows[0] as Subscription;
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancel(
    userId: string | number,
    reason?: string,
    immediately: boolean = false
  ): Promise<Subscription> {
    try {
      const status = immediately ? 'cancelled' : 'active'; // Keep active until period ends

      const result = await sql`
        UPDATE subscriptions
        SET 
          status = ${status},
          cancelled_at = NOW(),
          cancellation_reason = ${reason || null},
          updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING *
      `;

      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      return result.rows[0] as Subscription;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Get tier configuration
   */
  static async getTierConfig(tier: SubscriptionTier): Promise<SubscriptionTierConfig | null> {
    try {
      const result = await sql`
        SELECT * FROM subscription_tiers
        WHERE tier = ${tier}
        LIMIT 1
      `;

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as SubscriptionTierConfig;
    } catch (error) {
      console.error('Failed to get tier config:', error);
      return null;
    }
  }

  /**
   * Get all available tiers
   */
  static async getAllTiers(): Promise<SubscriptionTierConfig[]> {
    try {
      const result = await sql`
        SELECT * FROM subscription_tiers
        WHERE is_active = true
        ORDER BY display_order ASC
      `;

      return result.rows as SubscriptionTierConfig[];
    } catch (error) {
      console.error('Failed to get tiers:', error);
      return [];
    }
  }

  /**
   * Update expired subscriptions (cron job)
   */
  static async updateExpired(): Promise<number> {
    try {
      const result = await sql`
        SELECT update_expired_subscriptions() as updated_count
      `;

      return Number(result.rows[0]?.updated_count || 0);
    } catch (error) {
      console.error('Failed to update expired subscriptions:', error);
      return 0;
    }
  }

  /**
   * Record successful payment
   */
  static async recordPayment(
    userId: string | number,
    paymentId: string,
    amount: number,
    provider: string
  ): Promise<void> {
    try {
      const subscription = await this.getSubscription(userId);

      await sql`
        UPDATE subscriptions
        SET 
          last_payment_at = NOW(),
          last_payment_amount = ${amount},
          payment_method = ${provider},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `;

      await sql`
        INSERT INTO payments (
          user_id, subscription_id, payment_id, amount, status, provider, paid_at
        ) VALUES (
          ${userId}, ${subscription?.id || null}, ${paymentId}, ${amount}, 'succeeded', ${provider}, NOW()
        )
      `;
    } catch (error) {
      console.error('Failed to record payment:', error);
      throw error;
    }
  }
}
