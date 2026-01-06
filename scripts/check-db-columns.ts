import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  console.log('📋 СХЕМА ТАБЛИЦЫ PRODUCTS:');
  const res = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    ORDER BY ordinal_position
  `;
  for (const row of res.rows) {
    console.log(`   ${row.column_name}: ${row.data_type}`);
  }
  
  console.log('\n📋 СХЕМА ТАБЛИЦЫ USERS:');
  const usersRes = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `;
  for (const row of usersRes.rows) {
    console.log(`   ${row.column_name}: ${row.data_type}`);
  }
}

main().catch(console.error);
