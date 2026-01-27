import pkg from 'pg';
const { Client } = pkg;

async function test() {
  const connectionString =
    'postgresql://neondb_owner:npg_oTBa8XY0mjyQ@ep-late-salad-agr4ecke.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 as ping');
    console.log('Neon DB reachable:', res.rows[0].ping);
    await client.end();
  } catch (e) {
    console.error('Neon DB unreachable:', e.message);
  }
}
test();
