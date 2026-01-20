import { sql } from '../src/api-lib/services/database.js';

const result = await sql`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'products'
  ORDER BY ordinal_position
`;

console.log('Products table columns:');
console.log(result.rows.map(r => r.column_name).join(', '));
