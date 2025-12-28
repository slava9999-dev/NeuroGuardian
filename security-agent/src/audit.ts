/**
 * ============================================
 * Security Agent - Audit Logger SDK
 * ============================================
 * AU-1: Every action with prices, stocks, API keys logged
 * AU-2: Structure: { event, userId, timestamp, ip, before, after, signature }
 * AU-3: HMAC-SHA256 signature for each log
 * AU-4: Dual storage: ClickHouse + S3
 * AU-5: Immutable - attempts to modify trigger P0 incident
 * ============================================
 */

import { createHmac, randomUUID } from 'crypto';
import {
  AuditEvent,
  AuditEventSchema,
  AuditLogEntry,
  AuditQueryOptions,
  SecurityAgentError,
  type SecurityAgentConfig,
  SecurityIncident,
} from './types.js';

// ClickHouse client interface
interface ClickHouseClient {
  query(sql: string): Promise<{ rows: unknown[] }>;
  insert(table: string, data: Record<string, unknown>[]): Promise<void>;
}

// Request context for audit enrichment
export interface AuditContext {
  traceId: string;
  userIp?: string;
  userAgent?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
}

// Global context storage (AsyncLocalStorage in production)
let currentContext: AuditContext | null = null;

/**
 * Audit Logger - Immutable, signed audit logs
 */
export class AuditLogger {
  private client: ClickHouseClient | null = null;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  // Buffer settings
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  // Signature version for schema migrations
  private readonly SIGNATURE_VERSION = 1;

  constructor(private readonly config: SecurityAgentConfig) {}

  /**
   * Initialize connection to ClickHouse
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // In production, use @clickhouse/client
      // For now, create a simple HTTP client
      this.client = this.createClickHouseClient();

      // Start buffer flush interval
      this.flushInterval = setInterval(() => this.flushBuffer(), this.FLUSH_INTERVAL_MS);

      this.initialized = true;
      console.log('[AuditLogger] Connected to ClickHouse at', this.config.clickhouse.host);
    } catch (error) {
      throw new SecurityAgentError(
        `Failed to connect to ClickHouse: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLICKHOUSE_CONNECTION_FAILED',
        503
      );
    }
  }

  /**
   * Set the current request context for audit enrichment
   */
  setContext(context: AuditContext): void {
    currentContext = context;
  }

  /**
   * Get the current context
   */
  getContext(): AuditContext | null {
    return currentContext;
  }

  /**
   * Clear the current context (call at end of request)
   */
  clearContext(): void {
    currentContext = null;
  }

  /**
   * Log an audit event
   *
   * @example
   * await audit.log({
   *   event: 'price.update',
   *   category: 'data',
   *   userId: 'user_123',
   *   before: { price: 100 },
   *   after: { price: 150 }
   * });
   */
  async log(event: AuditEvent): Promise<string> {
    // Validate event
    const validatedEvent = AuditEventSchema.parse(event);

    // Get current context
    const context = currentContext || { traceId: randomUUID() };

    // Create log entry
    const entry: AuditLogEntry = {
      ...validatedEvent,
      id: randomUUID(),
      traceId: context.traceId,
      timestamp: new Date(),
      signature: '', // Will be set below
      signatureVersion: this.SIGNATURE_VERSION,
    };

    if (context.userIp) entry.userIp = context.userIp;
    if (context.userAgent) entry.userAgent = context.userAgent;
    if (context.sessionId) entry.sessionId = context.sessionId;
    if (context.requestPath) entry.requestPath = context.requestPath;
    if (context.requestMethod) entry.requestMethod = context.requestMethod;

    // Generate signature
    entry.signature = this.generateSignature(entry);

    // Add to buffer
    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer();
    }

    // Log to console for debugging (never log sensitive data!)
    console.log('[AuditLogger] Event logged', {
      id: entry.id,
      event: entry.event,
      category: entry.category,
      severity: entry.severity,
      userId: entry.userId,
      traceId: entry.traceId,
    });

    return entry.id;
  }

  /**
   * Log a critical security event (immediate flush)
   */
  async logCritical(event: Omit<AuditEvent, 'severity'>): Promise<string> {
    const id = await this.log({
      ...event,
      severity: 'critical',
    });

    // Immediately flush for critical events
    await this.flushBuffer();

    // Also create a security incident if this is a known incident type
    if (this.isSecurityIncident(event.event)) {
      await this.createSecurityIncident({
        type: this.mapEventToIncidentType(event.event),
        severity: 'P1',
        title: `Security event: ${event.event}`,
        description: `Critical security event detected for user ${event.userId}`,
        affectedUsers: [event.userId],
        detectionMethod: 'audit_logger',
        autoRemediation: false,
      });
    }

    return id;
  }

  /**
   * Log price change specifically (helper for common use case)
   */
  async logPriceChange(
    userId: string,
    productId: string,
    marketplace: string,
    beforePrice: number,
    afterPrice: number,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const percentChange = ((afterPrice - beforePrice) / beforePrice) * 100;
    const severity =
      Math.abs(percentChange) > 50 ? 'critical' : Math.abs(percentChange) > 20 ? 'warning' : 'info';

    return this.log({
      event: 'price.update',
      category: 'data',
      severity,
      userId,
      resourceType: 'product',
      resourceId: productId,
      before: { price: beforePrice, marketplace },
      after: { price: afterPrice, marketplace },
      metadata: {
        ...metadata,
        percentChange: percentChange.toFixed(2),
      },
    });
  }

  /**
   * Log secret access (helper for Secrets Guard integration)
   */
  async logSecretAccess(
    userId: string,
    secretKey: string,
    purpose: string,
    granted: boolean
  ): Promise<string> {
    return this.log({
      event: granted ? 'secret.access' : 'secret.denied',
      category: 'security',
      severity: granted ? 'info' : 'warning',
      userId,
      resourceType: 'secret',
      resourceId: secretKey,
      metadata: { purpose, granted },
    });
  }

  /**
   * Log authorization decision (helper for AuthZ Guard integration)
   */
  async logAuthzDecision(
    userId: string,
    requiredPermissions: string[],
    granted: boolean,
    missingPermissions?: string[]
  ): Promise<string> {
    return this.log({
      event: granted ? 'auth.allowed' : 'auth.denied',
      category: 'auth',
      severity: granted ? 'info' : 'warning',
      userId,
      metadata: {
        requiredPermissions,
        granted,
        missingPermissions,
      },
    });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions): Promise<AuditLogEntry[]> {
    await this.ensureInitialized();

    const conditions: string[] = ['1=1'];

    if (options.userId) {
      conditions.push(`user_id = '${this.escapeString(options.userId)}'`);
    }
    if (options.event) {
      conditions.push(`event = '${this.escapeString(options.event)}'`);
    }
    if (options.category) {
      conditions.push(`category = '${this.escapeString(options.category)}'`);
    }
    if (options.severity) {
      conditions.push(`severity = '${this.escapeString(options.severity)}'`);
    }
    if (options.startTime) {
      conditions.push(`timestamp >= '${options.startTime.toISOString()}'`);
    }
    if (options.endTime) {
      conditions.push(`timestamp <= '${options.endTime.toISOString()}'`);
    }

    const sql = `
      SELECT *
      FROM security_audit.audit_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ${options.limit || 100}
      OFFSET ${options.offset || 0}
    `;

    const result = await this.client!.query(sql);
    return result.rows as AuditLogEntry[];
  }

  /**
   * Verify signature of an audit log entry
   */
  verifySignature(entry: AuditLogEntry): boolean {
    const { signature, ...rest } = entry;
    const expectedSignature = this.generateSignature(rest as unknown as AuditLogEntry);
    return signature === expectedSignature;
  }

  /**
   * Create a security incident
   */
  async createSecurityIncident(incident: SecurityIncident): Promise<string> {
    await this.ensureInitialized();

    const id = randomUUID();
    const traceId = currentContext?.traceId || randomUUID();

    const signatureData = {
      id,
      ...incident,
      traceId,
      timestamp: new Date().toISOString(),
    };
    const signature = this.generateSignature(signatureData as unknown as AuditLogEntry);

    await this.client!.insert('security_audit.security_incidents', [
      {
        id,
        incident_type: incident.type,
        severity: incident.severity,
        title: incident.title,
        description: incident.description,
        affected_users: incident.affectedUsers || [],
        affected_resources: incident.affectedResources || [],
        detection_method: incident.detectionMethod,
        auto_remediation_applied: incident.autoRemediation,
        remediation_actions: incident.remediationActions || [],
        resolved: false,
        trace_id: traceId,
        signature,
      },
    ]);

    console.error('[AuditLogger] SECURITY INCIDENT CREATED', {
      id,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
    });

    // TODO: Send to PagerDuty/Telegram for P0/P1 incidents

    return id;
  }

  /**
   * Flush the buffer to ClickHouse
   */
  async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.ensureInitialized();

      const rows = entries.map(entry => ({
        id: entry.id,
        event: entry.event,
        category: entry.category,
        severity: entry.severity,
        user_id: entry.userId,
        user_ip: entry.userIp,
        user_agent: entry.userAgent,
        session_id: entry.sessionId,
        trace_id: entry.traceId,
        request_path: entry.requestPath,
        request_method: entry.requestMethod,
        before_state: entry.before ? JSON.stringify(entry.before) : null,
        after_state: entry.after ? JSON.stringify(entry.after) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        signature: entry.signature,
        signature_version: entry.signatureVersion,
        timestamp: entry.timestamp.toISOString(),
      }));

      await this.client!.insert('security_audit.audit_logs', rows);

      console.log('[AuditLogger] Flushed buffer', { count: rows.length });
    } catch (error) {
      // Put entries back to buffer on failure
      this.buffer.unshift(...entries);
      console.error('[AuditLogger] Failed to flush buffer', error);
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushBuffer();
    this.initialized = false;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private generateSignature(entry: Partial<AuditLogEntry>): string {
    // Create a deterministic representation
    const payload = {
      id: entry.id,
      event: entry.event,
      category: entry.category,
      userId: entry.userId,
      traceId: entry.traceId,
      before: entry.before,
      after: entry.after,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
    };

    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return createHmac('sha256', this.config.signingKey).update(json).digest('hex');
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'");
  }

  private isSecurityIncident(event: string): boolean {
    const incidentEvents = [
      'auth.denied',
      'secret.denied',
      'secret.leak',
      'rate_limit.exceeded',
      'injection.blocked',
    ];
    return incidentEvents.includes(event);
  }

  private mapEventToIncidentType(event: string): SecurityIncident['type'] {
    const mapping: Record<string, SecurityIncident['type']> = {
      'auth.denied': 'unauthorized_access',
      'secret.denied': 'unauthorized_access',
      'secret.leak': 'secret_leak',
      'rate_limit.exceeded': 'rate_limit_exceeded',
      'injection.blocked': 'injection_attempt',
    };
    return mapping[event] || 'unauthorized_access';
  }

  private createClickHouseClient(): ClickHouseClient {
    const { host, port, username, password, database } = this.config.clickhouse;
    const baseUrl = `http://${host}:${port}`;

    return {
      async query(sql: string) {
        const response = await fetch(`${baseUrl}/?query=${encodeURIComponent(sql)}`, {
          method: 'GET',
          headers: {
            'X-ClickHouse-User': username,
            'X-ClickHouse-Key': password,
            'X-ClickHouse-Database': database,
          },
        });

        if (!response.ok) {
          throw new Error(`ClickHouse query failed: ${await response.text()}`);
        }

        const text = await response.text();
        const rows = text
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return line;
            }
          });

        return { rows };
      },

      async insert(table: string, data: Record<string, unknown>[]) {
        const values = data
          .map(row => {
            const vals = Object.values(row).map(v => {
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
              if (Array.isArray(v)) return `[${v.map(i => `'${i}'`).join(',')}]`;
              return v;
            });
            return `(${vals.join(',')})`;
          })
          .join(',');

        const columns = Object.keys(data[0] || {}).join(',');
        const sql = `INSERT INTO ${table} (${columns}) VALUES ${values}`;

        const response = await fetch(`${baseUrl}/`, {
          method: 'POST',
          headers: {
            'X-ClickHouse-User': username,
            'X-ClickHouse-Key': password,
            'X-ClickHouse-Database': database,
            'Content-Type': 'text/plain',
          },
          body: sql,
        });

        if (!response.ok) {
          throw new Error(`ClickHouse insert failed: ${await response.text()}`);
        }
      },
    };
  }
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Create audit context from incoming request
 */
export function createAuditContext(req: {
  headers: Record<string, string | undefined>;
  url?: string;
  method?: string;
}): AuditContext {
  const context: AuditContext = {
    traceId: req.headers['x-trace-id'] || req.headers['x-request-id'] || randomUUID(),
    userIp:
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      'unknown',
  };

  if (req.headers['user-agent']) context.userAgent = req.headers['user-agent'];
  if (req.url) context.requestPath = req.url;
  if (req.method) context.requestMethod = req.method;

  return context;
}
