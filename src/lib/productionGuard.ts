// ============================================
// NeuroGUARDIAN — Production Safety Guard
// Prevents dangerous configurations in production
// ============================================

/**
 * Production Safety Guard
 *
 * This module MUST be imported in the application entry point.
 * It performs critical safety checks at startup and will throw
 * fatal errors if dangerous configurations are detected in production.
 *
 * AUDIT-2025-12-28: Created as part of production readiness initiative
 */

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

/**
 * Performs production safety checks.
 * Throws on critical violations.
 */
export function verifyProductionSafety(): void {
  if (!IS_PRODUCTION) {
    console.log('🧪 Development mode - production guards bypassed');
    return;
  }

  console.log('🔒 Running production safety checks...');

  // Check 1: TEST_MODE must be disabled in production
  if (process.env.TEST_MODE === 'true') {
    throw new Error(
      'FATAL: TEST_MODE=true in production environment. ' +
        'This bypasses payment requirements and is a critical security issue. ' +
        'Deployment blocked for safety. ' +
        'Remove TEST_MODE from production environment variables.'
    );
  }

  // Check 2: DANGEROUS_OPERATIONS must be disabled
  if (process.env.DANGEROUS_OPERATIONS_ENABLED === 'true') {
    throw new Error(
      'FATAL: DANGEROUS_OPERATIONS_ENABLED=true in production. ' +
        'This allows destructive database operations. ' +
        'Deployment blocked for safety.'
    );
  }

  // Check 3: MOCK_MODE must not be enabled
  if (process.env.MOCK_MODE === 'true') {
    throw new Error(
      'FATAL: MOCK_MODE=true in production. ' +
        'This returns fake data instead of real marketplace data. ' +
        'Deployment blocked for safety.'
    );
  }

  // Check 4: Required secrets must be present
  const requiredSecrets = ['TELEGRAM_BOT_TOKEN'];

  const missingSecrets = requiredSecrets.filter(key => !process.env[key]);

  if (missingSecrets.length > 0) {
    console.warn(
      `⚠️ WARNING: Missing recommended secrets: ${missingSecrets.join(', ')}. ` +
        'Some features may not work correctly.'
    );
  }

  // Check 5: Database URL must be configured
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'FATAL: No database URL configured in production. ' +
        'Set POSTGRES_URL or DATABASE_URL environment variable.'
    );
  }

  console.log('✅ Production safety checks passed');
}

/**
 * Guard for mock data access in production.
 * Use this wrapper around any mock data generators.
 */
export function guardMockAccess(context: string): never {
  if (IS_PRODUCTION) {
    throw new Error(
      `CRITICAL: Mock data access attempted in production (${context}). ` +
        'This indicates a missing API implementation or incorrect code path. ' +
        'All data must come from real sources in production.'
    );
  }

  // This should never be reached, but TypeScript needs the never type
  throw new Error(`Mock access guard reached unexpectedly: ${context}`);
}

/**
 * Safe wrapper for test-only functionality.
 * Returns null in production instead of mock data.
 */
export function testOnlyData<T>(data: T, context: string): T | null {
  if (IS_PRODUCTION) {
    console.warn(`⚠️ Test-only data requested in production: ${context}`);
    return null;
  }
  return data;
}

/**
 * Verification flag that can be imported to ensure this module was loaded.
 * Use in entry points: `import { PRODUCTION_VERIFIED } from './productionGuard'`
 */
export const PRODUCTION_VERIFIED = true;

// Run checks immediately when module is imported
// This ensures checks run before any other code
if (typeof window === 'undefined') {
  // Only run in Node.js environment (API routes)
  try {
    verifyProductionSafety();
  } catch (error) {
    console.error('❌ PRODUCTION SAFETY CHECK FAILED:', error);
    // In production, this will crash the serverless function
    // which is the intended behavior - we don't want to serve
    // with dangerous configurations
    if (IS_PRODUCTION) {
      throw error;
    }
  }
}
