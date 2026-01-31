import { browserEyes } from '../src/sentinel/BrowserEyes.js';
import { logger } from '../src/api-lib/lib/logger.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(process.cwd(), '.env') });

const TEST_URL = 'https://www.wildberries.ru/catalog/718643211/detail.aspx';
const EXPECTED_PRICE_RANGE = [2800, 3100]; // Around 2965

async function runDiagnose() {
  console.log('👁️ STARTING DIGITAL VISION DIAGNOSTIC (LOCAL MODE) 👁️');
  console.log(`Target: ${TEST_URL}`);

  // FORCE LOCAL MODE: Unset Browserless URL to test proxy directly from this machine
  delete process.env.BROWSERLESS_URL;

  console.log('------------------------------------------------');

  try {
    console.log('1. Initializing BrowserEyes...');
    await browserEyes.init();

    console.log('2. Gazing at product (Strategy: DOM + Vision)...');

    // Force "Vision" mode if DOM fails, but let's see raw output first
    const startTime = Date.now();
    const result = await browserEyes.gazeAtProduct('WB', TEST_URL, {
      useVision: true, // Force vision check
      maxRetries: 2,
    });

    const duration = Date.now() - startTime;

    console.log('------------------------------------------------');
    console.log('✅ EXTRACTION COMPLETE');
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log('------------------------------------------------');
    console.log('📊 RESULTS:');
    console.log(JSON.stringify(result, null, 2));
    console.log('------------------------------------------------');

    if (
      result.buyerPrice &&
      result.buyerPrice >= EXPECTED_PRICE_RANGE[0] &&
      result.buyerPrice <= EXPECTED_PRICE_RANGE[1]
    ) {
      console.log('✅ SUCCESS: Detected price matches REAL buyer price!');
    } else {
      console.log('❌ FAILURE: Detected price mismatch.');
      console.log(`   Expect: ~${2965}`);
      console.log(`   Got:    ${result.buyerPrice}`);
      console.log('   Possible Failure Causes:');
      console.log('   1. Selectors outdated (WB updated layout)');
      console.log('   2. Bot protection (blocked/captcha)');
      console.log('   3. Proxy latency/failure');
    }
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
  } finally {
    console.log('🔌 Closing browser...');
    await browserEyes.close();
    process.exit(0);
  }
}

runDiagnose();
