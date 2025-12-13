/**
 * Store API key in Secret Manager
 * @returns Reference to the secret (for storing in Firestore)
 */
export declare function storeApiKey(telegramId: number, marketplace: 'WB' | 'Ozon', apiKey: string, clientId?: string): Promise<string>;
/**
 * Retrieve API key from Secret Manager
 */
export declare function getApiKey(telegramId: number, marketplace: 'WB' | 'Ozon'): Promise<{
    apiKey: string;
    clientId?: string;
} | null>;
/**
 * Delete API key from Secret Manager
 */
export declare function deleteApiKey(telegramId: number, marketplace: 'WB' | 'Ozon'): Promise<void>;
/**
 * Check if API key exists for a user
 */
export declare function hasApiKey(telegramId: number, marketplace: 'WB' | 'Ozon'): Promise<boolean>;
//# sourceMappingURL=secretManager.d.ts.map