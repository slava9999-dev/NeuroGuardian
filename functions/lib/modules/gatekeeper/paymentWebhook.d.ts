export declare const PRICING: {
    readonly basic: {
        readonly monthly: {
            readonly price: 990;
            readonly days: 30;
        };
        readonly quarterly: {
            readonly price: 2490;
            readonly days: 90;
        };
        readonly yearly: {
            readonly price: 7990;
            readonly days: 365;
        };
    };
    readonly pro: {
        readonly monthly: {
            readonly price: 1990;
            readonly days: 30;
        };
        readonly quarterly: {
            readonly price: 4990;
            readonly days: 90;
        };
        readonly yearly: {
            readonly price: 14990;
            readonly days: 365;
        };
    };
};
interface PaymentWebhookPayload {
    TransactionId?: number;
    Amount?: number;
    Currency?: string;
    InvoiceId?: string;
    AccountId?: string;
    Status?: string;
    OperationType?: string;
    Data?: string;
}
/**
 * Validate CloudPayments webhook signature
 */
export declare function validateCloudPaymentsSignature(body: string, signature: string, apiSecret: string): boolean;
/**
 * Handle successful payment webhook
 */
export declare function handlePaymentSuccess(payload: PaymentWebhookPayload): Promise<void>;
/**
 * Handle payment failure webhook
 */
export declare function handlePaymentFailure(payload: PaymentWebhookPayload): Promise<void>;
/**
 * Handle refund webhook
 */
export declare function handleRefund(payload: PaymentWebhookPayload): Promise<void>;
/**
 * Generate payment link for CloudPayments
 */
export declare function generatePaymentLink(telegramId: number, plan: 'basic' | 'pro', period: 'monthly' | 'quarterly' | 'yearly'): string;
export {};
//# sourceMappingURL=paymentWebhook.d.ts.map