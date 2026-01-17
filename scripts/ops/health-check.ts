import { runHealthCheck } from './health-check-lib.js';
import { config } from '../../src/infrastructure/config/env.js';

async function main() {
  console.log('🛡️  NEURO-GUARDIAN SYSTEM PULSE');
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`🌐 Env: ${config.NODE_ENV}\n`);

  const { status, allOk } = await runHealthCheck();

  console.log(`Config:   🟢 OK`);
  console.log(`Database: ${status.database ? '🟢 OK' : '🔴 FAILED'}`);
  console.log(`Crypto:   ${status.crypto ? '🟢 OK' : '🔴 FAILED'}`);
  console.log(`Telegram: ${status.telegram ? '🟢 OK' : '🔴 FAILED'}`);

  if (allOk) {
    console.log('\n✅ ALL SYSTEMS OPERATIONAL.');
    process.exit(0);
  } else {
    console.log('\n❌ SYSTEM DEGRADED. Check credentials.');
    process.exit(1);
  }
}

main();
