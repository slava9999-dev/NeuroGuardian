import { sql } from '../../src/api-lib/services/database.js';

async function checkAccounts() {
  const userId = '1600992954';

  const res = await sql`
    SELECT id, user_id, marketplace, account_name, created_at 
    FROM marketplace_accounts 
    WHERE user_id = ${userId}
  `;

  console.log('🏦 Marketplace accounts for Alexander (1600992954):');
  console.table(res.rows);

  process.exit(0);
}

checkAccounts().catch(err => {
  console.error(err);
  process.exit(1);
});
