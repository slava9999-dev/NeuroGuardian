/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../../utils/logger';

export class BillingService {
  /*
   * Placeholder for billing logic.
   * Future implementation will include:
   * - Creating payments (YooKassa)
   * - Handling webhooks
   * - Managing subscriptions
   * - Checking balances
   */

  async createPayment(userId: number, amount: number, _description: string) {
    // TODO: Move logic from api/index.ts
    logger.info('Create payment requested', { userId, amount });
    return { id: 'test_payment_id', confirmation_url: 'https://...' };
  }

  async processWebhook(event: any) {
    // TODO: Move logic from api/index.ts
    logger.info('Payment webhook received', { eventId: event.id });
  }

  async checkSubscription(_userId: number): Promise<boolean> {
    // Currently handled in UserService, but might move here
    return true;
  }
}

export const billingService = new BillingService();
