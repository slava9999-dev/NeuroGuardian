import { Marketplace, DefenseActionResult } from '../../schemas';
interface DefenseAlert {
    type: 'defense_triggered';
    productTitle: string;
    vendorCode: string;
    oldPrice: number;
    minPrice: number;
    action: DefenseActionResult['action'];
    savedAmount: number;
    marketplace: Marketplace;
}
interface SyncAlert {
    type: 'sync_complete';
    marketplace: Marketplace;
    productsCount: number;
    newProducts: number;
}
interface ErrorAlert {
    type: 'error';
    message: string;
    context?: string;
}
type AlertPayload = DefenseAlert | SyncAlert | ErrorAlert;
/**
 * Send Telegram notification to user
 */
export declare function sendTelegramAlert(telegramId: number, payload: AlertPayload): Promise<boolean>;
/**
 * Send daily summary
 */
export declare function sendDailySummary(telegramId: number, stats: {
    totalProducts: number;
    protectedProducts: number;
    triggeredToday: number;
    savedToday: number;
    totalSaved: number;
}): Promise<boolean>;
export {};
//# sourceMappingURL=alerting.d.ts.map