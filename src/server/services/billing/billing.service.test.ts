import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
  });

  describe('createPayment', () => {
    it('should return a placeholder payment response', async () => {
      const result = await billingService.createPayment(1, 1000, 'Test Subscription');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('confirmation_url');
      expect(result.id).toBe('test_payment_id');
    });
  });

  describe('checkSubscription', () => {
    it('should currently always return true', async () => {
      const result = await billingService.checkSubscription(1);
      expect(result).toBe(true);
    });
  });
});
