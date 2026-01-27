import 'dotenv/config';
import fs from 'fs';
import { BrowserEyes } from '../src/sentinel/BrowserEyes.ts';
import { vectorStore } from '../src/infrastructure/rag/VectorStore.ts';
import { logger } from '../src/api-lib/lib/index.ts';

async function testEyes() {
  const eyes = new BrowserEyes();

  // Тестовый товар: Популярный крем/техника
  const testUrl = 'https://www.wildberries.ru/catalog/14697332/detail.aspx';

  console.log('👁️  Starting Digital Vision Test on Server...');
  console.log(`🔗 Target: ${testUrl}`);

  try {
    await eyes.init();

    console.log('📸 Navigating to product page...');
    const result = await eyes.gazeAtProduct('WB', testUrl, {
      useVision: true,
      saveScreenshot: true, // Запрашиваем скриншот
    });

    // Save screenshot for visual debugging
    if (result.screenshotUrl) {
      const base64Data = result.screenshotUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync('wb_server_view.png', base64Data, 'base64');
      console.log(`🖼️  Server-side screenshot saved to: wb_server_view.png`);
    }
    console.log(`💰 Buyer Price (Final): ${result.buyerPrice} ₽`);
    console.log(`🏷️  Original Price: ${result.originalPrice} ₽`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`🛠️  Method Used: ${result.extractionMethod}`);

    if (result.screenshotUrl) {
      console.log(`🖼️  Visual verification successful. Screenshot captured.`);
    }

    await eyes.close();
    console.log('\n✅ Vision Module: OK');

    console.log('\n🧠 Testing "Central Brain" (Vector Search)...');
    const searchResult = await vectorStore.search('как сентинел защищает цены?', { limit: 1 });

    if (searchResult.length > 0) {
      console.log('✅ Brain is active and remembers everything!');
      console.log(`📝 Found reference: "${searchResult[0].content.substring(0, 100)}..."`);
    } else {
      console.log('⚠️  Brain is empty or search failed.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Vision Module FAILED:', err);
    process.exit(1);
  }
}

testEyes();
