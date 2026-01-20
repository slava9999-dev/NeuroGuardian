import { digitalEyes } from '../src/sentinel/DigitalEyes.js';

async function testDigitalEyes() {
  console.log('--- Testing DigitalEyes (LLM Vision) ---');

  // Use a known WB product URL (e.g., a phone case or something common)
  const wbUrl = 'https://www.wildberries.ru/catalog/153373282/detail.aspx'; // Example from previous script
  console.log(`\nGazing at WB: ${wbUrl}`);

  try {
    const result = await digitalEyes.gazeAtProduct('WB', wbUrl);
    console.log('👁️ Vision Result:', JSON.stringify(result, null, 2));

    if (result && result.buyerPrice > 0) {
      console.log('✅ Success: Price found!');
    } else {
      console.log('⚠️ Warning: Price might be missing or 0');
    }
  } catch (error) {
    console.error('❌ Error gazing at product:', error);
  }
}

testDigitalEyes().catch(console.error);
