import { sql } from './src/api-lib/services/database.js';
async function check() {
  const r =
    await sql`SELECT user_query, frequency FROM agent_experiences WHERE user_query ILIKE '%цена на озон%' OR user_query ILIKE '%озон цена%'`;
  console.log(JSON.stringify(r.rows, null, 2));
}
check().catch(console.error);
