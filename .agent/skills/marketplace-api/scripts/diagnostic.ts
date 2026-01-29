import { config } from '../../../../src/infrastructure/config/env.js';

async function diagnoseMarketplace() {
  console.log('📊 Diagnosing Marketplace Intelligence Skill...');
  try {
    const wbKey = config.WB_API_KEY;
    const ozonKey = config.OZON_API_KEY;

    console.log(`- WB_API_KEY present: ${!!wbKey}`);
    console.log(`- OZON_API_KEY present: ${!!ozonKey}`);

    const { sql } = await import('../../../../src/api-lib/services/database.js');
    try {
      await sql`SELECT 1`;
      console.log('- Database Connection: ✅ OK');
    } catch (e: unknown) {
      const error = e as Error;
      console.error('- Database Connection: ❌ Failed', error.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Marketplace Diagnostic Failed:', error);
    process.exit(1);
  }
}

diagnoseMarketplace();
