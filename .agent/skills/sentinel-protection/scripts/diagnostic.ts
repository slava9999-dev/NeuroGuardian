async function diagnoseSentinel() {
  console.log('🛡️ Diagnosing Sentinel Protection Skill...');
  try {
    console.log('- Sentinel Orchestrator Module: Loading...');
    const { sentinelOrchestrator } =
      await import('../../../../src/sentinel/SentinelOrchestrator.js');

    // Check key config values
    const checkInterval = process.env.SENTINEL_CHECK_INTERVAL_CRON || 'Not Set';
    console.log(`- Cron Schedule: ${checkInterval}`);

    if (!sentinelOrchestrator) {
      throw new Error('SentinelOrchestrator singleton failed to export');
    }
    console.log('- Singleton Instance: ✅ OK');

    process.exit(0);
  } catch (error) {
    console.error('❌ Sentinel Diagnostic Failed:', error);
    process.exit(1);
  }
}

diagnoseSentinel();
