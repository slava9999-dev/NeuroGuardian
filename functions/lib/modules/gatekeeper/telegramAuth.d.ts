import { TelegramInitData } from '../../schemas';
/**
 * Validate Telegram WebApp initData using HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export declare function validateInitData(initData: string): boolean;
/**
 * Parse and validate initData, returning typed user data
 */
export declare function parseAndValidateInitData(initData: string): TelegramInitData | null;
/**
 * Extract user ID from initData (for quick checks)
 */
export declare function extractUserId(initData: string): number | null;
//# sourceMappingURL=telegramAuth.d.ts.map