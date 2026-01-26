import { browserEyes } from '../../../../src/sentinel/BrowserEyes.js';
import { logger } from '../../../../src/api-lib/lib/logger.js';

async function testEye() {
  console.log('👁️ Testing Digital Vision Eye (Skill Check)...');

  try {
    const result = await browserEyes.gazeAtProduct(
      'WB',
      'https://www.wildberries.ru/catalog/123456/detail.aspx'
    );
    console.log('✅ Eye Test Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Eye Test Failed:', err);
    process.exit(1);
  }
}

testEye();
