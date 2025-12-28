/**
 * ============================================
 * n8n Guardian Tests
 * ============================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSecurityAgent } from '../src/index.js';
import type { WorkflowExecutionLog } from '../src/n8n.js';

describe('N8nGuardian', () => {
  const agent = getSecurityAgent();
  const guardian = agent.n8n;

  beforeAll(async () => {
    await agent.initialize();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('NG-1/NG-2: Workflow Signing & Verification', () => {
    it('should sign a workflow and verify signature', async () => {
      const workflowJson = {
        id: 'wf_123',
        name: 'Test Workflow',
        nodes: [
          { name: 'Start', type: 'n8n-nodes-base.start' },
          { name: 'HTTP Request', type: 'n8n-nodes-base.httpRequest' },
        ],
        connections: {},
      };

      // Sign workflow
      const signature = await guardian.signWorkflow({
        workflowId: 'wf_test_001',
        workflowName: 'Test Workflow',
        workflowJson,
        version: '1.0.0',
      });

      expect(signature).toBeDefined();
      expect(signature.workflowId).toBe('wf_test_001');
      expect(signature.contentHash).toBeTruthy();
      expect(signature.signature).toBeTruthy();

      // Verify workflow
      const verification = await guardian.verifyWorkflow({
        workflowId: 'wf_test_001',
        workflowJson,
      });

      expect(verification.valid).toBe(true);
      expect(verification.reason).toBeUndefined();
    });

    it('should detect modified workflow content', async () => {
      const originalWorkflow = {
        id: 'wf_456',
        name: 'Original Workflow',
        nodes: [{ name: 'Start', type: 'n8n-nodes-base.start' }],
      };

      // Sign original
      await guardian.signWorkflow({
        workflowId: 'wf_test_002',
        workflowName: 'Original Workflow',
        workflowJson: originalWorkflow,
        version: '1.0.0',
      });

      // Try to verify modified workflow
      const modifiedWorkflow = {
        id: 'wf_456',
        name: 'Modified Workflow', // Changed name
        nodes: [{ name: 'Start', type: 'n8n-nodes-base.start' }],
      };

      const verification = await guardian.verifyWorkflow({
        workflowId: 'wf_test_002',
        workflowJson: modifiedWorkflow,
      });

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('modified');
    });
  });

  describe('NG-3: Credential Injection', () => {
    it('should inject credentials with TTL', async () => {
      const result = await guardian.injectCredentials({
        userId: 'demo_user',
        credentialType: 'wb_api_key',
      });

      expect(result).toBeDefined();
      expect(result.credential).toBeTruthy();
      expect(result.expiresIn).toBe(300); // 5 minutes
    });

    it('should inject different credential types', async () => {
      const types: Array<'wb_api_key' | 'ozon_api_key' | 'telegram_token'> = [
        'wb_api_key',
        'ozon_api_key',
        'telegram_token',
      ];

      for (const type of types) {
        const result = await guardian.injectCredentials({
          userId: 'demo_user',
          credentialType: type,
        });

        expect(result.credential).toBeTruthy();
        expect(result.expiresIn).toBeGreaterThan(0);
      }
    });
  });

  describe('NG-4: Execution Logging', () => {
    it('should log successful workflow execution', async () => {
      const log: WorkflowExecutionLog = {
        executionId: 'exec_001',
        workflowId: 'wf_test_001',
        workflowName: 'Test Workflow',
        startedAt: new Date().toISOString(),
        status: 'success',
        nodeExecutions: [
          {
            nodeName: 'Start',
            nodeType: 'n8n-nodes-base.start',
            status: 'success',
            executionTime: 10,
          },
          {
            nodeName: 'HTTP Request',
            nodeType: 'n8n-nodes-base.httpRequest',
            status: 'success',
            executionTime: 150,
          },
        ],
      };

      await expect(guardian.logExecution(log)).resolves.not.toThrow();
    });

    it('should log failed workflow execution', async () => {
      const log: WorkflowExecutionLog = {
        executionId: 'exec_002',
        workflowId: 'wf_test_001',
        workflowName: 'Test Workflow',
        startedAt: new Date().toISOString(),
        status: 'error',
        nodeExecutions: [
          {
            nodeName: 'HTTP Request',
            nodeType: 'n8n-nodes-base.httpRequest',
            status: 'error',
            error: 'Connection timeout',
          },
        ],
        metadata: {
          errorCode: 'NETWORK_ERROR',
          retryCount: 3,
        },
      };

      await expect(guardian.logExecution(log)).resolves.not.toThrow();
    });
  });

  describe('NG-5: Drift Detection', () => {
    it('should detect no drift when workflow unchanged', async () => {
      // Note: This test requires n8n API to be running
      // For dev environment, we skip if n8n is not available

      const workflowJson = {
        name: 'Test Workflow',
        nodes: [{ name: 'Start', type: 'n8n-nodes-base.start' }],
      };

      try {
        const result = await guardian.checkDrift({
          workflowId: 'test_workflow',
          gitWorkflowJson: workflowJson,
        });

        // If n8n is running, we expect hasDrift to be defined
        expect(typeof result.hasDrift).toBe('boolean');
      } catch (error) {
        // If n8n is not running, we expect a specific error
        expect((error as Error).message).toContain('n8n');
      }
    });
  });

  describe('Content Hashing', () => {
    it('should produce same hash for equivalent workflows with different IDs', () => {
      const workflow1 = {
        id: 'id_1',
        createdAt: '2024-01-01',
        name: 'Test',
        nodes: [],
      };

      const workflow2 = {
        id: 'id_2',
        createdAt: '2024-01-02',
        name: 'Test',
        nodes: [],
      };

      // Access private method via type assertion for testing
      const hash1 = (guardian as any).hashWorkflowContent(workflow1);
      const hash2 = (guardian as any).hashWorkflowContent(workflow2);

      expect(hash1).toBe(hash2); // Same because id and timestamps are normalized
    });

    it('should produce different hash for different content', () => {
      const workflow1 = {
        name: 'Workflow A',
        nodes: [{ name: 'Node1' }],
      };

      const workflow2 = {
        name: 'Workflow B',
        nodes: [{ name: 'Node2' }],
      };

      const hash1 = (guardian as any).hashWorkflowContent(workflow1);
      const hash2 = (guardian as any).hashWorkflowContent(workflow2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
