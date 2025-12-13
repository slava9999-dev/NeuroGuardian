import { UserDoc } from '../../schemas';
export interface SubscriptionStatus {
    isActive: boolean;
    expiresAt: Date | null;
    plan: 'trial' | 'basic' | 'pro' | null;
    daysLeft: number | null;
}
/**
 * Check if user has active subscription
 */
export declare function checkSubscription(telegramId: number): Promise<SubscriptionStatus>;
/**
 * Middleware to require active subscription
 * Returns user data if subscription is active, throws error otherwise
 */
export declare function requireSubscription(telegramId: number): Promise<UserDoc>;
/**
 * Grant trial subscription to new user
 */
export declare function grantTrialSubscription(telegramId: number, days?: number): Promise<void>;
/**
 * Extend subscription after successful payment
 */
export declare function extendSubscription(telegramId: number, plan: 'basic' | 'pro', days: number): Promise<void>;
/**
 * Cancel subscription (e.g., on refund)
 */
export declare function cancelSubscription(telegramId: number): Promise<void>;
//# sourceMappingURL=subscriptionMiddleware.d.ts.map