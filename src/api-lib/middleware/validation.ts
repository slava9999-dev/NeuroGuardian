// ============================================
// NeuroGUARDIAN — API Validation Middleware
// Centralized Zod validation for all API endpoints
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z, ZodError } from 'zod';
import type { ZodSchema } from 'zod';
import { logger } from '../lib/logger.js';

// ============================================
// Validation Error Response
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationErrorResponse {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR';
  details: ValidationError[];
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validates request body against a Zod schema.
 * Returns parsed data if valid, or sends 400 response if invalid.
 */
export async function validateBody<T>(
  req: VercelRequest,
  res: VercelResponse,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    const data = schema.parse(req.body);
    return data;
  } catch (error) {
    if (error instanceof ZodError) {
      const details: ValidationError[] = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      logger.warn('API validation failed', {
        path: req.url,
        method: req.method,
        errors: details,
      });

      const response: ValidationErrorResponse = {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
      };

      res.status(400).json(response);
      return null;
    }
    throw error;
  }
}

/**
 * Validates query parameters against a Zod schema.
 */
export async function validateQuery<T>(
  req: VercelRequest,
  res: VercelResponse,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    const data = schema.parse(req.query);
    return data;
  } catch (error) {
    if (error instanceof ZodError) {
      const details: ValidationError[] = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      logger.warn('API query validation failed', {
        path: req.url,
        method: req.method,
        errors: details,
      });

      const response: ValidationErrorResponse = {
        success: false,
        error: 'Query validation failed',
        code: 'VALIDATION_ERROR',
        details,
      };

      res.status(400).json(response);
      return null;
    }
    throw error;
  }
}

// ============================================
// Common Reusable Schemas
// ============================================

// Positive integer ID
export const idSchema = z.coerce.number().int().positive();

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Product ID (WB: number, Ozon: string)
export const productIdSchema = z.union([
  z.coerce.number().int().positive(),
  z.string().min(1).max(50),
]);

// Price (positive number with 2 decimal places max)
export const priceSchema = z.coerce.number().positive().multipleOf(0.01);

// Optional price (can be null)
export const optionalPriceSchema = z.coerce
  .number()
  .positive()
  .multipleOf(0.01)
  .nullable()
  .optional();

// Marketplace type
export const marketplaceSchema = z.enum(['wb', 'ozon']);

// Task ID format: task_123456_abc12
export const taskIdSchema = z.string().regex(/^task_\d+_[a-z0-9]{5}$/, {
  message: 'Invalid taskId format. Expected: task_<timestamp>_<random>',
});

// Boolean from query string
export const booleanQuerySchema = z.preprocess(
  val => val === 'true' || val === '1' || val === true,
  z.boolean()
);

// ============================================
// Product Schemas
// ============================================

export const batchSetStopLossSchema = z.object({
  productIds: z.array(productIdSchema).min(1).max(100),
  minPrice: priceSchema,
});

export const batchUpdateCostsSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: productIdSchema.optional(),
        barcode: z.string().min(1).max(50).optional(),
        costPrice: priceSchema,
        minMargin: z.coerce.number().min(0).max(100).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const updateProductSchema = z.object({
  productId: productIdSchema,
  minPrice: optionalPriceSchema,
  costPrice: optionalPriceSchema,
  minMargin: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Payment Schemas
// ============================================

export const createPaymentSchema = z.object({
  planId: z.enum(['basic', 'pro', 'enterprise']),
  returnUrl: z.string().url().optional(),
});

// ============================================
// Settings Schemas
// ============================================

export const updateSettingsSchema = z.object({
  notifications: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  language: z.enum(['ru', 'en']).optional(),
  timezone: z.string().max(50).optional(),
});

// ============================================
// Agent Schemas
// ============================================

export const agentMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

export const agentConfirmSchema = z.object({
  taskId: taskIdSchema,
  confirm: z.boolean(),
});

// ============================================
// Marketplace Account Schemas
// ============================================

export const addMarketplaceAccountSchema = z.object({
  marketplace: marketplaceSchema,
  apiKey: z.string().min(10).max(500),
  clientId: z.string().max(100).optional(), // Required for Ozon
  name: z.string().max(100).optional(),
});

export const deleteMarketplaceAccountSchema = z.object({
  accountId: idSchema,
});

// ============================================
// Sentinel Schemas
// ============================================

export const sentinelActionSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume']),
});

export const addCompetitorSchema = z.object({
  productId: productIdSchema,
  competitorUrl: z.string().url(),
  strategy: z.enum(['monitor', 'aggressive', 'defensive']).default('monitor'),
});

// ============================================
// Export all schemas
// ============================================

export const schemas = {
  // Products
  batchSetStopLoss: batchSetStopLossSchema,
  batchUpdateCosts: batchUpdateCostsSchema,
  updateProduct: updateProductSchema,

  // Payments
  createPayment: createPaymentSchema,

  // Settings
  updateSettings: updateSettingsSchema,

  // Agent
  agentMessage: agentMessageSchema,
  agentConfirm: agentConfirmSchema,

  // Marketplace
  addMarketplaceAccount: addMarketplaceAccountSchema,
  deleteMarketplaceAccount: deleteMarketplaceAccountSchema,

  // Sentinel
  sentinelAction: sentinelActionSchema,
  addCompetitor: addCompetitorSchema,

  // Common
  pagination: paginationSchema,
  taskId: taskIdSchema,
};
