import { sql } from './src/api-lib/services/database.js';
async function run() {
  const r =
    await sql`SELECT * FROM agent_experiences WHERE type = 'agent_mistake' ORDER BY created_at DESC LIMIT 1`;
  console.log(JSON.stringify(r.rows, null, 2));
}
run().catch(console.error);
