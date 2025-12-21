// ============================================
// Task Queue Service
// Manages background job queue using Vercel KV
// ============================================

import { getKVClient } from '../../core/db';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskType, TaskPriority, TaskResult, QueueStats } from './task.types';

// Queue configuration
const QUEUE_KEY_PREFIX = 'task:';
const QUEUE_LIST_KEY = 'task_queue';
const QUEUE_PROCESSING_KEY = 'task_processing';
const QUEUE_COMPLETED_KEY = 'task_completed';
const QUEUE_FAILED_KEY = 'task_failed';

// TTL for completed/failed tasks (7 days)
const COMPLETED_TASK_TTL = 7 * 24 * 60 * 60;

// Default max attempts for retries
const DEFAULT_MAX_ATTEMPTS = 3;

export class TaskQueue {
  private kv = getKVClient();

  /**
   * Add a new task to the queue
   */
  async enqueue<T extends Record<string, unknown>>(
    userId: number,
    type: TaskType,
    payload: T,
    options: {
      priority?: TaskPriority;
      maxAttempts?: number;
      scheduledAt?: Date;
    } = {}
  ): Promise<Task<T>> {
    if (!this.kv) {
      throw new Error('KV client not available');
    }

    const task: Task<T> = {
      id: uuidv4(),
      type,
      status: 'pending',
      priority: options.priority || 'normal',
      userId,
      payload,
      attempts: 0,
      maxAttempts: options.maxAttempts || DEFAULT_MAX_ATTEMPTS,
      createdAt: new Date().toISOString(),
      scheduledAt: options.scheduledAt?.toISOString(),
    };

    // Store task data
    await this.kv.set(`${QUEUE_KEY_PREFIX}${task.id}`, task, {
      ex: COMPLETED_TASK_TTL,
    });

    // Add to queue list (sorted by priority and time)
    const score = this.calculateScore(task as Task);
    await this.kv.zadd(QUEUE_LIST_KEY, { score, member: task.id });

    logger.info('Task enqueued', { taskId: task.id, type, userId });

    return task;
  }

  /**
   * Get next task from queue (for processing)
   */
  async dequeue(): Promise<Task | null> {
    if (!this.kv) return null;

    // Get highest priority task
    const taskIds = await this.kv.zrange(QUEUE_LIST_KEY, 0, 0);
    if (!taskIds || taskIds.length === 0) return null;

    const taskId = taskIds[0] as string;

    // Move from queue to processing
    await this.kv.zrem(QUEUE_LIST_KEY, taskId);
    await this.kv.sadd(QUEUE_PROCESSING_KEY, taskId);

    // Get and update task
    const task = await this.getTask(taskId);
    if (task) {
      task.status = 'processing';
      task.startedAt = new Date().toISOString();
      task.attempts += 1;
      await this.updateTask(task);
    }

    return task;
  }

  /**
   * Get task by ID
   */
  async getTask<T = Record<string, unknown>>(taskId: string): Promise<Task<T> | null> {
    if (!this.kv) return null;

    const task = await this.kv.get<Task<T>>(`${QUEUE_KEY_PREFIX}${taskId}`);
    return task;
  }

  /**
   * Update task data
   */
  async updateTask(task: Task): Promise<void> {
    if (!this.kv) return;

    await this.kv.set(`${QUEUE_KEY_PREFIX}${task.id}`, task, {
      ex: COMPLETED_TASK_TTL,
    });
  }

  /**
   * Mark task as completed
   */
  async complete(taskId: string, result: TaskResult): Promise<void> {
    if (!this.kv) return;

    const task = await this.getTask(taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;

    await this.updateTask(task);

    // Move from processing to completed
    await this.kv.srem(QUEUE_PROCESSING_KEY, taskId);
    await this.kv.sadd(QUEUE_COMPLETED_KEY, taskId);

    logger.info('Task completed', { taskId, userId: task.userId });
  }

  /**
   * Mark task as failed (with optional retry)
   */
  async fail(taskId: string, error: string, retry: boolean = true): Promise<void> {
    if (!this.kv) return;

    const task = await this.getTask(taskId);
    if (!task) return;

    task.lastError = error;

    // Check if should retry
    if (retry && task.attempts < task.maxAttempts) {
      // Re-queue with exponential backoff delay
      const delay = Math.pow(2, task.attempts) * 1000; // 2s, 4s, 8s...
      task.status = 'pending';
      task.scheduledAt = new Date(Date.now() + delay).toISOString();

      await this.updateTask(task);

      // Move back to queue
      await this.kv.srem(QUEUE_PROCESSING_KEY, taskId);
      const score = this.calculateScore(task);
      await this.kv.zadd(QUEUE_LIST_KEY, { score, member: taskId });

      logger.warn('Task will retry', { taskId, attempt: task.attempts, delay });
    } else {
      // Final failure
      task.status = 'failed';
      task.completedAt = new Date().toISOString();

      await this.updateTask(task);

      // Move to failed set
      await this.kv.srem(QUEUE_PROCESSING_KEY, taskId);
      await this.kv.sadd(QUEUE_FAILED_KEY, taskId);

      logger.error('Task failed permanently', new Error(error), { taskId, userId: task.userId });
    }
  }

  /**
   * Update task progress (for long-running tasks)
   */
  async updateProgress(
    taskId: string,
    current: number,
    total: number,
    message?: string
  ): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) return;

    task.progress = { current, total, message };
    await this.updateTask(task);
  }

  /**
   * Get all tasks for a user
   */
  async getUserTasks(userId: number, limit: number = 20): Promise<Task[]> {
    if (!this.kv) return [];

    // Get from all sets
    const [pending, processing, completed, failed] = await Promise.all([
      this.kv.zrange(QUEUE_LIST_KEY, 0, -1),
      this.kv.smembers(QUEUE_PROCESSING_KEY),
      this.kv.smembers(QUEUE_COMPLETED_KEY),
      this.kv.smembers(QUEUE_FAILED_KEY),
    ]);

    const allTaskIds = [
      ...(pending as string[]),
      ...(processing as string[]),
      ...(completed as string[]).slice(0, 50), // Limit history
      ...(failed as string[]).slice(0, 20),
    ];

    const tasks: Task[] = [];
    for (const taskId of allTaskIds) {
      const task = await this.getTask(taskId);
      if (task && task.userId === userId) {
        tasks.push(task);
      }
      if (tasks.length >= limit) break;
    }

    // Sort by createdAt DESC
    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    if (!this.kv) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, totalToday: 0 };
    }

    const [pending, processing, completed, failed] = await Promise.all([
      this.kv.zcard(QUEUE_LIST_KEY),
      this.kv.scard(QUEUE_PROCESSING_KEY),
      this.kv.scard(QUEUE_COMPLETED_KEY),
      this.kv.scard(QUEUE_FAILED_KEY),
    ]);

    return {
      pending: pending || 0,
      processing: processing || 0,
      completed: completed || 0,
      failed: failed || 0,
      totalToday: (pending || 0) + (processing || 0) + (completed || 0) + (failed || 0),
    };
  }

  /**
   * Cancel a pending task
   */
  async cancel(taskId: string, userId: number): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task || task.userId !== userId) return false;
    if (task.status !== 'pending') return false;

    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    await this.updateTask(task);

    await this.kv?.zrem(QUEUE_LIST_KEY, taskId);

    logger.info('Task cancelled', { taskId, userId });
    return true;
  }

  /**
   * Calculate priority score for sorting
   * Lower score = higher priority
   */
  private calculateScore(task: Task): number {
    const priorityScores: Record<TaskPriority, number> = {
      critical: 0,
      high: 1000000,
      normal: 2000000,
      low: 3000000,
    };

    const baseScore = priorityScores[task.priority];
    const timeScore = task.scheduledAt
      ? new Date(task.scheduledAt).getTime()
      : new Date(task.createdAt).getTime();

    return baseScore + (timeScore % 1000000);
  }
}

// Singleton instance
export const taskQueue = new TaskQueue();
