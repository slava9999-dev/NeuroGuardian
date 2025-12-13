import { UserDoc, ProductDoc, LogEntryDoc, LogType, Marketplace } from '../schemas';
/**
 * Get user by Telegram ID
 */
export declare function getUser(telegramId: number): Promise<UserDoc | null>;
/**
 * Create or update user
 */
export declare function upsertUser(telegramId: number, data: Partial<UserDoc>): Promise<void>;
/**
 * Get users with protection enabled (for Dispatcher)
 */
export declare function getActiveProtectedUsers(): Promise<UserDoc[]>;
/**
 * Update user stats
 */
export declare function updateUserStats(telegramId: number, updates: {
    triggeredToday?: number;
    savedAmount?: number;
    totalProducts?: number;
}): Promise<void>;
/**
 * Get all products for user
 */
export declare function getUserProducts(telegramId: number, marketplace?: Marketplace): Promise<ProductDoc[]>;
/**
 * Get products with monitoring enabled
 */
export declare function getMonitoredProducts(telegramId: number, marketplace?: Marketplace): Promise<ProductDoc[]>;
/**
 * Upsert product
 */
export declare function upsertProduct(telegramId: number, productId: string, data: Omit<ProductDoc, 'id'>): Promise<void>;
/**
 * Batch upsert products
 */
export declare function batchUpsertProducts(telegramId: number, products: Array<Omit<ProductDoc, 'id'> & {
    productId: string;
}>): Promise<void>;
/**
 * Update product status
 */
export declare function updateProductStatus(telegramId: number, productId: string, status: ProductDoc['status'], additionalData?: Partial<ProductDoc>): Promise<void>;
/**
 * Add log entry
 */
export declare function addLogEntry(telegramId: number, type: LogType, title: string, message: string, metadata?: Record<string, unknown>, productId?: string): Promise<string>;
/**
 * Get recent logs for user
 */
export declare function getUserLogs(telegramId: number, limit?: number): Promise<LogEntryDoc[]>;
/**
 * Mark log as read
 */
export declare function markLogAsRead(telegramId: number, logId: string): Promise<void>;
/**
 * Reset daily triggered count (call at midnight)
 */
export declare function resetDailyTriggeredCounts(): Promise<void>;
//# sourceMappingURL=firestore.d.ts.map