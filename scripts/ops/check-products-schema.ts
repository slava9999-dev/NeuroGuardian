import { sql } from '../../src/api-lib/services/database.js';

async function checkSchema() {
  console.log('--- Table: products ---');
  const columns = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'products'
  `;
  console.table(columns.rows);

  console.log('\n--- Constraints: products ---');
  const constraints = await sql`
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE contype IN ('u', 'p') AND conrelid = 'products'::regclass
  `;
  console.table(constraints.rows);

  console.log('\n--- Indexes: products ---');
  const indexes = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'products'
  `;
  console.table(indexes.rows);

  process.exit(0);
}

checkSchema().catch(console.error);
