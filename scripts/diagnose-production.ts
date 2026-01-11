#!/usr/bin/env npx ts-node

/**
 * Production Diagnostics — Check all critical systems
 * Usage: npx ts-node scripts/diagnose-production.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'https://neuro-guardian.vercel.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

interface DiagResult {
  component: string;
  status: 'OK' | 'WARN' | 'FAIL';
  details: string;
  fix?: string;
}

const results: DiagResult[] = [];

async function check(
  name: string,
  fn: () => Promise<{ ok: boolean; details: string; fix?: string }>
) {
  try {
    const result = await fn();
    results.push({
      component: name,
      status: result.ok ? 'OK' : 'FAIL',
      details: result.details,
      fix: result.fix,
    });
  } catch (error) {
    results.push({
      component: name,
      status: 'FAIL',
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  🔍 NEUROGUARDIAN PRODUCTION DIAGNOSTICS');
  console.log('='.repeat(60));
  console.log(`  API: ${API_BASE}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  // 1. API Health
  await check('API Health', async () => {
    const res = await fetch(`${API_BASE}/api?action=health`);
    const data = await res.json();
    return {
      ok: res.ok && data.status === 'ok',
      details: `Status: ${data.status}, Version: ${data.version || 'unknown'}`,
    };
  });

  // 2. Telegram Webhook
  await check('Telegram Webhook', async () => {
    if (!ADMIN_KEY) {
      return { ok: false, details: 'ADMIN_API_KEY not set', fix: 'Add ADMIN_API_KEY to .env' };
    }

    const res = await fetch(`${API_BASE}/api?action=telegram-webhook-info`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const data = await res.json();

    const webhookUrl = data.url || '';

    if (!webhookUrl) {
      return {
        ok: false,
        details: 'Webhook not set',
        fix: `curl -X POST "${API_BASE}/api?action=telegram-set-webhook" -H "X-Admin-Key: $ADMIN_KEY"`,
      };
    }

    if (data.last_error_message) {
      return {
        ok: false,
        details: `Webhook error: ${data.last_error_message}`,
        fix: 'Check bot token and server availability',
      };
    }

    const urlMatches = webhookUrl.includes('neuro-guardian');
    return {
      ok: urlMatches,
      details: `URL: ${webhookUrl}, Pending: ${data.pending_update_count || 0}`,
      fix: urlMatches ? undefined : `Run: telegram-set-webhook to update URL`,
    };
  });

  // 3. Environment Variables
  await check('Environment Variables', async () => {
    const required = ['TELEGRAM_BOT_TOKEN', 'DATABASE_URL', 'GROQ_API_KEY', 'ADMIN_API_KEY'];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      return {
        ok: false,
        details: `Missing: ${missing.join(', ')}`,
        fix: 'Add missing variables to Vercel/env files',
      };
    }

    return { ok: true, details: 'All required variables present' };
  });

  // 4. CRON Configuration
  await check('CRON Jobs', async () => {
    const fs = await import('fs');
    const vercelJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8')
    );

    interface CronConfig {
      path: string;
      schedule: string;
    }
    const crons: CronConfig[] = vercelJson.crons || [];
    const checkPrices = crons.find(c => c.path.includes('check-prices'));

    const issues: string[] = [];

    if (!checkPrices) {
      issues.push('check-prices CRON missing');
    } else if (checkPrices.schedule === '0 9 * * *') {
      issues.push('check-prices runs only once/day (should be every 2h for Sentinel)');
    }

    if (crons.length > 1) {
      issues.push(`⚠️ ${crons.length} CRONs defined. Vercel Hobby allows only 1 daily!`);
    }

    return {
      ok: issues.length === 0,
      details: issues.length > 0 ? issues.join('; ') : `${crons.length} CRON(s) configured`,
      fix: issues.length > 0 ? 'Update vercel.json or upgrade Vercel plan' : undefined,
    };
  });

  // 5. Database Connection
  await check('Database', async () => {
    if (!ADMIN_KEY) {
      return { ok: false, details: 'Need ADMIN_KEY to test', fix: 'Add ADMIN_API_KEY' };
    }

    // Use admin endpoint to verify DB
    const res = await fetch(`${API_BASE}/api?action=admin-list-users&limit=1`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        details: `Connected. Users in DB: ${data.total || data.users?.length || 'unknown'}`,
      };
    }

    return {
      ok: false,
      details: `Status: ${res.status}`,
      fix: 'Check DATABASE_URL in Vercel',
    };
  });

  // 6. LLM (Groq/OpenRouter)
  await check('LLM Provider', async () => {
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    const providers = [];
    if (hasOpenRouter) providers.push('OpenRouter');
    if (hasGroq) providers.push('Groq');
    if (hasOpenAI) providers.push('OpenAI');

    if (providers.length === 0) {
      return {
        ok: false,
        details: 'No LLM API key found',
        fix: 'Add GROQ_API_KEY or OPENROUTER_API_KEY',
      };
    }

    return { ok: true, details: `Available: ${providers.join(', ')}` };
  });

  // Print Results
  console.log('\n📋 DIAGNOSTIC RESULTS\n' + '-'.repeat(40));

  let hasFailures = false;
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${r.component}: ${r.status}`);
    console.log(`   ${r.details}`);
    if (r.fix) {
      console.log(`   💡 Fix: ${r.fix}`);
    }
    if (r.status === 'FAIL') hasFailures = true;
    console.log('');
  }

  console.log('='.repeat(60));
  if (hasFailures) {
    console.log('❌ PRODUCTION HAS ISSUES — Fix the items above');
    process.exit(1);
  } else {
    console.log('✅ ALL SYSTEMS OPERATIONAL');
    process.exit(0);
  }
}

main().catch(console.error);
