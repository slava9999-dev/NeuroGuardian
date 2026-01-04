import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function checkSecrets() {
  console.log('🔍 Проверка секретов в таблице users...');

  const users = await sql`
    SELECT 
      id, 
      username, 
      first_name, 
      (api_key_wb IS NOT NULL AND api_key_wb <> '') as has_wb,
      (api_key_ozon IS NOT NULL AND api_key_ozon <> '') as has_ozon,
      (ozon_client_id IS NOT NULL AND ozon_client_id <> '') as has_ozon_id
    FROM users
    WHERE is_active = true
  `;

  console.table(users.rows);
}

checkSecrets().catch(console.error);
