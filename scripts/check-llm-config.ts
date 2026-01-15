/**
 * Check which LLM API keys are configured on production
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_BASE = 'https://neuro-guardian.vercel.app/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;

async function main() {
  console.log('🔍 Checking LLM configuration on production...\n');

  // Call agent-status to see what's configured
  const statusRes = await fetch(`${API_BASE}?action=agent-status`, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  const status = await statusRes.json();
  console.log('Agent Status:', JSON.stringify(status, null, 2));

  // Call health to see degraded modules
  const healthRes = await fetch(`${API_BASE}?action=health`);
  const health = await healthRes.json();
  console.log('\nHealth:', JSON.stringify(health, null, 2));

  // Try to get more info about the error
  console.log('\n🔬 Making direct agent call with verbose error handling...');

  const agentRes = await fetch(`${API_BASE}?action=agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: JSON.stringify({
      message: 'test',
      telegramId: 7548070478,
      history: [],
    }),
  });

  const agent = await agentRes.json();
  console.log('\nAgent Response:', JSON.stringify(agent, null, 2));

  // Check if there's an error field we're missing
  console.log('\nAll response keys:', Object.keys(agent));
}

main().catch(console.error);
