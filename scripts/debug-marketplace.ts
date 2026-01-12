import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
process.env.DEBUG = 'true';

// Dynamic import AFTER env load
const { marketplaceService } = await import('../src/api-lib/core-services/MarketplaceService.js');

async function testMarketplace() {
  const userId = 7548070478;
  console.log(`🔍 Testing MarketplaceService for User ${userId}`);
  console.log(`🔑 API_KEY_ENCRYPTION_KEY present: ${!!process.env.API_KEY_ENCRYPTION_KEY}`);
  if (process.env.API_KEY_ENCRYPTION_KEY) {
    console.log(`🔑 Key length: ${process.env.API_KEY_ENCRYPTION_KEY.length}`);
  }

  // Test WB
  console.log('\n--- WB Test ---');
  try {
    const startWb = Date.now();
    // Use some known nmIds or just generic test if we don't have list
    // We will try with a dummy list or try to fetch products first to get IDs
    const products = await marketplaceService.fetchProducts(userId, 'WB', 5);
    console.log(`✅ WB Products Fetched in ${Date.now() - startWb}ms. Count: ${products.length}`);

    if (products.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nmIds = products
        .map((p: any) => p.nm_id)
        .filter((id: any): id is number => id !== undefined);
      console.log(`Fetching prices for: ${nmIds.join(', ')}`);
      const priceStart = Date.now();
      const prices = await marketplaceService.fetchCurrentPrices(userId, 'WB', nmIds);
      console.log(
        `✅ WB Prices Fetched in ${Date.now() - priceStart}ms. Count: ${prices.prices.size}`
      );
      if (prices.errors) console.error('WB Errors:', prices.errors);
    }
  } catch (e) {
    console.error('❌ WB Test Failed:', e);
  }

  // Test Ozon
  console.log('\n--- Ozon Test ---');
  try {
    const startOzon = Date.now();
    const products = await marketplaceService.fetchProducts(userId, 'Ozon', 5);
    console.log(
      `✅ Ozon Products Fetched in ${Date.now() - startOzon}ms. Count: ${products.length}`
    );

    if (products.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = products.map((p: any) => p.product_id); // product_id
      console.log(`Fetching prices for: ${ids.join(', ')}`);
      const priceStart = Date.now();
      const prices = await marketplaceService.fetchCurrentPrices(userId, 'Ozon', ids);
      console.log(
        `✅ Ozon Prices Fetched in ${Date.now() - priceStart}ms. Count: ${prices.prices.size}`
      );
      if (prices.errors) console.error('Ozon Errors:', prices.errors);
    }
  } catch (e) {
    console.error('❌ Ozon Test Failed:', e);
  }
}

testMarketplace()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
