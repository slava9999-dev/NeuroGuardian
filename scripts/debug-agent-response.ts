/**
 * Deep Debug Agent Response
 * Shows FULL response to understand what's happening
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_BASE = 'https://neuro-guardian.vercel.app/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const TEST_USER_ID = 7548070478;

async function main() {
  console.log('🔬 Deep Agent Debug\n');

  const res = await fetch(`${API_BASE}?action=agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: JSON.stringify({
      message: 'Привет, кто ты?',
      telegramId: TEST_USER_ID,
      history: [],
    }),
  });

  console.log('HTTP Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));

  const data = await res.json();
  console.log('\n📦 FULL RESPONSE:');
  console.log(JSON.stringify(data, null, 2));

  // Check for error
  if (data.error) {
    console.log('\n❌ ERROR DETECTED:', data.error);
  }

  // Check content field vs message field
  console.log('\n📝 Content fields:');
  console.log('   data.content:', data.content);
  console.log('   data.message:', data.message);
  console.log('   data.response:', data.response);
  console.log('   data.answer:', data.answer);
}

main().catch(console.error);
