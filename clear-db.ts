import { sql } from './src/api-lib/services/database.js';
async function run() {
  await sql`DELETE FROM agent_experiences`;
  console.log('✅ База опыта очищена для чистого теста.');
}
run().catch(console.error);
