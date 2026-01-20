import { sentinelAgent } from '../src/sentinel/SentinelAgent.js';

async function testSentinel() {
  console.log('🛡️ Testing Sentinel Agent\n');

  const alerts = await sentinelAgent.monitorAllProducts();

  console.log(`\n📊 Found ${alerts.length} alerts\n`);

  alerts.forEach(alert => {
    console.log(sentinelAgent.formatTelegramAlert(alert));
    console.log('\n---\n');
  });
}

testSentinel().catch(console.error);
