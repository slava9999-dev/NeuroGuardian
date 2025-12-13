import { WorkerTaskPayload } from '../../schemas';
interface WorkerResult {
    userId: number;
    productsChecked: number;
    defensesTriggered: number;
    errors: number;
    duration: number;
}
/**
 * Main worker function
 * Called by Cloud Tasks for each user
 */
export declare function processUser(payload: WorkerTaskPayload): Promise<WorkerResult>;
export {};
//# sourceMappingURL=worker.d.ts.map