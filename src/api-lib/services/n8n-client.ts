import { logOpsEvent } from './ops-logger.js';
import type { N8nWorkflow } from '../lib/types.js';

// API Configuration
const N8N_API_BASE = process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

// Critical workflows that MUST be active
const CRITICAL_WORKFLOWS = ['sentinel-workflow', 'sync-workflow', 'monitoring-workflow'];

export interface N8nHealth {
  status: 'active' | 'inactive' | 'error' | 'drift';
  version: string;
  workflows_active: number;
  workflows_total: number;
  drift_details?: string[];
}

/**
 * Check n8n system health and configuration drift
 */
export async function getN8nSystemHealth(): Promise<N8nHealth> {
  if (!N8N_API_BASE || !N8N_API_KEY) {
    return {
      status: 'inactive',
      version: 'unknown',
      workflows_active: 0,
      workflows_total: 0,
      drift_details: ['Missing N8N_API config'],
    };
  }

  try {
    const response = await fetch(`${N8N_API_BASE}/workflows`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = (await response.json()) as { data: N8nWorkflow[] };
    const workflows: N8nWorkflow[] = data.data || [];

    const activeWorkflows = workflows.filter(w => w.active);
    const missingCritical = CRITICAL_WORKFLOWS.filter(
      name => !activeWorkflows.some(w => w.name.includes(name))
    );

    const isDrift = missingCritical.length > 0;

    return {
      status: isDrift ? 'drift' : 'active',
      version: '1.x', // Version check often requires separate endpoint
      workflows_active: activeWorkflows.length,
      workflows_total: workflows.length,
      drift_details: isDrift ? missingCritical.map(name => `${name} is inactive`) : [],
    };
  } catch (error) {
    console.error('n8n Health Check Failed:', error);
    return {
      status: 'error',
      version: 'unknown',
      workflows_active: 0,
      workflows_total: 0,
    };
  }
}

const N8N_URL = process.env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_BASE;

export interface N8nActionPayload {
  action: string;
  userId: number;
  [key: string]: unknown;
}

/**
 * Trigger an n8n workflow via webhook
 */
export async function triggerN8nWorkflow(
  webhookPath: string,
  payload: N8nActionPayload
): Promise<boolean> {
  // N8N DISABLED ARCHITECTURALLY
  // eslint-disable-next-line no-constant-condition
  if (true) {
    if (process.env.DEBUG_N8N) console.log(`[Skipped] n8n trigger: ${webhookPath}`);
    return false;
  }

  if (!N8N_URL) {
    console.warn('N8N_WEBHOOK_URL not defined, skipping n8n trigger');
    return false;
  }

  const url = `${N8N_URL!.replace(/\/$/, '')}/${webhookPath.replace(/^\//, '')}`;
  const startTime = Date.now();

  try {
    console.log(`Triggering n8n webhook: ${url}`, payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(process.env.N8N_WEBHOOK_SECRET ? { 'X-N8N-Secret': process.env.N8N_WEBHOOK_SECRET } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const success = response.ok;
    const duration = Date.now() - startTime;

    // Log the interaction
    await logOpsEvent({
      eventType: success ? 'n8n_trigger_success' : 'n8n_trigger_error',
      eventSource: 'agent', // or 'system'
      userId: payload.userId,
      payload: {
        webhook: webhookPath,
        action: payload.action,
        status: response.status,
        duration,
        error: !success ? await response.text() : undefined,
      },
    });

    if (!success) {
      console.error(`Failed to trigger n8n: ${response.status} ${response.statusText}`);
    }

    return success;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error triggering n8n workflow:', error);

    await logOpsEvent({
      eventType: 'n8n_trigger_error',
      eventSource: 'agent',
      userId: payload.userId,
      payload: {
        webhook: webhookPath,
        action: payload.action,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return false;
  }
}

/**
 * Runbook Action: Sync Products
 */
export async function triggerSyncProducts(userId: number): Promise<boolean> {
  // Use existing dedicated webhook or generic action endpoint
  // For simplicity using generic action endpoint if available, but assuming dedicated webhooks for now
  // Based on n8n-webhooks.ts, we actually RECEIVE these.
  // To TRIGGER, we need a separate webhook in n8n listening for "POST /start-sync"

  // Hypothetical webhook path
  return triggerN8nWorkflow('start-sync-products', { action: 'sync_products', userId });
}

/**
 * Runbook Action: Retry Onboarding
 */
export async function triggerRetryOnboarding(userId: number): Promise<boolean> {
  return triggerN8nWorkflow('retry-onboarding', { action: 'retry_onboarding', userId });
}
