/**
 * ============================================
 * Security Agent - Core Types
 * ============================================
 * Type definitions for the entire Security Agent SDK
 * ============================================
 */

import { z } from 'zod';

// ============================================
// Secrets Guard Types
// ============================================

export const SecretAccessRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  key: z.string().min(1, 'key is required'),
  purpose: z.string().min(1, 'purpose is required'),
  ttl: z.number().int().positive().max(3600).default(300), // Max 1 hour, default 5 min
  metadata: z.record(z.string()).optional(),
});

export type SecretAccessRequest = z.infer<typeof SecretAccessRequestSchema>;

export interface SecretAccessResponse {
  value: string;
  expiresAt: Date;
  leaseId: string;
  renewable: boolean;
}

export interface SecretMetadata {
  key: string;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  rotationSchedule?: string;
  version: number;
}

// ============================================
// Audit Types
// ============================================

export const AuditEventSchema = z.object({
  event: z.string().min(1),
  category: z.enum(['security', 'data', 'auth', 'admin', 'workflow']),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  userId: z.string().min(1),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export interface AuditLogEntry extends AuditEvent {
  id: string;
  traceId: string;
  timestamp: Date;
  userIp?: string;
  userAgent?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
  signature: string;
  signatureVersion: number;
}

export interface AuditQueryOptions {
  userId?: string;
  event?: string;
  category?: AuditEvent['category'];
  severity?: AuditEvent['severity'];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// Authorization Types
// ============================================

export const PermissionSchema = z.enum([
  // Price operations
  'price:read',
  'price:update',
  'price:bulk_update',

  // Inventory operations
  'inventory:read',
  'inventory:update',

  // Stop-loss operations
  'stoploss:read',
  'stoploss:set',
  'stoploss:delete',

  // Product operations
  'product:read',
  'product:sync',

  // Analytics
  'analytics:read',
  'analytics:export',

  // Admin operations
  'admin:read',
  'admin:write',
  'admin:users',
  'admin:secrets',

  // Workflow operations
  'workflow:read',
  'workflow:execute',
  'workflow:modify',

  // AI Agent operations
  'agent:chat',
  'agent:execute',
  'agent:confirm',
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const AuthzCheckRequestSchema = z.object({
  userId: z.string().min(1),
  requiredPermissions: z.array(PermissionSchema).min(1),
  resource: z
    .object({
      type: z.string(),
      id: z.string().optional(),
      ownerId: z.string().optional(),
    })
    .optional(),
});

export type AuthzCheckRequest = z.infer<typeof AuthzCheckRequestSchema>;

export interface AuthzCheckResponse {
  allowed: boolean;
  missingPermissions: Permission[];
  reason?: string;
  cachedUntil?: Date;
}

export interface UserPermissions {
  userId: string;
  permissions: Permission[];
  roles: string[];
  expiresAt?: Date;
}

// ============================================
// Rate Limiting Types
// ============================================

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
  userId: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}

// ============================================
// n8n Guardian Types
// ============================================

export interface WorkflowSignature {
  workflowId: string;
  workflowName: string;
  hash: string;
  signature: string;
  signedAt: Date;
  signedBy: string;
  version: number;
}

export interface WorkflowValidationResult {
  valid: boolean;
  error?: string;
  signedAt?: Date;
  signedBy?: string;
}

export interface CredentialInjectionRequest {
  workflowId: string;
  nodeId: string;
  credentialType: string;
  userId: string;
  ttl: number;
}

// ============================================
// Security Incident Types
// ============================================

export const SecurityIncidentSchema = z.object({
  type: z.enum([
    'secret_leak',
    'auth_bypass',
    'rate_limit_exceeded',
    'injection_attempt',
    'unauthorized_access',
    'data_breach',
    'workflow_tampering',
    'signature_mismatch',
  ]),
  severity: z.enum(['P0', 'P1', 'P2']),
  title: z.string().min(1),
  description: z.string().min(1),
  affectedUsers: z.array(z.string()).optional(),
  affectedResources: z.array(z.string()).optional(),
  detectionMethod: z.string(),
  autoRemediation: z.boolean().default(false),
  remediationActions: z.array(z.string()).optional(),
});

export type SecurityIncident = z.infer<typeof SecurityIncidentSchema>;

// ============================================
// Configuration Types
// ============================================

export interface SecurityAgentConfig {
  // Vault configuration
  vault: {
    address: string;
    token?: string;
    namespace?: string;
    tlsEnabled: boolean;
  };

  // ClickHouse configuration
  clickhouse: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };

  // Redis configuration
  redis: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
  };

  // General settings
  environment: 'development' | 'staging' | 'production';
  signingKey: string; // For HMAC signatures
  enableLeakDetection: boolean;
  permissiveMode: boolean; // Allow operations even if checks fail (for testing)
}

// ============================================
// Error Types
// ============================================

export class SecurityAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityAgentError';
  }
}

export class SecretAccessDeniedError extends SecurityAgentError {
  constructor(key: string, reason: string) {
    super(`Access to secret '${key}' denied: ${reason}`, 'SECRET_ACCESS_DENIED', 403, {
      key,
      reason,
    });
    this.name = 'SecretAccessDeniedError';
  }
}

export class AuthorizationError extends SecurityAgentError {
  constructor(userId: string, missingPermissions: Permission[]) {
    super(
      `User '${userId}' lacks required permissions: ${missingPermissions.join(', ')}`,
      'AUTHORIZATION_DENIED',
      403,
      { userId, missingPermissions }
    );
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends SecurityAgentError {
  constructor(userId: string, endpoint: string, resetAt: Date) {
    super(
      `Rate limit exceeded for user '${userId}' on endpoint '${endpoint}'`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { userId, endpoint, resetAt: resetAt.toISOString() }
    );
    this.name = 'RateLimitError';
  }
}

export class SecretLeakDetectedError extends SecurityAgentError {
  constructor(context: string) {
    super(`CRITICAL: Potential secret leak detected in ${context}`, 'SECRET_LEAK_DETECTED', 500, {
      context,
    });
    this.name = 'SecretLeakDetectedError';
  }
}

export class WorkflowSignatureError extends SecurityAgentError {
  constructor(workflowId: string, reason: string) {
    super(
      `Workflow '${workflowId}' signature validation failed: ${reason}`,
      'WORKFLOW_SIGNATURE_INVALID',
      403,
      { workflowId, reason }
    );
    this.name = 'WorkflowSignatureError';
  }
}
