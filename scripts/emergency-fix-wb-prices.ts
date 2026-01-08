/**
 * EMERGENCY SCRIPT: Fix WB prices that were set to 500,000+ RUB
 *
 * This script will restore correct prices for products
 * Run: npx tsx scripts/emergency-fix-wb-prices.ts
 */

import 'dotenv/config';
import { config } from 'dotenv';

// Also try .env.production
config({ path: '.env.production' });

// Products that need price fix (from WB Partner portal)
// ⚠️ EDIT THESE PRICES TO MATCH YOUR ACTUAL PRICES!
const PRODUCTS_TO_FIX = [
  { nmId: 704777082, correctPrice: 9500, name: 'Панно Геометрия' },
  { nmId: 705441279, correctPrice: 6500, name: 'Панно Горные вершины' },
  { nmId: 705453044, correctPrice: 4900, name: 'Панно Зимние горы' },
  { nmId: 718487946, correctPrice: 4000, name: 'Держатель 600мм' },
  { nmId: 718579408, correctPrice: 4300, name: 'Держатель 800мм' },
  { nmId: 718582195, correctPrice: 4500, name: 'Держатель 1000мм' },
  { nmId: 718820482, correctPrice: 5000, name: 'Держатель полотенец 1000мм' },
  { nmId: 718918284, correctPrice: 5000, name: 'Держатель полотенец 1000мм #2' },
];

async function fixPrices() {
  // Try to get API key from environment
  const apiKey = process.env.WB_API_KEY;

  if (!apiKey) {
    console.error('❌ WB_API_KEY not found!');
    console.log('');
    console.log('Please set WB_API_KEY:');
    console.log('  1. Add to .env or .env.production file');
    console.log(
      '  2. Or run: set WB_API_KEY=your_key && npx tsx scripts/emergency-fix-wb-prices.ts'
    );
    process.exit(1);
  }

  console.log('🚨 EMERGENCY: Fixing WB prices...\n');
  console.log('Products to fix:');
  PRODUCTS_TO_FIX.forEach(p => {
    console.log(`  - ${p.nmId}: ${p.name} → ${p.correctPrice}₽`);
  });
  console.log('');

  // Build payload - prices in KOPECKS (fixed API)
  const payload = {
    data: PRODUCTS_TO_FIX.map(p => ({
      nmId: p.nmId,
      price: p.correctPrice * 100, // Convert to kopecks!
      discount: 0,
    })),
  };

  console.log('📡 Sending payload to WB API...');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://discounts-prices-api.wildberries.ru/api/v2/upload/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`\n📡 Response (${response.status}):`, responseText);

    if (response.ok) {
      console.log('\n✅ Prices submitted successfully!');
      console.log('⚠️  Note: WB processes price changes asynchronously.');
      console.log('   Check WB Partner portal in 1-2 minutes to verify.');
    } else {
      console.log('\n❌ Failed to update prices!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run
console.log('═══════════════════════════════════════════════════════');
console.log('  🚨 EMERGENCY WB PRICE FIX SCRIPT');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('This will update prices for the listed products.');
console.log('Make sure the prices in PRODUCTS_TO_FIX are correct!');
console.log('');

fixPrices();
