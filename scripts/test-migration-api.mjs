// Quick test to check migration API response
import 'dotenv/config';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const API_URL = 'https://neuro-guardian.vercel.app';

async function testMigration() {
  console.log('🔍 Testing migration API...\n');
  
  const response = await fetch(`${API_URL}/api?action=run-migration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_API_KEY,
    },
    body: JSON.stringify({
      migration: '017',
    }),
  });
  
  const result = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(result, null, 2));
}

testMigration().catch(console.error);
