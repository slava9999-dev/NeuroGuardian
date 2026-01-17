import { sql } from '../../src/api-lib/services/database.js';

async function checkUsersSchema() {
  const res =
    await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`;
  console.table(res.rows);
  process.exit(0);
}

checkUsersSchema().catch(console.error);
