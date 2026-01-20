import { browserEyes } from '../src/sentinel/BrowserEyes.js';

async function testBrowserEyes() {
  console.log('--- Testing BrowserEyes (Real Browser Vision) ---\n');

  const testCases = [
    {
      name: 'WB Product (In Stock)',
      marketplace: 'WB' as const,
      url: 'https://www.wildberries.ru/catalog/153373282/detail.aspx',
    },
    // Uncomment to test Ozon
    // {
    //   name: 'Ozon Product',
    //   marketplace: 'Ozon' as const,
    //   url: 'https://www.ozon.ru/product/...',
    // },
  ];

  for (const testCase of testCases) {
    console.log(`\n📦 Testing: ${testCase.name}`);
    console.log(`🔗 URL: ${testCase.url}\n`);

    try {
      const result = await browserEyes.gazeAtProduct(testCase.marketplace, testCase.url, {
        useVision: false, // Set to true to enable Vision AI fallback
      });

      console.log('✅ Extraction Result:');
      console.log(JSON.stringify(result, null, 2));

      if (result.buyerPrice) {
        console.log(`\n💰 Buyer Price: ${result.buyerPrice} ₽`);
        if (result.originalPrice) {
          const discount = Math.round(
            ((result.originalPrice - result.buyerPrice) / result.originalPrice) * 100
          );
          console.log(`🏷️  Original Price: ${result.originalPrice} ₽ (${discount}% off)`);
        }
        console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`🔧 Method: ${result.extractionMethod}`);
      } else {
        console.log('⚠️  Warning: Price not found!');
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }
  }

  // Cleanup
  await browserEyes.close();
  console.log('\n✅ Browser closed. Test complete.');
}

testBrowserEyes().catch(console.error);
