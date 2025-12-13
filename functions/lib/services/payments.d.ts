import { type SubscriptionPlan } from '../schemas/models';
interface CreatePaymentParams {
    userId: number;
    planId: SubscriptionPlan;
    returnUrl: string;
    savePaymentMethod?: boolean;
    promoCode?: string;
}
interface PaymentResult {
    success: boolean;
    paymentId?: string;
    confirmationUrl?: string;
    error?: string;
}
interface WebhookEvent {
    type: string;
    event: string;
    object: {
        id: string;
        status: string;
        amount: {
            value: string;
            currency: string;
        };
        payment_method?: {
            type: string;
            id: string;
            saved: boolean;
        };
        metadata?: Record<string, any>;
    };
}
export declare function createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
export declare function handlePaymentWebhook(event: WebhookEvent): Promise<void>;
export declare function processAutoRenewals(): Promise<void>;
export declare function createRefund(transactionId: string, reason?: string): Promise<boolean>;
export {};
//# sourceMappingURL=payments.d.ts.map