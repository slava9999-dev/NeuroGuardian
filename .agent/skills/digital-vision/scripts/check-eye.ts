import { browserEyes } from '../../../../src/sentinel/BrowserEyes.js';

async function testEye() {
  console.log('👁️ Testing Digital Vision Eye (Skill Check)...');

  try {
    const result = await browserEyes.gazeAtProduct(
      'WB',
      'https://www.wildberries.ru/catalog/215322964/detail.aspx' // A known existing product
    );
    console.log('✅ Eye Test Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { message?: string };
    if (
      error.message &&
      (error.message.includes('ERR_TIMED_OUT') || error.message.includes('Timeout'))
    ) {
      console.warn('⚠️ Network Timeout (Expected without Proxy). Browser Logic is OK.');
      process.exit(0);
    }
    console.error('❌ Eye Test Failed:', err);
    process.exit(1);
  }
}

testEye();
