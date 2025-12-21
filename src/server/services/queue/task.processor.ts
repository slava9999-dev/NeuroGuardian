// ============================================
// Task Processor
// Executes background tasks from the queue
// Called by cron job or API endpoint
// ============================================

import { taskQueue } from './task.queue';
import { notificationService } from '../notification/notification.service';
import { productService } from '../product/product.service';
import { logger } from '../../utils/logger';
import type {
  Task,
  TaskResult,
  PriceUpdatePayload,
  BulkStopLossPayload,
  SyncProductsPayload,
  NotificationPayload,
} from './task.types';

// Maximum tasks to process per run (to avoid timeout)
const MAX_TASKS_PER_RUN = 5;

// Task timeout (25 seconds - leaving buffer for Vercel's 30s limit)
const TASK_TIMEOUT = 25000;

export class TaskProcessor {
  /**
   * Process pending tasks from the queue
   * Should be called by cron job every minute
   */
  async processPendingTasks(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
      const task = await taskQueue.dequeue();
      if (!task) break;

      processed++;

      try {
        const result = await this.executeTask(task);

        if (result.success) {
          await taskQueue.complete(task.id, result);
          succeeded++;

          // Send success notification
          await notificationService.sendTaskCompleted(task.userId, task.type, result);
        } else {
          await taskQueue.fail(task.id, result.message, true);
          failed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await taskQueue.fail(task.id, errorMessage, true);
        failed++;

        logger.error('Task execution error', error, { taskId: task.id });
      }
    }

    logger.info('Task processor run complete', { processed, succeeded, failed });

    return { processed, succeeded, failed };
  }

  /**
   * Execute a single task based on its type
   */
  private async executeTask(task: Task): Promise<TaskResult> {
    // Wrap execution with timeout
    const timeoutPromise = new Promise<TaskResult>((_, reject) =>
      setTimeout(() => reject(new Error('Task timeout exceeded')), TASK_TIMEOUT)
    );

    const executionPromise = this.executeTaskByType(task);

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Route task to appropriate handler
   */
  private async executeTaskByType(task: Task): Promise<TaskResult> {
    // Cast payload via unknown for type safety
    const payload = task.payload as unknown;

    switch (task.type) {
      case 'price_update':
        return this.executePriceUpdate({ ...task, payload: payload as PriceUpdatePayload });

      case 'bulk_stop_loss':
        return this.executeBulkStopLoss({ ...task, payload: payload as BulkStopLossPayload });

      case 'sync_products':
        return this.executeSyncProducts({ ...task, payload: payload as SyncProductsPayload });

      case 'send_notification':
        return this.executeSendNotification({ ...task, payload: payload as NotificationPayload });

      case 'competitor_scan':
        // TODO: Implement competitor scanning
        return { success: false, message: 'Competitor scan not implemented yet' };

      default:
        return { success: false, message: `Unknown task type: ${task.type}` };
    }
  }

  /**
   * Execute price update task
   */
  private async executePriceUpdate(task: Task<PriceUpdatePayload>): Promise<TaskResult> {
    const { updates, marketplace } = task.payload;

    if (!updates || updates.length === 0) {
      return { success: false, message: 'No updates provided' };
    }

    logger.info('Executing price update', {
      taskId: task.id,
      userId: task.userId,
      count: updates.length,
    });

    // Update progress
    await taskQueue.updateProgress(task.id, 0, updates.length, 'Starting price update...');

    try {
      // Convert to productService format
      const priceUpdates = updates.map(u => ({
        productId: u.productId,
        newPrice: u.newPrice,
      }));

      const result = await productService.updateMarketplacePrice(task.userId, priceUpdates);

      if (result.success) {
        await taskQueue.updateProgress(task.id, updates.length, updates.length, 'Complete!');

        return {
          success: true,
          message: `Successfully updated ${result.count} prices on ${marketplace}`,
          data: { updatedCount: result.count },
        };
      } else {
        return {
          success: false,
          message: result.error || 'Failed to update prices',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Price update failed',
      };
    }
  }

  /**
   * Execute bulk stop-loss task
   */
  private async executeBulkStopLoss(task: Task<BulkStopLossPayload>): Promise<TaskResult> {
    const { percentage, productIds, onlyUnprotected } = task.payload;

    logger.info('Executing bulk stop-loss', {
      taskId: task.id,
      userId: task.userId,
      percentage,
    });

    try {
      // Get products
      const allProducts = await productService.getProductsByUserId(task.userId);

      // Filter products
      let products = allProducts;
      if (productIds && productIds.length > 0) {
        products = allProducts.filter(p => productIds.includes(p.product_id));
      }
      if (onlyUnprotected) {
        products = products.filter(p => !p.min_price || p.min_price === 0);
      }

      await taskQueue.updateProgress(task.id, 0, products.length, 'Setting stop-loss...');

      let updated = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const minPrice = Math.round(product.current_price * (1 - percentage / 100));

        if (minPrice > 0) {
          await productService.updateMinPrice(task.userId, product.product_id, minPrice);
          updated++;
        }

        // Update progress every 10 items
        if (i % 10 === 0) {
          await taskQueue.updateProgress(task.id, i, products.length);
        }
      }

      await taskQueue.updateProgress(task.id, products.length, products.length, 'Complete!');

      return {
        success: true,
        message: `Stop-loss set for ${updated} products at -${percentage}%`,
        data: { updatedCount: updated },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Bulk stop-loss failed',
      };
    }
  }

  /**
   * Execute product sync task
   */
  private async executeSyncProducts(task: Task<SyncProductsPayload>): Promise<TaskResult> {
    // TODO: Implement product sync via WB/Ozon API
    // This would call the existing sync-products logic from api/index.ts

    logger.info('Sync products task', { taskId: task.id, userId: task.userId });

    return {
      success: false,
      message: 'Product sync via queue not implemented yet. Use direct API call.',
    };
  }

  /**
   * Execute send notification task
   */
  private async executeSendNotification(task: Task<NotificationPayload>): Promise<TaskResult> {
    const { message, parseMode, silent } = task.payload;

    try {
      const sent = await notificationService.send(task.userId, message, { parseMode, silent });

      return {
        success: sent,
        message: sent ? 'Notification sent' : 'Failed to send notification',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Notification failed',
      };
    }
  }
}

// Singleton instance
export const taskProcessor = new TaskProcessor();
