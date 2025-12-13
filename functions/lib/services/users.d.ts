import { type User, type LogEntry, checkPlanLimits } from '../schemas/models';
interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
}
export declare function getOrCreateUser(telegramUser: TelegramUser): Promise<User>;
export declare function getUserById(telegramId: number): Promise<User | null>;
export declare function getUserWithStatus(telegramId: number): Promise<{
    user: User;
    isActive: boolean;
    daysLeft: number | null;
    limits: ReturnType<typeof checkPlanLimits>;
} | null>;
export declare function updateUserSettings(telegramId: number, settings: Partial<Pick<User, 'protectionEnabled' | 'defenseMode' | 'alertsEnabled' | 'emailForAlerts' | 'autoRenew'>>): Promise<boolean>;
export declare function checkExpiredSubscriptions(): Promise<void>;
export declare function applyReferralCode(userId: number, referralCode: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getUserReferralStats(userId: number): Promise<{
    code: string;
    totalReferrals: number;
    activeReferrals: number;
    totalEarned: number;
    link: string;
} | null>;
export declare function updateUserStats(userId: number, stats: Partial<Pick<User, 'totalProducts' | 'protectedProducts' | 'triggeredToday' | 'triggeredAllTime' | 'savedAmount'>>): Promise<void>;
export declare function resetDailyStats(): Promise<void>;
export declare function createLogEntry(userId: number, entry: Partial<LogEntry>): Promise<string>;
export declare function getUserLogs(userId: number, limit?: number): Promise<LogEntry[]>;
export declare function markLogsAsRead(userId: number): Promise<void>;
export {};
//# sourceMappingURL=users.d.ts.map