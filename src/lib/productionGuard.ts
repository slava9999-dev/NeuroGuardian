// Production safety guard - import this in entry points
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

if (isProduction) {
  // Check 1: TEST_MODE must be disabled
  if (process.env.TEST_MODE === 'true') {
    throw new Error(
      'FATAL: TEST_MODE=true in production environment. ' + 'Deployment blocked for safety.'
    );
  }

  // Check 2: Dangerous operations must be disabled
  if (process.env.DANGEROUS_OPERATIONS_ENABLED === 'true') {
    throw new Error(
      'FATAL: DANGEROUS_OPERATIONS_ENABLED=true in production. ' + 'Deployment blocked.'
    );
  }
}

export const PRODUCTION_VERIFIED = true;
