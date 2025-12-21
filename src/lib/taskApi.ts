// ============================================
// Task Queue API Client
// Frontend client for background tasks
// ============================================

import { getInitData } from './telegram';

const API_BASE = '/api';

// Task types matching backend
export type TaskType = 'price_update' | 'bulk_stop_loss' | 'sync_products';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskProgress {
  current: number;
  total: number;
  message?: string;
}

export interface TaskInfo {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  progress?: TaskProgress;
  createdAt: string;
  completedAt?: string;
  lastError?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalToday: number;
}

export interface TasksResponse {
  success: boolean;
  tasks: TaskInfo[];
  stats: QueueStats;
}

export interface EnqueueResponse {
  success: boolean;
  message: string;
  task?: {
    id: string;
    type: TaskType;
    status: TaskStatus;
  };
}

export const taskApi = {
  /**
   * Get user's tasks and queue stats
   */
  getTasks: async (): Promise<TasksResponse> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=tasks`, {
        headers: {
          'X-Init-Data': initData || '',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get tasks:', error);
      return {
        success: false,
        tasks: [],
        stats: { pending: 0, processing: 0, completed: 0, failed: 0, totalToday: 0 },
      };
    }
  },

  /**
   * Enqueue a new background task
   */
  enqueue: async (
    taskType: TaskType,
    payload: Record<string, unknown>,
    priority: TaskPriority = 'normal'
  ): Promise<EnqueueResponse> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=task-enqueue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          taskType,
          payload,
          priority,
          initData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to enqueue task:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Cancel a pending task
   */
  cancel: async (taskId: string): Promise<{ success: boolean; message: string }> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=task-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          taskId,
          initData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to cancel task:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Helper: Enqueue bulk stop-loss task
   */
  enqueueBulkStopLoss: async (
    percentage: number,
    options: { productIds?: string[]; onlyUnprotected?: boolean } = {}
  ): Promise<EnqueueResponse> => {
    return taskApi.enqueue('bulk_stop_loss', {
      percentage,
      productIds: options.productIds,
      onlyUnprotected: options.onlyUnprotected ?? true,
    });
  },

  /**
   * Helper: Enqueue price update task
   */
  enqueuePriceUpdate: async (
    updates: Array<{ productId: string; oldPrice: number; newPrice: number }>,
    marketplace: 'WB' | 'Ozon' = 'WB'
  ): Promise<EnqueueResponse> => {
    return taskApi.enqueue('price_update', {
      updates,
      marketplace,
      changeType: 'absolute',
      changeValue: 0,
    });
  },
};

export default taskApi;
