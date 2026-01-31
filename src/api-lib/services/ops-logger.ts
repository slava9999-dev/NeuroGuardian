// ============================================
// NeuroGUARDIAN — Operations Logger Service
// Enhanced logging for ops_events and ops_audit tables
// ============================================

import { sql } from './database.js';
import { logger } from '../lib/logger.js';

// ============================================
// TYPES
// ============================================

export type EventType =
  | 'price_check'
  | 'price_update_started'
  | 'price_update_completed'
  | 'price_update_failed'
  | 'price_alert'
  | 'price_protection_run'
  | 'sync_products'
  | 'sync_completed'
  | 'sentinel_check'
  | 'sentinel_alert'
  | 'sentinel_action'
  | 'agent_action'
  | 'alert_acknowledged'
  | 'notification_sent'
  | 'system_error'
  | 'auth_failed'
  | 'n8n_webhook'
  | 'n8n_trigger_success'
  | 'n8n_trigger_error';

export type EventSource =
  | 'agent'
  | 'sentinel'
  | 'price_protection'
  | 'n8n'
  | 'manual'
  | 'system'
  | 'marketplace_service';

export type ActorType = 'user' | 'agent' | 'system' | 'n8n' | 'sentinel';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'execute'
  | 'login'
  | 'price_change'
  | 'api_call'
  | 'settings_change';

export type ResourceType =
  | 'product'
  | 'price'
  | 'settings'
  | 'user'
  | 'api_key'
  | 'subscription'
  | 'price_rule';

export interface OpsEvent {
  eventType: EventType;
  eventSource: EventSource;
  userId?: string | number;
  productId?: string | number;
  payload?: Record<string, unknown>;
  oldPrice?: number;
  newPrice?: number;
  competitorPrice?: number;
  actionTaken?: string;
  marketplace?: 'wildberries' | 'ozon';
  externalId?: string;
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
}

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  success?: boolean;
  errorMessage?: string;
}

// ============================================
// OPS EVENTS LOGGER
// ============================================

/**
 * Log an operational event to ops_events table
 * TEMPORARILY DISABLED - NeonDbError ECONNRESET issues
 */
export async function logOpsEvent(event: OpsEvent): Promise<number | null> {
  // TEMP: Skip DB logging to avoid ECONNRESET errors
  // Just log to console for now
  // Just log to console for now
  logger.info(
    `[OpsLog] ${event.eventType}: ${event.eventSource} - ${JSON.stringify(event.payload || {}).substring(0, 100)}`
  );
  return null;

  try {
    const userId = event.userId ?? null;
    const productId = event.productId ?? null;
    const payload = JSON.stringify(event.payload || {});
    const oldPrice = event.oldPrice ?? null;
    const newPrice = event.newPrice ?? null;
    const competitorPrice = event.competitorPrice ?? null;
    const actionTaken = event.actionTaken ?? null;
    const marketplace = event.marketplace ?? null;
    const externalId = event.externalId ?? null;
    const severity = event.severity ?? 'INFO';
    const entityType = event.entityType ?? null;
    const entityId = event.entityId ?? null;

    const result = await sql`
      INSERT INTO ops_events (
        event_type, event_source, user_id, product_id,
        payload, old_price, new_price, competitor_price,
        action_taken, marketplace, external_id, severity,
        entity_type, entity_id
      ) VALUES (
        ${event.eventType}, ${event.eventSource}, ${userId}, ${productId},
        ${payload}, ${oldPrice}, ${newPrice}, ${competitorPrice},
        ${actionTaken}, ${marketplace}, ${externalId}, ${severity},
        ${entityType}, ${entityId}
      )
      RETURNING id
    `;

    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('Failed to log ops event:', error);
    // Don't throw - logging should not break main flow
    return null;
  }
}

/**
 * Mark an event as processed
 */
export async function markEventProcessed(
  eventId: number,
  result: Record<string, unknown>
): Promise<void> {
  try {
    const resultJson = JSON.stringify(result);
    await sql`
      UPDATE ops_events 
      SET processed_at = NOW(), processing_result = ${resultJson}
      WHERE id = ${eventId}
    `;
  } catch (error) {
    logger.error('Failed to mark event processed:', error);
  }
}

/**
 * Get pending events for processing
 */
export async function getPendingEvents(
  eventType?: EventType,
  limit = 100
): Promise<Array<{ id: number; payload: Record<string, unknown>; created_at: Date }>> {
  try {
    // Note: sql template literals logic for optional params
    const type = eventType || null;

    // We used to do ($1::text IS NULL OR event_type = $1)
    // With tagged templates we pass the value.
    const result = await sql`
      SELECT id, payload, created_at 
      FROM ops_events 
      WHERE processed_at IS NULL
        AND (${type}::text IS NULL OR event_type = ${type})
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return result.rows as Array<{ id: number; payload: Record<string, unknown>; created_at: Date }>;
  } catch (error) {
    logger.error('Failed to get pending events:', error);
    return [];
  }
}

/**
 * Get events for a user (for dashboard)
 */
export async function getUserEvents(
  userId: string | number,
  hours = 24,
  limit = 50
): Promise<Array<Record<string, unknown>>> {
  try {
    // Calculate timestamp for interval manually to be safe with interpolation
    // Or use interval syntax parameterization if supported.
    // simpler: WHERE created_at > NOW() - make_interval(hours => ${hours})

    const result = await sql`
      SELECT event_type, event_source, payload, 
             old_price, new_price, action_taken, 
             marketplace, external_id, created_at
      FROM ops_events 
      WHERE user_id = ${userId} 
        AND created_at > NOW() - (${hours} || ' hours')::interval
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    logger.error('Failed to get user events:', error);
    return [];
  }
}

/**
 * Get event statistics for dashboard
 */
export async function getEventStats(
  userId?: string | number,
  hours = 24
): Promise<Record<string, number>> {
  try {
    const uid = userId || null;

    const result = await sql`
      SELECT event_type, COUNT(*) as count
      FROM ops_events 
      WHERE created_at > NOW() - (${hours} || ' hours')::interval
        AND (${uid}::text IS NULL OR user_id = ${uid})
      GROUP BY event_type
    `;

    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.event_type] = parseInt(row.count);
    }
    return stats;
  } catch (error) {
    logger.error('Failed to get event stats:', error);
    return {};
  }
}

// ... (existing getEventStats)

/**
 * Get system events (for admin dashboard logs)
 */
export async function getSystemEvents(
  limit = 100,
  filters?: { eventType?: string; source?: string; userId?: string | number }
): Promise<Array<Record<string, unknown>>> {
  try {
    const fType = filters?.eventType || null;
    const fSource = filters?.source || null;
    const fUser = filters?.userId || null;

    const result = await sql`
      SELECT *
      FROM ops_events 
      WHERE (${fType}::text IS NULL OR event_type = ${fType})
        AND (${fSource}::text IS NULL OR event_source = ${fSource})
        AND (${fUser}::text IS NULL OR user_id = ${fUser})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    logger.error('Failed to get system events:', error);
    return [];
  }
}

// ============================================
// AUDIT LOGGER
// ============================================

/**
 * Log an audit entry to ops_audit table
 * This is an immutable record - cannot be updated or deleted
 */
export async function logAudit(entry: AuditEntry): Promise<number | null> {
  try {
    const actorId = entry.actorId ?? null;
    const resourceId = entry.resourceId ?? null;
    const oldValue = entry.oldValue ? JSON.stringify(entry.oldValue) : null;
    const newValue = entry.newValue ? JSON.stringify(entry.newValue) : null;
    const metadata = JSON.stringify(entry.metadata || {});
    const ipAddress = entry.ipAddress ?? null;
    const userAgent = entry.userAgent ?? null;
    const requestId = entry.requestId ?? null;
    const success = entry.success !== false; // Default to true
    const errorMessage = entry.errorMessage ?? null;

    const result = await sql`
      INSERT INTO ops_audit (
        actor_type, actor_id, action, resource_type, resource_id,
        old_value, new_value, metadata,
        ip_address, user_agent, request_id,
        success, error_message
      ) VALUES (
        ${entry.actorType}, ${actorId}, ${entry.action}, ${entry.resourceType}, ${resourceId},
        ${oldValue}, ${newValue}, ${metadata},
        ${ipAddress}, ${userAgent}, ${requestId},
        ${success}, ${errorMessage}
      )
      RETURNING id
    `;

    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('Failed to log audit entry:', error);
    // Don't throw - audit logging should not break main flow
    return null;
  }
}

/**
 * Log a price change with full audit trail
 */
export async function logPriceChange(params: {
  actorType: ActorType;
  actorId?: string;
  productId: string;
  marketplace: 'wildberries' | 'ozon';
  oldPrice: number;
  newPrice: number;
  reason: string;
  requestId?: string;
}): Promise<void> {
  await logAudit({
    actorType: params.actorType,
    actorId: params.actorId,
    action: 'price_change',
    resourceType: 'price',
    resourceId: params.productId,
    oldValue: { price: params.oldPrice, marketplace: params.marketplace },
    newValue: { price: params.newPrice, marketplace: params.marketplace },
    metadata: { reason: params.reason },
    requestId: params.requestId,
    success: true,
  });

  await logOpsEvent({
    eventType: 'price_update_completed',
    eventSource: params.actorType === 'agent' ? 'agent' : 'system',
    oldPrice: params.oldPrice,
    newPrice: params.newPrice,
    actionTaken: 'price_updated',
    marketplace: params.marketplace,
    externalId: params.productId,
    payload: { reason: params.reason },
  });
}

/**
 * Get audit trail for a resource
 */
export async function getAuditTrail(
  resourceType: ResourceType,
  resourceId: string,
  limit = 50
): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await sql`
      SELECT actor_type, actor_id, action, 
             old_value, new_value, metadata,
             success, error_message, created_at
      FROM ops_audit 
      WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    logger.error('Failed to get audit trail:', error);
    return [];
  }
}

/**
 * Get recent audit entries (for admin dashboard)
 */
export async function getRecentAuditEntries(limit = 100): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await sql`
      SELECT actor_type, actor_id, action, 
             resource_type, resource_id,
             success, created_at
      FROM ops_audit 
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    logger.error('Failed to get recent audit entries:', error);
    return [];
  }
}
