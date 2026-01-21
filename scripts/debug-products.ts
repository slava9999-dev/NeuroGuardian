#!/usr/bin/env npx tsx
/**
 * Debug Products - Check stocks and competitor URLs
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function debugProducts() {
  console.log('\n🔍 DEBUG: PRODUCTS & COMPETITORS\n');
  console.log('='.repeat(60));

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('❌ No database URL found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.replace(/\r/g, '').trim(),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // 1. Check WB products with stocks
    console.log('\n📦 WB PRODUCTS:\n');
    const wbProducts = await pool.query(`
      SELECT 
        title,
        current_price,
        current_stock,
        competitor_url,
        competitor_price,
        updated_at
      FROM products 
      WHERE marketplace = 'WB'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    wbProducts.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.title?.substring(0, 40)}...`);
      console.log(`   💰 Price: ${row.current_price}₽ | 📦 Stock: ${row.current_stock}`);
      console.log(`   🎯 Competitor URL: ${row.competitor_url || '❌ НЕ УКАЗАН'}`);
      console.log(`   🕐 Updated: ${row.updated_at}`);
      console.log('');
    });

    // 2. Check how many have competitor_url
    console.log('\n📊 COMPETITOR URLS SUMMARY:\n');
    const competitorStats = await pool.query(`
      SELECT 
        marketplace,
        COUNT(*) as total,
        COUNT(competitor_url) as with_competitor,
        COUNT(*) - COUNT(competitor_url) as without_competitor
      FROM products 
      GROUP BY marketplace
    `);

    competitorStats.rows.forEach(row => {
      console.log(`${row.marketplace}: ${row.with_competitor}/${row.total} с конкурентами`);
    });

    // 3. Check marketplace_accounts encryption
    console.log('\n\n🔐 MARKETPLACE ACCOUNTS (API KEYS):\n');
    const accounts = await pool.query(`
      SELECT 
        id,
        name,
        marketplace,
        is_active,
        wb_token IS NOT NULL as has_wb_token,
        ozon_api_key IS NOT NULL as has_ozon_key,
        LENGTH(wb_token) as wb_token_length,
        LEFT(wb_token, 30) as wb_token_preview
      FROM marketplace_accounts
      LIMIT 5
    `);

    accounts.rows.forEach(row => {
      console.log(`Account #${row.id}: ${row.name} (${row.marketplace})`);
      console.log(`   Active: ${row.is_active}`);
      console.log(`   WB Token: ${row.has_wb_token ? `✅ (${row.wb_token_length} chars)` : '❌'}`);
      console.log(`   Ozon Key: ${row.has_ozon_key ? '✅' : '❌'}`);
      if (row.wb_token_preview) {
        const isEncrypted = row.wb_token_preview.includes(':');
        console.log(
          `   Encrypted: ${isEncrypted ? '🔒 YES (needs decryption)' : '⚠️ NO (plaintext)'}`
        );
      }
      console.log('');
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug complete\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await pool.end();
  }
}

debugProducts().catch(console.error);
