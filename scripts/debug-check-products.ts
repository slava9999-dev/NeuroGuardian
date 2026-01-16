import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  try {
    const telegramId = 7548070478;
    const userRes = await sql`SELECT id, first_name FROM users WHERE telegram_id = ${telegramId}`;

    if (userRes.rows.length === 0) {
      console.log('User not found');
      return;
    }

    const userId = userRes.rows[0].id;
    console.log(`User found: ${userRes.rows[0].first_name} (ID: ${userId})`);

    const productsRes =
      await sql`SELECT id, product_id, title, marketplace, current_price, current_stock FROM products WHERE user_id = ${userId}`;
    console.log(`Products in DB: ${productsRes.rows.length}`);

    if (productsRes.rows.length > 0) {
      console.table(productsRes.rows.slice(0, 5));
    }

    const accountsRes =
      await sql`SELECT id, name, marketplace, is_active FROM marketplace_accounts WHERE user_id = ${userId}`;
    console.log(`Marketplace accounts: ${accountsRes.rows.length}`);
    console.table(accountsRes.rows);
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
