// NeuroGUARDIAN — Subscription Service Tests
// Tests for subscription business logic

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionService } from '../../src/api-lib/services/subscription-service';
import type { Subscription, SubscriptionTier } from '../../src/api-lib/types/subscription';

// Mock @vercel/postgres
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

describe('SubscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isActive', () => {
    it('should return true for active trial', async () => {
      const { sql } = await import('@vercel/postgres');
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ is_active: true }],
      } as never);

      const result = await SubscriptionService.isActive(1);

      expect(result).toBe(true);
    });

    it('should return false for expired subscription', async () => {
      const { sql } = await import('@vercel/postgres');
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ is_active: false }],
      } as never);

      const result = await SubscriptionService.isActive(1);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const { sql } = await import('@vercel/postgres');
      vi.mocked(sql).mockRejectedValueOnce(new Error('Database error'));

      const result = await SubscriptionService.isActive(1);

      expect(result).toBe(false);
    });
  });

  describe('getSubscription', () => {
    it('should return subscription for existing user', async () => {
      const { sql } = await import('@vercel/postgres');
      const mockSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'trial',
        tier: 'free',
        trial_started_at: new Date(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        max_products: 10,
        max_accounts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [mockSubscription],
      } as never);

      const result = await SubscriptionService.getSubscription(1);

      expect(result).toEqual(mockSubscription);
    });

    it('should return null for non-existent user', async () => {
      const { sql } = await import('@vercel/postgres');
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [],
      } as never);

      const result = await SubscriptionService.getSubscription(999);

      expect(result).toBeNull();
    });
  });

  describe('checkSubscription', () => {
    it('should return detailed check for active subscription', async () => {
      const { sql } = await import('@vercel/postgres');
      const mockSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'trial',
        tier: 'basic',
        trial_started_at: new Date(),
        trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days remaining
        max_products: 50,
        max_accounts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getSubscription
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [mockSubscription],
      } as never);

      // Mock getCurrentUsage
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ products: 10, accounts: 1 }],
      } as never);

      // Mock isActive
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ is_active: true }],
      } as never);

      const result = await SubscriptionService.checkSubscription(1);

      expect(result.is_active).toBe(true);
      expect(result.status).toBe('trial');
      expect(result.tier).toBe('basic');
      expect(result.days_remaining).toBeGreaterThan(4);
      expect(result.limits.can_add_product).toBe(true);
      expect(result.limits.can_add_account).toBe(false); // Already at limit
    });

    it('should indicate upgrade required when limits reached', async () => {
      const { sql } = await import('@vercel/postgres');
      const mockSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'active',
        tier: 'basic',
        trial_started_at: new Date(),
        trial_ends_at: new Date(),
        max_products: 50,
        max_accounts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getSubscription
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [mockSubscription],
      } as never);

      // Mock getCurrentUsage - at limits
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ products: 50, accounts: 1 }],
      } as never);

      // Mock isActive
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ is_active: true }],
      } as never);

      const result = await SubscriptionService.checkSubscription(1);

      expect(result.limits.can_add_product).toBe(false);
      expect(result.limits.can_add_account).toBe(false);
      expect(result.upgrade_required).toBe(true);
      expect(result.upgrade_reason).toContain('лимит');
    });
  });

  describe('upgrade', () => {
    it('should upgrade subscription to paid tier', async () => {
      const { sql } = await import('@vercel/postgres');

      // Mock getTierConfig
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [
          {
            tier: 'pro',
            max_products: 500,
            max_accounts: 3,
          },
        ],
      } as never);

      // Mock upgrade query
      const upgradedSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'active',
        tier: 'pro',
        trial_started_at: new Date(),
        trial_ends_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        max_products: 500,
        max_accounts: 3,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [upgradedSubscription],
      } as never);

      const result = await SubscriptionService.upgrade(1, 'pro', 'monthly');

      expect(result.tier).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.max_products).toBe(500);
    });
  });

  describe('cancel', () => {
    it('should cancel subscription immediately if requested', async () => {
      const { sql } = await import('@vercel/postgres');

      const cancelledSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'cancelled',
        tier: 'basic',
        trial_started_at: new Date(),
        trial_ends_at: new Date(),
        cancelled_at: new Date(),
        cancellation_reason: 'Too expensive',
        max_products: 50,
        max_accounts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [cancelledSubscription],
      } as never);

      const result = await SubscriptionService.cancel(1, 'Too expensive', true);

      expect(result.status).toBe('cancelled');
      expect(result.cancelled_at).toBeDefined();
      expect(result.cancellation_reason).toBe('Too expensive');
    });

    it('should keep active until period end if not immediate', async () => {
      const { sql } = await import('@vercel/postgres');

      const cancelledSubscription: Subscription = {
        id: 1,
        user_id: 1,
        status: 'active', // Still active until period ends
        tier: 'basic',
        trial_started_at: new Date(),
        trial_ends_at: new Date(),
        cancelled_at: new Date(),
        max_products: 50,
        max_accounts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [cancelledSubscription],
      } as never);

      const result = await SubscriptionService.cancel(1, undefined, false);

      expect(result.status).toBe('active'); // Still active
      expect(result.cancelled_at).toBeDefined();
    });
  });

  describe('getTierConfig', () => {
    it('should return tier configuration', async () => {
      const { sql } = await import('@vercel/postgres');

      const mockTierConfig = {
        tier: 'basic',
        name_ru: 'Базовый',
        price_monthly: 999,
        max_products: 50,
        max_accounts: 1,
        features: ['Feature 1', 'Feature 2'],
      };

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [mockTierConfig],
      } as never);

      const result = await SubscriptionService.getTierConfig('basic');

      expect(result).toEqual(mockTierConfig);
    });

    it('should return null for invalid tier', async () => {
      const { sql } = await import('@vercel/postgres');

      vi.mocked(sql).mockResolvedValueOnce({
        rows: [],
      } as never);

      const result = await SubscriptionService.getTierConfig('invalid' as SubscriptionTier);

      expect(result).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('should record successful payment', async () => {
      const { sql } = await import('@vercel/postgres');

      // Mock getSubscription
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [{ id: 1 }],
      } as never);

      // Mock update subscription
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [],
      } as never);

      // Mock insert payment
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [],
      } as never);

      await expect(
        SubscriptionService.recordPayment(1, 'payment_123', 999, 'yookassa')
      ).resolves.not.toThrow();
    });
  });
});
