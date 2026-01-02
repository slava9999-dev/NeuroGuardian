// Check subscription tiers
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function checkTiers() {
  try {
    console.log('🔍 Checking subscription tiers...\n');

    const tiers = await sql`
      SELECT tier, name_ru, price_monthly, max_products, max_accounts, is_popular
      FROM subscription_tiers
      ORDER BY display_order
    `;

    console.log(`✅ Found ${tiers.rows.length} tiers:\n`);
    tiers.rows.forEach((tier) => {
      const popular = tier.is_popular ? '⭐' : '  ';
      console.log(
        `${popular} ${tier.tier.padEnd(10)} | ${tier.name_ru.padEnd(20)} | ${tier.price_monthly.toString().padStart(6)}₽/мес | ${tier.max_products.toString().padStart(6)} товаров | ${tier.max_accounts} магазинов`
      );
    });

    console.log('\n✅ Subscription system is ready!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkTiers();
