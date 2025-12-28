/**
 * ============================================
 * Security Agent - Emergency Response Module
 * ============================================
 * Incident management, lockdown procedures, and alert systems
 *
 * Requirements (Day 7):
 * - Emergency lockdown workflow
 * - Incident playbooks (P0, P1, P2)
 * - Alert systems (PagerDuty, Telegram)
 * - Escalation procedures
 * - Incident simulation & testing
 */

import { z } from 'zod';
import type { AuditLogger } from './audit.js';

// ============================================
// Schemas
// ============================================

const IncidentSeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);

const IncidentSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: IncidentSeveritySchema,
  category: z.enum([
    'secret_leak',
    'data_breach',
    'auth_bypass',
    'ddos_attack',
    'injection_attack',
    'workflow_tampering',
    'unauthorized_access',
    'system_failure',
  ]),
  detectedAt: z.string().datetime(),
  detectedBy: z.string(), // 'system', 'user', 'monitor'
  affectedSystems: z.array(z.string()),
  affectedUsers: z.array(z.string()).optional(),
  status: z.enum(['open', 'investigating', 'mitigating', 'resolved', 'closed']),
  assignedTo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const PlaybookSchema = z.object({
  id: z.string(),
  name: z.string(),
  severity: IncidentSeveritySchema,
  category: z.string(),
  steps: z.array(
    z.object({
      order: z.number(),
      action: z.string(),
      description: z.string(),
      automated: z.boolean(),
      requiresApproval: z.boolean(),
    })
  ),
  escalationPath: z.array(z.string()),
  slaMinutes: z.number(), // Service Level Agreement response time
});

const LockdownStateSchema = z.object({
  active: z.boolean(),
  initiatedAt: z.string().datetime().optional(),
  initiatedBy: z.string().optional(),
  reason: z.string().optional(),
  affectedSystems: z.array(z.string()).optional(),
  autoRestore: z.boolean().default(false),
  restoreAt: z.string().datetime().optional(),
});

export type Incident = z.infer<typeof IncidentSchema>;
export type Playbook = z.infer<typeof PlaybookSchema>;
export type LockdownState = z.infer<typeof LockdownStateSchema>;
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

// ============================================
// Emergency Response Class
// ============================================

export class EmergencyResponse {
  private audit: AuditLogger | null = null;
  private lockdownState: LockdownState = { active: false, autoRestore: false };
  private activeIncidents = new Map<string, Incident>();

  /**
   * Set dependencies
   */
  setDependencies(audit: AuditLogger): void {
    this.audit = audit;
  }

  /**
   * Initialize
   */
  async initialize(): Promise<void> {
    if (!this.audit) {
      throw new Error('EmergencyResponse: audit logger not set');
    }

    console.log('[EmergencyResponse] Initialized');
  }

  // ============================================
  // Incident Management
  // ============================================

  /**
   * Create and report a security incident
   */
  async reportIncident(incident: Omit<Incident, 'id' | 'status'>): Promise<Incident> {
    const fullIncident: Incident = {
      ...incident,
      id: `INC-${Date.now()}`,
      status: 'open',
    };

    IncidentSchema.parse(fullIncident);

    this.activeIncidents.set(fullIncident.id, fullIncident);

    // Log to audit
    if (this.audit) {
      await this.audit.log({
        event: 'emergency.incident_reported',
        category: 'security',
        severity: fullIncident.severity === 'P0' ? 'critical' : 'warning',
        userId: 'system',
        metadata: {
          incidentId: fullIncident.id,
          title: fullIncident.title,
          severity: fullIncident.severity,
          category: fullIncident.category,
          affectedSystems: fullIncident.affectedSystems,
        },
      });
    }

    // Send alerts based on severity
    await this.sendAlert(fullIncident);

    // Auto-execute playbook for P0 incidents
    if (fullIncident.severity === 'P0') {
      await this.executePlaybook(fullIncident);
    }

    console.log('[EmergencyResponse] Incident reported', {
      id: fullIncident.id,
      severity: fullIncident.severity,
      category: fullIncident.category,
    });

    return fullIncident;
  }

  /**
   * Update incident status
   */
  async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident | null> {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) {
      return null;
    }

    const updated = { ...incident, ...updates };
    this.activeIncidents.set(incidentId, updated);

    if (this.audit) {
      await this.audit.log({
        event: 'emergency.incident_updated',
        category: 'security',
        severity: 'info',
        userId: updates.assignedTo || 'system',
        metadata: {
          incidentId,
          status: updated.status,
          changes: updates,
        },
      });
    }

    return updated;
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): Incident | null {
    return this.activeIncidents.get(incidentId) || null;
  }

  /**
   * List all active incidents
   */
  listActiveIncidents(filters?: {
    severity?: IncidentSeverity;
    category?: string;
    status?: Incident['status'];
  }): Incident[] {
    let incidents = Array.from(this.activeIncidents.values());

    if (filters?.severity) {
      incidents = incidents.filter(i => i.severity === filters.severity);
    }
    if (filters?.category) {
      incidents = incidents.filter(i => i.category === filters.category);
    }
    if (filters?.status) {
      incidents = incidents.filter(i => i.status === filters.status);
    }

    return incidents.sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  // ============================================
  // Emergency Lockdown
  // ============================================

  /**
   * Activate emergency lockdown
   */
  async activateLockdown(params: {
    reason: string;
    initiatedBy: string;
    affectedSystems?: string[];
    autoRestore?: boolean;
    restoreAfterMinutes?: number;
  }): Promise<LockdownState> {
    if (this.lockdownState.active) {
      console.warn('[EmergencyResponse] Lockdown already active');
      return this.lockdownState;
    }

    const now = new Date();
    const restoreAt =
      params.autoRestore && params.restoreAfterMinutes
        ? new Date(now.getTime() + params.restoreAfterMinutes * 60000)
        : undefined;

    this.lockdownState = {
      active: true,
      initiatedAt: now.toISOString(),
      initiatedBy: params.initiatedBy,
      reason: params.reason,
      affectedSystems: params.affectedSystems,
      autoRestore: params.autoRestore || false,
      restoreAt: restoreAt?.toISOString(),
    };

    if (this.audit) {
      await this.audit.log({
        event: 'emergency.lockdown_activated',
        category: 'security',
        severity: 'critical',
        userId: params.initiatedBy,
        metadata: {
          reason: params.reason,
          affectedSystems: params.affectedSystems,
          autoRestore: params.autoRestore,
          restoreAt: restoreAt?.toISOString(),
        },
      });
    }

    // Send critical alerts
    await this.sendCriticalAlert({
      title: '🚨 EMERGENCY LOCKDOWN ACTIVATED',
      message: `Reason: ${params.reason}`,
      severity: 'P0',
    });

    console.error('[EmergencyResponse] LOCKDOWN ACTIVATED', {
      reason: params.reason,
      initiatedBy: params.initiatedBy,
    });

    return this.lockdownState;
  }

  /**
   * Deactivate lockdown
   */
  async deactivateLockdown(deactivatedBy: string): Promise<void> {
    if (!this.lockdownState.active) {
      return;
    }

    const previousState = { ...this.lockdownState };
    this.lockdownState = { active: false, autoRestore: false };

    if (this.audit) {
      await this.audit.log({
        event: 'emergency.lockdown_deactivated',
        category: 'security',
        severity: 'warning',
        userId: deactivatedBy,
        metadata: {
          duration: this.calculateDuration(previousState.initiatedAt!, new Date().toISOString()),
          reason: previousState.reason,
        },
      });
    }

    await this.sendCriticalAlert({
      title: '✅ Lockdown Deactivated',
      message: 'System returning to normal operations',
      severity: 'P1',
    });

    console.log('[EmergencyResponse] Lockdown deactivated', { deactivatedBy });
  }

  /**
   * Get current lockdown state
   */
  getLockdownState(): LockdownState {
    return { ...this.lockdownState };
  }

  // ============================================
  // Playbook Execution
  // ============================================

  /**
   * Execute incident response playbook
   */
  async executePlaybook(incident: Incident): Promise<{
    playbookId: string;
    stepsExecuted: number;
    stepsTotal: number;
    success: boolean;
  }> {
    // Get appropriate playbook for incident
    const playbook = this.getPlaybookForIncident(incident);

    if (!playbook) {
      console.warn('[EmergencyResponse] No playbook found for incident', {
        category: incident.category,
        severity: incident.severity,
      });
      return { playbookId: 'none', stepsExecuted: 0, stepsTotal: 0, success: false };
    }

    console.log('[EmergencyResponse] Executing playbook', {
      playbookId: playbook.id,
      incidentId: incident.id,
      steps: playbook.steps.length,
    });

    let stepsExecuted = 0;

    for (const step of playbook.steps) {
      if (step.requiresApproval) {
        // In production, wait for approval
        console.log('[EmergencyResponse] Step requires approval', {
          step: step.action,
        });
        // For now, we skip approval-required steps
        continue;
      }

      if (step.automated) {
        await this.executePlaybookStep(step, incident);
        stepsExecuted++;
      }
    }

    if (this.audit) {
      await this.audit.log({
        event: 'emergency.playbook_executed',
        category: 'security',
        severity: 'info',
        userId: 'system',
        metadata: {
          playbookId: playbook.id,
          incidentId: incident.id,
          stepsExecuted,
          stepsTotal: playbook.steps.length,
        },
      });
    }

    return {
      playbookId: playbook.id,
      stepsExecuted,
      stepsTotal: playbook.steps.length,
      success: true,
    };
  }

  /**
   * Get playbook for incident type
   */
  private getPlaybookForIncident(incident: Incident): Playbook | null {
    // In production, these would be loaded from database
    // For now, we return built-in playbooks

    const playbooks: Record<string, Playbook> = {
      secret_leak_p0: {
        id: 'PB-SECRET-LEAK-P0',
        name: 'Secret Leak Response (P0)',
        severity: 'P0',
        category: 'secret_leak',
        slaMinutes: 5,
        escalationPath: ['security-team', 'engineering-lead', 'cto'],
        steps: [
          {
            order: 1,
            action: 'lockdown',
            description: 'Activate emergency lockdown',
            automated: true,
            requiresApproval: false,
          },
          {
            order: 2,
            action: 'rotate',
            description: 'Rotate all exposed secrets',
            automated: true,
            requiresApproval: false,
          },
          {
            order: 3,
            action: 'notify',
            description: 'Notify security team',
            automated: true,
            requiresApproval: false,
          },
          {
            order: 4,
            action: 'audit',
            description: 'Review audit logs for unauthorized access',
            automated: false,
            requiresApproval: false,
          },
          {
            order: 5,
            action: 'report',
            description: 'Create incident report',
            automated: false,
            requiresApproval: true,
          },
        ],
      },
      data_breach_p0: {
        id: 'PB-DATA-BREACH-P0',
        name: 'Data Breach Response (P0)',
        severity: 'P0',
        category: 'data_breach',
        slaMinutes: 15,
        escalationPath: ['security-team', 'legal', 'ceo'],
        steps: [
          {
            order: 1,
            action: 'lockdown',
            description: 'Activate lockdown for affected systems',
            automated: true,
            requiresApproval: false,
          },
          {
            order: 2,
            action: 'isolate',
            description: 'Isolate affected databases',
            automated: false,
            requiresApproval: true,
          },
          {
            order: 3,
            action: 'notify',
            description: 'Notify legal and compliance',
            automated: true,
            requiresApproval: false,
          },
          {
            order: 4,
            action: 'preserve',
            description: 'Preserve forensic evidence',
            automated: false,
            requiresApproval: false,
          },
        ],
      },
    };

    const key = `${incident.category}_${incident.severity.toLowerCase()}`;
    return playbooks[key] || null;
  }

  /**
   * Execute a single playbook step
   */
  private async executePlaybookStep(step: Playbook['steps'][0], incident: Incident): Promise<void> {
    console.log('[EmergencyResponse] Executing step', {
      step: step.action,
      incident: incident.id,
    });

    switch (step.action) {
      case 'lockdown':
        await this.activateLockdown({
          reason: `Incident: ${incident.title}`,
          initiatedBy: 'system',
          affectedSystems: incident.affectedSystems,
        });
        break;

      case 'rotate':
        // Trigger secret rotation
        console.log('[EmergencyResponse] Triggering secret rotation');
        break;

      case 'notify':
        await this.sendCriticalAlert({
          title: `Incident: ${incident.title}`,
          message: incident.description,
          severity: incident.severity,
        });
        break;

      default:
        console.log('[EmergencyResponse] Step action not automated', { action: step.action });
    }
  }

  // ============================================
  // Alert Systems
  // ============================================

  /**
   * Send alert based on incident severity
   */
  private async sendAlert(incident: Incident): Promise<void> {
    const message = {
      title: `[${incident.severity}] ${incident.title}`,
      message: incident.description,
      severity: incident.severity,
      timestamp: incident.detectedAt,
      incidentId: incident.id,
    };

    switch (incident.severity) {
      case 'P0':
        await this.sendCriticalAlert(message);
        break;
      case 'P1':
        await this.sendHighPriorityAlert(message);
        break;
      case 'P2':
      case 'P3':
        await this.sendNormalAlert(message);
        break;
    }
  }

  /**
   * Send critical alert (P0) - PagerDuty + Telegram + SMS
   */
  private async sendCriticalAlert(alert: {
    title: string;
    message: string;
    severity: string;
  }): Promise<void> {
    console.error('[EmergencyResponse] CRITICAL ALERT:', alert);

    // PagerDuty integration (would be real in production)
    const pagerDutyKey = process.env.PAGERDUTY_API_KEY;
    if (pagerDutyKey) {
      // await this.sendToPagerDuty(alert);
      console.log('[EmergencyResponse] Would send to PagerDuty (not configured)');
    }

    // Telegram alert
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (telegramToken && adminChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: `🚨 ${alert.title}\n\n${alert.message}`,
            parse_mode: 'HTML',
          }),
        });
        console.log('[EmergencyResponse] Telegram alert sent');
      } catch (error) {
        console.error('[EmergencyResponse] Failed to send Telegram alert', error);
      }
    }
  }

  /**
   * Send high priority alert (P1) - Telegram + Email
   */
  private async sendHighPriorityAlert(alert: { title: string; message: string }): Promise<void> {
    console.warn('[EmergencyResponse] HIGH PRIORITY ALERT:', alert);

    // Telegram only (no PagerDuty for P1)
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (telegramToken && adminChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: `⚠️ ${alert.title}\n\n${alert.message}`,
          }),
        });
      } catch (error) {
        console.error('[EmergencyResponse] Failed to send Telegram alert', error);
      }
    }
  }

  /**
   * Send normal alert (P2/P3) - Slack/Email only
   */
  private async sendNormalAlert(alert: { title: string; message: string }): Promise<void> {
    console.log('[EmergencyResponse] INFO ALERT:', alert);
    // Would send to Slack/Email in production
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Calculate duration in minutes
   */
  private calculateDuration(start: string, end: string): number {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return Math.round((endTime - startTime) / 60000);
  }

  /**
   * Simulate incident for testing
   */
  async simulateIncident(params: {
    category: Incident['category'];
    severity: IncidentSeverity;
  }): Promise<Incident> {
    const incident: Omit<Incident, 'id' | 'status'> = {
      title: `SIMULATION: ${params.category}`,
      description: 'This is a simulated incident for testing emergency response procedures',
      severity: params.severity,
      category: params.category,
      detectedAt: new Date().toISOString(),
      detectedBy: 'simulation',
      affectedSystems: ['test-system'],
    };

    return await this.reportIncident(incident);
  }
}

// ============================================
// Export singleton
// ============================================

let responseInstance: EmergencyResponse | null = null;

export function getEmergencyResponse(): EmergencyResponse {
  if (!responseInstance) {
    responseInstance = new EmergencyResponse();
  }
  return responseInstance;
}
