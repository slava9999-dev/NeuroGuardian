import { execSync } from 'child_process';
import { runHealthCheck } from './health-check-lib';
import { config } from '../../src/infrastructure/config/env.js';

async function main() {
  console.log('🚀 NEURO-GUARDIAN PRE-FLIGHT CHECKLIST');
  console.log('========================================');

  if (!config.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL is missing in config!');
    process.exit(1);
  }

  let failed = false;

  // 1. Static Analysis
  console.log('\n🔍 Phase 1: Static Analysis (Lint & Types)');
  try {
    console.log('   - Running Type Check...');
    execSync('npm run typecheck', { stdio: 'inherit' });
    console.log('   ✅ TypeScript is happy.');
  } catch {
    console.error('   ❌ TypeScript errors found!');
    failed = true;
  }

  // 2. Database Schema Sync
  console.log('\n📂 Phase 2: Database Schema Guard');
  try {
    console.log('   - Checking Schema Drift...');
    execSync('npx drizzle-kit check', { stdio: 'inherit' });
    console.log('   ✅ Database schema is synced with code.');
  } catch {
    console.error('   ❌ Database schema mismatch! Run `npm run db:push`');
    failed = true;
  }

  // 3. Infrastructure Health
  console.log('\n⚡ Phase 3: Infrastructure Pulse');
  try {
    const health = await runHealthCheck();
    if (!health.allOk) {
      console.error('   ❌ Infrastructure health check failed!', health.status);
      failed = true;
    } else {
      console.log('   ✅ Core services (DB, Crypto, Telegram) are operational.');
    }
  } catch (err) {
    console.error('   ❌ Critical error during health check:', err);
    failed = true;
  }

  // 4. Mission Critical Smoke Test
  console.log('\n🛡️ Phase 4: Sentinel Mission Stability');
  try {
    console.log('   - Running Sentinel Smoke Test...');
    execSync('npx tsx scripts/ops/smoke-sentinel.ts', { stdio: 'inherit' });
    console.log('   ✅ Sentinel core logic is stable.');
  } catch {
    console.error('   ❌ Sentinel Smoke Test failed! Critical regression detected.');
    failed = true;
  }

  // 5. Unit Tests
  console.log('\n🧪 Phase 5: Quality Assurance (Unit Tests)');
  try {
    console.log('   - Running Core Test Suite...');
    execSync('npm test', { stdio: 'inherit' });
    console.log('   ✅ Unit tests passed.');
  } catch {
    console.error('   ❌ Unit tests failed!');
    failed = true;
  }

  // 6. Production Build
  console.log('\n🔨 Phase 6: Production Build Readiness');
  try {
    console.log('   - Running Vite Build...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('   ✅ Build successful.');
  } catch {
    console.error('   ❌ Production build failed!');
    failed = true;
  }

  console.log('\n========================================');

  if (failed) {
    console.error('🔴 PRE-FLIGHT FAILED! Do not deploy.');
    process.exit(1);
  } else {
    console.log('🟢 PRE-FLIGHT COMPLETED! System is production-ready.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error during Pre-Flight:', err);
  process.exit(1);
});
