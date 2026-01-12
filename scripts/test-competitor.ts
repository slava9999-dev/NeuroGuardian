import {
  fetchWbCompetitorData,
  extractNmIdFromUrl,
} from '../src/api-lib/services/competitor-monitor.js';

async function testCompetitorMonitor() {
  console.log('--- Testing WB Competitor Monitor v4 ---');

  // Test Case 1: In-stock WB SKU
  const testNmId = 153373282;
  console.log(`Fetching data for NM_ID: ${testNmId}...`);

  const result = await fetchWbCompetitorData(testNmId);

  if (result) {
    console.log('✅ Success!');
    console.log(`Price: ${result.price} RUB`);
    console.log(`Basic Price: ${result.basicPrice} RUB`);
    console.log(`Stock: ${result.stock}`);
    console.log(`Available: ${result.available}`);
  } else {
    console.log('❌ Failed to fetch data.');
  }

  // Test Case 2: Out of stock SKU
  const outOfStockId = 171804364;
  console.log(`\nFetching data for Out of Stock NM_ID: ${outOfStockId}...`);
  const result2 = await fetchWbCompetitorData(outOfStockId);
  if (result2) {
    console.log(
      `✅ Success (found product)! Price: ${result2.price} RUB, Available: ${result2.available}`
    );
  } else {
    console.log('❌ Failed to fetch out of stock product.');
  }
}

testCompetitorMonitor().catch(console.error);
