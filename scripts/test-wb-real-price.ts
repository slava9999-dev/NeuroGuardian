#!/usr/bin/env npx tsx
/**
 * Test WB Real Price Parser
 * Check if card.wb.ru returns real buyer price
 */

import 'dotenv/config';
import { PriceParserService } from '../src/api-lib/core-services/PriceParserService.js';

async function testWbPrice() {
  console.log('\n🔍 TESTING WB REAL PRICE PARSER\n');
  console.log('='.repeat(60));

  const parser = new PriceParserService();

  // Test products (from your catalog)
  const testNmIds = [
    705441279, // Панно «Горные вершины»
    705453044, // Панно «Зимние горы»
    718579408, // Держатель 800мм
  ];

  for (const nmId of testNmIds) {
    console.log(`\n📦 Testing nmId: ${nmId}`);
    console.log('-'.repeat(40));

    try {
      const result = await parser.getWbRealPrice(nmId);

      console.log(`   Title: ${result.title}`);
      console.log(`   💰 Seller Price (базовая): ${result.sellerPrice}₽`);
      console.log(`   👀 Buyer Price (со скидкой): ${result.buyerPrice}₽`);

      if (result.sellerPrice > 0 && result.buyerPrice > 0) {
        const discount = Math.round(
          ((result.sellerPrice - result.buyerPrice) / result.sellerPrice) * 100
        );
        console.log(`   📉 SPP Скидка: ${discount}%`);
        console.log(`   ✅ SUCCESS - Prices fetched!`);
      } else {
        console.log(`   ⚠️ WARNING: Zero prices returned`);
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete\n');
}

testWbPrice().catch(console.error);
