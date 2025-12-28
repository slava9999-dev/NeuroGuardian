/**
 * ============================================
 * Security Agent - n8n Guardian Module
 * ============================================
 * Workflow integrity verification and secure credential injection
 *
 * Requirements (Day 4):
 * - NG-1: Workflow signing (ED25519)
 * - NG-2: Signature verification before execution
 * - NG-3: Credential injection from Vault
 * - NG-4: Structured execution logging
 * - NG-5: Drift detection (Git vs n8n UI)
 */

import * as crypto from 'crypto';
import { z } from 'zod';
import type { SecretsGuard } from './secrets.js';
import type { AuditLogger } from './audit.js';

// ============================================
// Schemas
// ============================================

const WorkflowSignatureSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  contentHash: z.string(), // SHA-256 of workflow JSON
  signature: z.string(), // ED25519 signature
  signedAt: z.string().datetime(),
  signedBy: z.string(),
  version: z.string(),
});

const WorkflowExecutionLogSchema = z.object({
  executionId: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  startedAt: z.string().datetime(),
  status: z.enum(['running', 'success', 'error', 'waiting']),
  nodeExecutions: z
    .array(
      z.object({
        nodeName: z.string(),
        nodeType: z.string(),
        status: z.string(),
        executionTime: z.number().optional(),
        error: z.string().optional(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowSignature = z.infer<typeof WorkflowSignatureSchema>;
export type WorkflowExecutionLog = z.infer<typeof WorkflowExecutionLogSchema>;

// ============================================
// n8n Guardian Class
// ============================================

export class N8nGuardian {
  private signingKey: crypto.KeyObject | null = null;
  private verifyKey: crypto.KeyObject | null = null;
  private n8nApiUrl: string;
  private n8nApiKey: string | null = null;
  private secrets: SecretsGuard | null = null;
  private audit: AuditLogger | null = null;

  constructor() {
    this.n8nApiUrl = process.env.N8N_API_URL || 'http://localhost:5678';
  }

  /**
   * Set dependencies (called by SecurityAgent)
   */
  setDependencies(secrets: SecretsGuard, audit: AuditLogger): void {
    this.secrets = secrets;
    this.audit = audit;
  }

  /**
   * NG-1: Initialize signing keys (ED25519)
   */
  async initialize(): Promise<void> {
    if (!this.secrets || !this.audit) {
      throw new Error('N8nGuardian: dependencies not set. Call setDependencies() first.');
    }

    // Get or generate signing keys
    const signingKeyPem = await this.getOrCreateSigningKey();

    this.signingKey = crypto.createPrivateKey({
      key: signingKeyPem,
      format: 'pem',
      type: 'pkcs8',
    });

    this.verifyKey = crypto.createPublicKey(this.signingKey);

    // Get n8n API credentials
    const n8nCreds = await this.secrets.get({
      userId: 'system',
      key: 'n8n/api_key',
      purpose: 'n8n_api_access',
      ttl: 300,
    });
    this.n8nApiKey = n8nCreds.value || process.env.N8N_API_KEY || null;

    console.log('[N8nGuardian] Initialized with workflow signing enabled');
  }

  /**
   * Get or create ED25519 signing key from Vault
   */
  private async getOrCreateSigningKey(): Promise<string> {
    if (!this.secrets) throw new Error('Secrets not initialized');

    try {
      const existingKey = await this.secrets.get({
        userId: 'system',
        key: 'n8n/workflow_signing_key',
        purpose: 'workflow_signing',
        ttl: 3600,
      });

      if (existingKey.value) {
        return existingKey.value;
      }
    } catch (error) {
      console.log('[N8nGuardian] No existing signing key, generating new one...');
    }

    // Generate new ED25519 keypair
    const { privateKey } = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    // Store in Vault (in production, this should be done manually/securely)
    console.warn(
      '[N8nGuardian] Generated new signing key - should be stored in Vault manually in production'
    );

    return privateKey;
  }

  /**
   * NG-1: Sign a workflow
   */
  async signWorkflow(params: {
    workflowId: string;
    workflowName: string;
    workflowJson: object;
    version: string;
  }): Promise<WorkflowSignature> {
    if (!this.signingKey) {
      throw new Error('N8nGuardian not initialized');
    }

    // Calculate content hash
    const contentHash = this.hashWorkflowContent(params.workflowJson);

    // Sign the hash
    const dataToSign = `${params.workflowId}:${contentHash}:${params.version}`;
    const signature = crypto.sign(null, Buffer.from(dataToSign, 'utf8'), this.signingKey);

    const workflowSignature: WorkflowSignature = {
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      contentHash,
      signature: signature.toString('base64'),
      signedAt: new Date().toISOString(),
      signedBy: 'security-agent',
      version: params.version,
    };

    // Store signature in Vault
    await this.storeSignature(workflowSignature);

    console.log('[N8nGuardian] Workflow signed', {
      workflowId: params.workflowId,
      contentHash: contentHash.substring(0, 16) + '...',
    });

    return workflowSignature;
  }

  /**
   * NG-2: Verify workflow signature before execution
   */
  async verifyWorkflow(params: {
    workflowId: string;
    workflowJson: object;
  }): Promise<{ valid: boolean; reason?: string }> {
    if (!this.verifyKey) {
      throw new Error('N8nGuardian not initialized');
    }

    try {
      // Get stored signature from Vault
      const storedSignature = await this.getStoredSignature(params.workflowId);
      if (!storedSignature) {
        return { valid: false, reason: 'No signature found for workflow' };
      }

      // Calculate current content hash
      const currentHash = this.hashWorkflowContent(params.workflowJson);

      // Check if content changed
      if (currentHash !== storedSignature.contentHash) {
        console.warn('[N8nGuardian] Workflow drift detected', {
          workflowId: params.workflowId,
          expected: storedSignature.contentHash.substring(0, 16),
          actual: currentHash.substring(0, 16),
        });
        return { valid: false, reason: 'Workflow content has been modified' };
      }

      // Verify signature
      const dataToVerify = `${params.workflowId}:${currentHash}:${storedSignature.version}`;
      const signatureBuffer = Buffer.from(storedSignature.signature, 'base64');

      const isValid = crypto.verify(
        null,
        Buffer.from(dataToVerify, 'utf8'),
        this.verifyKey,
        signatureBuffer
      );

      if (!isValid) {
        return { valid: false, reason: 'Invalid signature' };
      }

      console.log('[N8nGuardian] Workflow signature verified', {
        workflowId: params.workflowId,
      });

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[N8nGuardian] Verification failed', { error: errorMessage });
      return { valid: false, reason: errorMessage };
    }
  }

  /**
   * NG-3: Inject credentials into workflow execution
   */
  async injectCredentials(params: {
    userId: string;
    credentialType: 'wb_api_key' | 'ozon_api_key' | 'telegram_token';
  }): Promise<{ credential: string; expiresIn: number }> {
    if (!this.secrets) throw new Error('Secrets not initialized');

    const credentialMap = {
      wb_api_key: `users/${params.userId}/wb_api_key`,
      ozon_api_key: `users/${params.userId}/ozon_api_key`,
      telegram_token: 'telegram_bot_token',
    };

    const vaultKey = credentialMap[params.credentialType];

    const secret = await this.secrets.get({
      userId: params.userId,
      key: vaultKey,
      purpose: 'n8n_workflow_execution',
      ttl: 300, // 5 minutes
    });

    console.log('[N8nGuardian] Credential injected', {
      userId: params.userId,
      type: params.credentialType,
      leaseId: secret.leaseId?.substring(0, 8),
    });

    return {
      credential: secret.value || '',
      expiresIn: 300,
    };
  }

  /**
   * NG-4: Log workflow execution
   */
  async logExecution(log: WorkflowExecutionLog): Promise<void> {
    if (!this.audit) throw new Error('Audit not initialized');

    // Validate log structure
    WorkflowExecutionLogSchema.parse(log);

    // Store in audit log
    await this.audit.log({
      event: `n8n.workflow.${log.status}`,
      category: 'workflow',
      severity: log.status === 'error' ? 'critical' : 'info',
      userId: 'system',
      metadata: {
        executionId: log.executionId,
        workflowId: log.workflowId,
        workflowName: log.workflowName,
        nodeExecutions: log.nodeExecutions,
        ...log.metadata,
      },
    });

    console.log('[N8nGuardian] Execution logged', {
      executionId: log.executionId,
      status: log.status,
    });
  }

  /**
   * NG-5: Check for workflow drift (Git vs n8n UI)
   */
  async checkDrift(params: {
    workflowId: string;
    gitWorkflowJson: object;
  }): Promise<{ hasDrift: boolean; details?: string }> {
    if (!this.n8nApiKey) {
      throw new Error('n8n API key not configured');
    }

    try {
      // Fetch current workflow from n8n
      const response = await fetch(`${this.n8nApiUrl}/api/v1/workflows/${params.workflowId}`, {
        headers: {
          'X-N8N-API-KEY': this.n8nApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow from n8n: ${response.statusText}`);
      }

      const n8nWorkflow = await response.json();

      // Compare hashes
      const gitHash = this.hashWorkflowContent(params.gitWorkflowJson);
      const n8nHash = this.hashWorkflowContent(n8nWorkflow);

      const hasDrift = gitHash !== n8nHash;

      if (hasDrift) {
        console.warn('[N8nGuardian] Drift detected', {
          workflowId: params.workflowId,
          gitHash: gitHash.substring(0, 16),
          n8nHash: n8nHash.substring(0, 16),
        });

        // Log drift event
        await this.logDriftDetected(params.workflowId);
      }

      const result: { hasDrift: boolean; details?: string } = {
        hasDrift,
      };
      if (hasDrift) {
        result.details = `Git hash: ${gitHash.substring(0, 16)}, n8n hash: ${n8nHash.substring(0, 16)}`;
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[N8nGuardian] Drift check failed', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Disable workflow if drift detected
   */
  async disableWorkflowOnDrift(workflowId: string): Promise<void> {
    if (!this.n8nApiKey) {
      throw new Error('n8n API key not configured');
    }

    await fetch(`${this.n8nApiUrl}/api/v1/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: {
        'X-N8N-API-KEY': this.n8nApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ active: false }),
    });

    console.warn('[N8nGuardian] Workflow disabled due to drift', { workflowId });
  }

  // ============================================
  // Private helpers
  // ============================================

  private hashWorkflowContent(workflowJson: unknown): string {
    // Normalize JSON (remove volatile fields like timestamps, IDs)
    const normalized = this.normalizeWorkflow(workflowJson as Record<string, unknown>);
    const jsonString = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  private normalizeWorkflow(workflow: Record<string, unknown>): Record<string, unknown> {
    // Remove fields that change but don't affect logic
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...rest } = workflow;
    return rest;
  }

  private async storeSignature(signature: WorkflowSignature): Promise<void> {
    if (!this.audit) throw new Error('Audit not initialized');

    // Store in ClickHouse via audit log
    await this.audit.log({
      event: 'n8n.workflow.signed',
      category: 'workflow',
      severity: 'info',
      userId: 'system',
      metadata: signature,
    });
  }

  private async getStoredSignature(workflowId: string): Promise<WorkflowSignature | null> {
    // In production, query ClickHouse or dedicated signature storage
    // For dev, we can use Vault metadata or a simple file

    if (!this.secrets) throw new Error('Secrets not initialized');
    try {
      const stored = await this.secrets.get({
        userId: 'system',
        key: `n8n/signatures/${workflowId}`,
        purpose: 'signature_verification',
        ttl: 3600,
      });

      if (stored.value) {
        return JSON.parse(stored.value);
      }
    } catch (error) {
      // Signature not found or expired
    }

    return null;
  }

  private async logDriftDetected(workflowId: string): Promise<void> {
    if (!this.audit) throw new Error('Audit not initialized');
    await this.audit.log({
      event: 'n8n.workflow.drift_detected',
      category: 'workflow',
      severity: 'warning',
      userId: 'system',
      metadata: {
        workflowId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ============================================
// Export singleton
// ============================================

let guardianInstance: N8nGuardian | null = null;

export function getN8nGuardian(): N8nGuardian {
  if (!guardianInstance) {
    guardianInstance = new N8nGuardian();
  }
  return guardianInstance;
}
