// ============================================
// Task Queue Types for Background Jobs
// Uses Vercel KV as storage (Redis-compatible)
// ============================================

/**
 * Task Status Enum
 */
export type TaskStatus =
  | 'pending' // Waiting to be processed
  | 'processing' // Currently being processed
  | 'completed' // Successfully completed
  | 'failed' // Failed after all retries
  | 'cancelled'; // Cancelled by user

/**
 * Task Type Enum - what kind of operation
 */
export type TaskType =
  | 'price_update' // Update prices on marketplace
  | 'bulk_stop_loss' // Set stop-loss for multiple products
  | 'competitor_scan' // Scan competitor prices
  | 'sync_products' // Sync products from marketplace
  | 'send_notification'; // Send Telegram notification

/**
 * Task Priority
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Base Task Interface
 */
export interface Task<T = Record<string, unknown>> {
  id: string; // UUID
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;

  // Owner
  userId: number;

  // Payload
  payload: T;

  // Execution
  attempts: number; // How many times tried
  maxAttempts: number; // Max retry attempts
  lastError?: string; // Last error message

  // Timing
  createdAt: string; // ISO timestamp
  scheduledAt?: string; // When to execute (for delayed tasks)
  startedAt?: string; // When processing started
  completedAt?: string; // When completed/failed

  // Result
  result?: unknown;

  // Progress (for long-running tasks)
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

/**
 * Price Update Task Payload
 */
export interface PriceUpdatePayload {
  updates: Array<{
    productId: string;
    oldPrice: number;
    newPrice: number;
  }>;
  marketplace: 'WB' | 'Ozon';
  changeType: 'absolute' | 'percentage';
  changeValue: number;
}

/**
 * Bulk Stop-Loss Task Payload
 */
export interface BulkStopLossPayload {
  percentage: number; // Stop-loss percentage (5-50)
  productIds?: string[]; // Specific products (or all if empty)
  onlyUnprotected: boolean; // Only products without stop-loss
}

/**
 * Competitor Scan Task Payload
 */
export interface CompetitorScanPayload {
  productIds: string[]; // Products to scan
  keywords?: string[]; // Additional search keywords
}

/**
 * Sync Products Task Payload
 */
export interface SyncProductsPayload {
  marketplace: 'WB' | 'Ozon';
  fullSync: boolean; // Full sync or incremental
}

/**
 * Notification Task Payload
 */
export interface NotificationPayload {
  message: string;
  parseMode?: 'HTML' | 'Markdown';
  silent?: boolean;
}

/**
 * Task Result for completed tasks
 */
export interface TaskResult {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: string[];
}

/**
 * Task Queue Stats
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalToday: number;
}
