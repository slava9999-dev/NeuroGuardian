/**
 * Direct local test of Multi-Agent Orchestrator
 * Bypasses HTTP layer to see exact errors
 *
 * Run: npx tsx scripts/test-orchestrator-direct.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

// Import orchestrator directly
import { multiAgentOrchestrator } from '../src/agent/specialists/MultiAgentOrchestrator.js';
import type { OrchestratorContext } from '../src/core/types/agent.types.js';

async function main() {
  console.log('🧪 Direct Orchestrator Test');
  console.log('='.repeat(60));

  // Check env vars
  console.log('\n📋 Environment Check:');
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(
    `   GOOGLE_GENERATIVE_AI_API_KEY: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✅ Set' : '❌ NOT SET'}`
  );

  const context: OrchestratorContext = {
    userId: 7548070478,
    userName: 'Test User',
    isFirstContact: false,
  };

  console.log('\n🚀 Testing orchestrate("Привет, кто ты?")...\n');

  try {
    const result = await multiAgentOrchestrator.orchestrate('Привет, кто ты?', context);

    console.log('📦 Result:');
    console.log(`   success: ${result.success}`);
    console.log(`   specialist: ${result.specialist}`);
    console.log(`   intent: ${result.intent.category} (${result.intent.confidence})`);
    console.log(`   tokensUsed: ${result.tokensUsed}`);
    console.log(`   message: ${result.message?.substring(0, 200)}...`);

    if (result._debug) {
      console.log('\n❌ Debug Info (error occurred):');
      console.log(`   error: ${result._debug.error}`);
      console.log(`   at: ${result._debug.at}`);
    }

    if (!result.success) {
      console.log('\n⚠️ Orchestrator returned failure!');
    } else {
      console.log('\n✅ Orchestrator SUCCESS!');
    }
  } catch (error) {
    console.error('\n💥 EXCEPTION:', error);
  }
}

main().catch(console.error);
