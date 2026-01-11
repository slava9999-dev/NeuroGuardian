// ============================================
// NeuroGUARDIAN — State Manager
// Manages user state across sessions
// Enables contextual responses and pending actions
// Version: 5.0.0 | Date: January 2026
// ============================================

import type { UserState } from '../../core/types/agent.types.js';

/**
 * State persistence interface
 * Can be implemented by PostgreSQL, Redis, or in-memory store
 */
interface StateStore {
  get(userId: number): Promise<UserState | null>;
  set(userId: number, state: UserState): Promise<void>;
  update(userId: number, partial: Partial<UserState>): Promise<void>;
}

/**
 * Default state for new users
 */
function createDefaultState(userId: number): UserState {
  const now = new Date();
  return {
    userId,
    marketplace: null,
    hasWbKey: false,
    hasOzonKey: false,
    productsCount: 0,
    subscriptionTier: 'free',
    lastMentionedProducts: [],
    lastActiveAt: now,
    sessionStartedAt: now,
    totalQueries: 0,
  };
}

/**
 * PostgreSQL-based state store
 */
class PostgresStateStore implements StateStore {
  async get(userId: number): Promise<UserState | null> {
    const { sql } = await import('../../api-lib/services/database.js');

    const result = await sql`
      SELECT state_data FROM user_state WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].state_data as UserState;
  }

  async set(userId: number, state: UserState): Promise<void> {
    const { sql } = await import('../../api-lib/services/database.js');

    await sql`
      INSERT INTO user_state (user_id, state_data, updated_at)
      VALUES (${userId}, ${JSON.stringify(state)}, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET state_data = ${JSON.stringify(state)}, updated_at = NOW()
    `;
  }

  async update(userId: number, partial: Partial<UserState>): Promise<void> {
    const current = await this.get(userId);
    const updated = current
      ? { ...current, ...partial, lastActiveAt: new Date() }
      : { ...createDefaultState(userId), ...partial };
    await this.set(userId, updated);
  }
}

/**
 * In-memory state store (for testing/development)
 */
class MemoryStateStore implements StateStore {
  private states: Map<number, UserState> = new Map();

  async get(userId: number): Promise<UserState | null> {
    return this.states.get(userId) || null;
  }

  async set(userId: number, state: UserState): Promise<void> {
    this.states.set(userId, state);
  }

  async update(userId: number, partial: Partial<UserState>): Promise<void> {
    const current = await this.get(userId);
    const updated = current
      ? { ...current, ...partial, lastActiveAt: new Date() }
      : { ...createDefaultState(userId), ...partial };
    this.states.set(userId, updated);
  }
}

/**
 * State Manager - Main class for managing user state
 *
 * Responsibilities:
 * - Load/save user state
 * - Track pending actions
 * - Track awaiting input
 * - Manage context (last mentioned products, etc.)
 */
export class StateManager {
  private store: StateStore;

  constructor(store?: StateStore) {
    // Use PostgreSQL in production, memory in development
    this.store =
      store ||
      (process.env.NODE_ENV === 'test' ? new MemoryStateStore() : new PostgresStateStore());
  }

  /**
   * Get current state for a user
   * Creates default state if not exists
   */
  async getState(userId: number): Promise<UserState> {
    const state = await this.store.get(userId);
    if (state) {
      return state;
    }

    // Create default state and enrich with user data
    const defaultState = await this.enrichWithUserData(userId, createDefaultState(userId));
    await this.store.set(userId, defaultState);
    return defaultState;
  }

  /**
   * Update state partially
   */
  async updateState(userId: number, partial: Partial<UserState>): Promise<void> {
    await this.store.update(userId, partial);
  }

  /**
   * Set a pending action that requires user confirmation
   */
  async setPendingAction(
    userId: number,
    action: NonNullable<UserState['pendingAction']>
  ): Promise<void> {
    await this.store.update(userId, {
      pendingAction: { ...action, createdAt: new Date() },
    });
  }

  /**
   * Clear pending action after confirmation or rejection
   */
  async clearPendingAction(userId: number): Promise<void> {
    await this.store.update(userId, { pendingAction: undefined });
  }

  /**
   * Set awaiting input (agent asked a question, waiting for answer)
   */
  async setAwaitingInput(
    userId: number,
    type: NonNullable<UserState['awaitingInput']>['type'],
    question: string,
    forProductId?: string
  ): Promise<void> {
    await this.store.update(userId, {
      awaitingInput: { type, question, forProductId, createdAt: new Date() },
    });
  }

  /**
   * Clear awaiting input after receiving answer
   */
  async clearAwaitingInput(userId: number): Promise<void> {
    await this.store.update(userId, { awaitingInput: undefined });
  }

  /**
   * Track mentioned products for context
   */
  async trackMentionedProducts(userId: number, productIds: string[]): Promise<void> {
    const state = await this.getState(userId);
    const updated = [...productIds, ...state.lastMentionedProducts].slice(0, 5);
    await this.store.update(userId, { lastMentionedProducts: updated });
  }

  /**
   * Increment query counter and update last active
   */
  async recordQuery(userId: number, query: string): Promise<void> {
    const state = await this.getState(userId);
    await this.store.update(userId, {
      totalQueries: state.totalQueries + 1,
      lastQuery: query,
      lastActiveAt: new Date(),
    });
  }

  /**
   * Check if user has an expired pending action (older than 10 minutes)
   */
  async cleanupExpiredState(userId: number): Promise<void> {
    const state = await this.getState(userId);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const updates: Partial<UserState> = {};

    if (state.pendingAction && new Date(state.pendingAction.createdAt).getTime() < tenMinutesAgo) {
      updates.pendingAction = undefined;
    }

    if (state.awaitingInput && new Date(state.awaitingInput.createdAt).getTime() < tenMinutesAgo) {
      updates.awaitingInput = undefined;
    }

    if (Object.keys(updates).length > 0) {
      await this.store.update(userId, updates);
    }
  }

  /**
   * Enrich state with user data from database
   */
  private async enrichWithUserData(userId: number, state: UserState): Promise<UserState> {
    try {
      const { getUserById, getProductsByUserId } =
        await import('../../api-lib/services/database.js');

      const user = await getUserById(userId);
      if (user) {
        state.hasWbKey = !!user.api_key_wb;
        state.hasOzonKey = !!user.api_key_ozon;
        state.subscriptionTier =
          ((user as { subscription_tier?: string }).subscription_tier as
            | 'free'
            | 'basic'
            | 'pro') ?? 'free';

        if (state.hasWbKey && state.hasOzonKey) {
          state.marketplace = 'both';
        } else if (state.hasWbKey) {
          state.marketplace = 'WB';
        } else if (state.hasOzonKey) {
          state.marketplace = 'Ozon';
        }
      }

      const products = await getProductsByUserId(userId);
      state.productsCount = products.length;
    } catch (error) {
      console.warn('[StateManager] Failed to enrich state:', error);
    }

    return state;
  }
}

// Singleton instance
export const stateManager = new StateManager();
