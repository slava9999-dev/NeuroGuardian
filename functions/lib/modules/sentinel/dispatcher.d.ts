/**
 * Main dispatcher function
 * Called by Cloud Scheduler every 1-2 minutes
 */
export declare function dispatch(): Promise<{
    totalUsers: number;
    tasksCreated: number;
    errors: number;
}>;
/**
 * Create a high-priority task (e.g., when user manually triggers check)
 */
export declare function createUrgentCheck(userId: number): Promise<void>;
/**
 * Create tasks for specific products only
 */
export declare function createProductCheck(userId: number, productIds: string[]): Promise<void>;
//# sourceMappingURL=dispatcher.d.ts.map