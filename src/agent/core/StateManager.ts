// ============================================
// NeuroGUARDIAN — State Manager
// Professional Architecture v5
// ============================================

import { sql } from '../../api-lib/services/database.js';
import { getMarketplaceKeys } from '../../api-lib/services/index.js';
import { logger } from '../../api-lib/lib/logger.js';
import type { UserState } from '../../core/types/index.js';

export class StateManager {
  private tableChecked = false;

  constructor() {
    // No longer calling async method in constructor to prevent unhandled rejections
  }

  /**
   * Lazily ensure the table exists
   */
  private async lazyEnsureTableExists(): Promise<void> {
    if (this.tableChecked) return;

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS user_state (
          user_id BIGINT PRIMARY KEY,
          marketplace TEXT,
          has_api_keys BOOLEAN NOT NULL DEFAULT false,
          products_count INTEGER NOT NULL DEFAULT 0,
          subscription_tier TEXT NOT NULL DEFAULT 'free',
          gender TEXT,
          user_name TEXT,
          current_intent TEXT,
          pending_action JSONB,
          awaiting_input JSONB,
          last_mentioned_products JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_query TEXT,
          last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          session_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          total_queries INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `;
      this.tableChecked = true;
    } catch (error) {
      logger.error('Failed to create user_state table:', error);
      // Don't set tableChecked to true so we retry next time
    }
  }

  /**
   * Get user state from database
   */
  async getState(userId: number): Promise<UserState> {
    await this.lazyEnsureTableExists();

    try {
      const result = await sql`
        SELECT * FROM user_state WHERE user_id = ${userId}
      `;

      let state: UserState;

      if (result.rows.length > 0) {
        const row = result.rows[0];
        state = {
          userId: Number(userId),
          marketplace: (row.marketplace as 'WB' | 'Ozon' | 'both' | null) || null,
          hasApiKeys: row.has_api_keys || false,
          hasWbKey: false,
          hasOzonKey: false,
          productsCount: row.products_count || 0,
          subscriptionTier: (row.subscription_tier as 'free' | 'basic' | 'pro') || 'free',
          gender: (row.gender as 'male' | 'female' | 'unknown') || undefined,
          userName: row.user_name || undefined,
          currentIntent: row.current_intent || undefined,
          pendingAction: row.pending_action
            ? (this.parseJsonWithDate(row.pending_action) as UserState['pendingAction'])
            : undefined,
          awaitingInput: row.awaiting_input
            ? (this.parseJsonWithDate(row.awaiting_input) as UserState['awaitingInput'])
            : undefined,
          lastMentionedProducts: Array.isArray(row.last_mentioned_products)
            ? row.last_mentioned_products
            : [],
          lastQuery: row.last_query || undefined,
          lastActiveAt: new Date(row.last_active_at),
          sessionStartedAt: new Date(row.session_started_at),
          totalQueries: row.total_queries || 0,
        };
      } else {
        state = this.getDefaultState(userId);
      }

      // Enrichment logic
      const keys = await getMarketplaceKeys(userId);
      state.hasWbKey = !!keys.wb;
      state.hasOzonKey = !!keys.ozon;
      state.hasApiKeys = !!keys.wb || !!keys.ozon;

      return state;
    } catch (error) {
      logger.error(`Failed to get state for user ${userId}:`, error);
    }

    return this.getDefaultState(userId);
  }

  private parseJsonWithDate(data: unknown): unknown {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && 'createdAt' in parsed) {
          (parsed as Record<string, unknown>).createdAt = new Date(String(parsed.createdAt));
        }
        return parsed;
      } catch {
        return data;
      }
    }
    if (data && typeof data === 'object' && data !== null && 'createdAt' in data) {
      (data as Record<string, unknown>).createdAt = new Date(String((data as any).createdAt));
    }
    return data;
  }

  /**
   * Update user state partially
   */
  async updateState(userId: number, partial: Partial<UserState>): Promise<void> {
    await this.lazyEnsureTableExists();

    try {
      const currentState = await this.getState(userId);
      const newState = { ...currentState, ...partial, lastActiveAt: new Date() };

      await sql`
        INSERT INTO user_state (
          user_id, marketplace, has_api_keys, products_count, subscription_tier,
          gender, user_name, current_intent, pending_action, awaiting_input, 
          last_mentioned_products, last_query, last_active_at, session_started_at, 
          total_queries, updated_at
        ) VALUES (
          ${userId}, ${newState.marketplace}, ${newState.hasApiKeys}, ${newState.productsCount},
          ${newState.subscriptionTier}, ${newState.gender || null}, ${newState.userName || null},
          ${newState.currentIntent},
          ${newState.pendingAction ? JSON.stringify(newState.pendingAction) : null},
          ${newState.awaitingInput ? JSON.stringify(newState.awaitingInput) : null},
          ${JSON.stringify(newState.lastMentionedProducts)}, ${newState.lastQuery || null}, 
          ${newState.lastActiveAt}, ${newState.sessionStartedAt}, ${newState.totalQueries}, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          marketplace = EXCLUDED.marketplace,
          has_api_keys = EXCLUDED.has_api_keys,
          products_count = EXCLUDED.products_count,
          subscription_tier = EXCLUDED.subscription_tier,
          gender = EXCLUDED.gender,
          user_name = EXCLUDED.user_name,
          current_intent = EXCLUDED.current_intent,
          pending_action = EXCLUDED.pending_action,
          awaiting_input = EXCLUDED.awaiting_input,
          last_mentioned_products = EXCLUDED.last_mentioned_products,
          last_query = EXCLUDED.last_query,
          last_active_at = EXCLUDED.last_active_at,
          session_started_at = EXCLUDED.session_started_at,
          total_queries = EXCLUDED.total_queries,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (error) {
      logger.error(`Failed to update state for user ${userId}:`, error);
    }
  }

  /**
   * Clear pending action
   */
  async clearPendingAction(userId: number): Promise<void> {
    await this.updateState(userId, { pendingAction: undefined });
  }

  /**
   * Set awaiting input state
   */
  async setAwaitingInput(
    userId: number,
    type: string,
    question: string,
    forProductId?: string
  ): Promise<void> {
    const validType = type as UserState['awaitingInput'] extends { type: infer T } | undefined
      ? T
      : never;

    const awaitingInput = {
      type: validType,
      forProductId,
      question: question || `Введите ${type}:`,
      createdAt: new Date(),
    };
    await this.updateState(userId, { awaitingInput });
  }

  /**
   * Clear awaiting input state
   */
  async clearAwaitingInput(userId: number): Promise<void> {
    await this.updateState(userId, { awaitingInput: undefined });
  }

  /**
   * Set current intent
   */
  async setCurrentIntent(userId: number, intent: string): Promise<void> {
    await this.updateState(userId, { currentIntent: intent });
  }

  /**
   * Clear current intent
   */
  async clearCurrentIntent(userId: number): Promise<void> {
    await this.updateState(userId, { currentIntent: undefined });
  }

  /**
   * Increment query counter
   */
  async incrementQueryCount(userId: number): Promise<void> {
    const state = await this.getState(userId);
    await this.updateState(userId, { totalQueries: state.totalQueries + 1 });
  }

  async recordQuery(userId: number, query: string): Promise<void> {
    const state = await this.getState(userId);
    await this.updateState(userId, {
      totalQueries: state.totalQueries + 1,
      lastQuery: query,
    });
  }

  /**
   * Update last mentioned products
   */
  async updateLastMentionedProducts(userId: number, productIds: string[]): Promise<void> {
    await this.updateState(userId, { lastMentionedProducts: productIds });
  }

  async trackMentionedProducts(userId: number, productIds: string[]): Promise<void> {
    await this.updateLastMentionedProducts(userId, productIds);
  }

  async cleanupExpiredState(userId: number): Promise<void> {
    const state = await this.getState(userId);
    const now = new Date();
    // Clean interactive state if older than 30 mins
    if (now.getTime() - state.lastActiveAt.getTime() > 30 * 60 * 1000) {
      if (state.awaitingInput) await this.clearAwaitingInput(userId);
      if (state.pendingAction) await this.clearPendingAction(userId);
      if (state.currentIntent) await this.clearCurrentIntent(userId);
    }
  }

  /**
   * Get default state
   */
  private getDefaultState(userId: number): UserState {
    return {
      userId,
      marketplace: 'both',
      hasApiKeys: false,
      hasWbKey: false,
      hasOzonKey: false,
      productsCount: 0,
      subscriptionTier: 'free',
      lastMentionedProducts: [],
      lastActiveAt: new Date(),
      sessionStartedAt: new Date(),
      totalQueries: 0,
    };
  }

  /**
   * Reset user state (for testing)
   */
  async resetState(userId: number): Promise<void> {
    await this.lazyEnsureTableExists();
    try {
      await sql`DELETE FROM user_state WHERE user_id = ${userId}`;
    } catch (error) {
      logger.error(`Failed to reset state for user ${userId}:`, error);
    }
  }

  /**
   * Get session duration in minutes
   */
  async getSessionDuration(userId: number): Promise<number> {
    const state = await this.getState(userId);
    const now = new Date();
    return Math.floor((now.getTime() - state.sessionStartedAt.getTime()) / (1000 * 60));
  }

  /**
   * Check if user is in onboarding mode (no API keys)
   */
  async isOnboardingMode(userId: number): Promise<boolean> {
    const state = await this.getState(userId);
    return !state.hasApiKeys;
  }

  /**
   * Update API keys status
   */
  async updateApiKeysStatus(userId: number, hasKeys: boolean): Promise<void> {
    await this.updateState(userId, { hasApiKeys: hasKeys });
  }

  /**
   * Update products count
   */
  async updateProductsCount(userId: number, count: number): Promise<void> {
    await this.updateState(userId, { productsCount: count });
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(userId: number, tier: 'free' | 'basic' | 'pro'): Promise<void> {
    await this.updateState(userId, { subscriptionTier: tier });
  }
}

// Export singleton instance
export const stateManager = new StateManager();
