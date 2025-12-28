import { sql } from '@vercel/postgres';

export type OpsSeverity = 'info' | 'warning' | 'error' | 'critical';
export type OpsEntityType = 'user' | 'product' | 'system' | 'n8n' | 'security' | 'integration';

export interface OpsEventPayload {
  [key: string]: any;
}

export interface OpsEventInput {
  eventType: string;
  severity: OpsSeverity;
  entityType: OpsEntityType;
  entityId?: string;
  payload?: OpsEventPayload;
}

export interface OpsAuditInput {
  actorId?: number;
  actorRole?: string;
  action: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
}

export class OpsLogger {
  /**
   * Log a system event to the event bus (ops_events table)
   */
  static async logEvent(input: OpsEventInput) {
    try {
      // Basic PII masking could be added here if needed,
      // but we assume caller handles sensitive data for now or we rely on DB policies.
      const payload = JSON.stringify(input.payload || {});

      await sql`
        INSERT INTO ops_events (event_type, severity, entity_type, entity_id, payload)
        VALUES (
          ${input.eventType}, 
          ${input.severity}, 
          ${input.entityType}, 
          ${input.entityId || null}, 
          ${payload}::jsonb
        )
      `;
    } catch (error) {
      console.error('Failed to log ops event:', error);
      // Fail-safe: don't crash main thread if logger fails
    }
  }

  /**
   * Log an operator action to the audit log (ops_audit table)
   */
  static async logAudit(input: OpsAuditInput) {
    try {
      const details = JSON.stringify(input.details || {});

      await sql`
        INSERT INTO ops_audit (actor_id, actor_role, action, target_id, details, ip_address)
        VALUES (
          ${input.actorId || null}, 
          ${input.actorRole || 'system'}, 
          ${input.action}, 
          ${input.targetId || null}, 
          ${details}::jsonb,
          ${input.ipAddress || null}
        )
      `;
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  /**
   * Retrieve recent events for the dashboard feed
   */
  /**
   * Retrieve recent events with optional filtering
   */
  static async getEvents(options: { limit?: number; severity?: string; entityType?: string } = {}) {
    const limit = options.limit || 50;
    const severity = options.severity || null;
    const entityType = options.entityType || null;

    const result = await sql`
      SELECT * FROM ops_events 
      WHERE (${severity}::text IS NULL OR severity = ${severity})
      AND (${entityType}::text IS NULL OR entity_type = ${entityType})
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
    return result.rows;
  }

  // Alias for backward compatibility
  static async getRecentEvents(limit = 50) {
    return this.getEvents({ limit });
  }

  /**
   * Retrieve audit logs with optional filters
   */
  static async getAuditLogs(limit = 50, actorId?: number) {
    if (actorId) {
      const result = await sql`
        SELECT * FROM ops_audit 
        WHERE actor_id = ${actorId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `;
      return result.rows;
    }
    const result = await sql`
      SELECT * FROM ops_audit 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
    return result.rows;
  }
}
