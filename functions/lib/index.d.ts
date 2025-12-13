import * as functions from 'firebase-functions';
/**
 * Telegram WebApp authentication
 */
export declare const telegramAuth: functions.HttpsFunction;
/**
 * CloudPayments webhook handler
 */
export declare const paymentWebhook: functions.HttpsFunction;
/**
 * Save API key and sync products
 */
export declare const saveApiKey: functions.HttpsFunction;
/**
 * Get user's products
 */
export declare const getProducts: functions.HttpsFunction;
/**
 * Dispatcher - triggered by Cloud Scheduler every 1-2 minutes
 */
export declare const sentinelDispatcher: functions.CloudFunction<unknown>;
/**
 * Worker - triggered by Cloud Tasks
 */
export declare const sentinelWorker: functions.HttpsFunction;
/**
 * Daily reset - triggered at midnight
 */
export declare const dailyReset: functions.CloudFunction<unknown>;
/**
 * Update user settings (protection, defense mode, etc.)
 */
export declare const updateSettings: functions.HttpsFunction;
/**
 * Update product minPrice
 */
export declare const updateMinPrice: functions.HttpsFunction;
//# sourceMappingURL=index.d.ts.map