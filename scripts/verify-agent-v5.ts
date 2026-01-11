// ============================================
// NeuroGUARDIAN — Agent V5 Verification Script
// ============================================

import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
  console.log('Loaded .env.production');
} else {
  dotenv.config();
  console.log('Loaded default .env');
}

import { registerAllTools } from '../src/agent/execution/index.js';
import { agentOrchestratorV5 } from '../src/agent/core/AgentOrchestratorV5.js';
import { OrchestratorContext } from '../src/core/types/agent.types.js';

// MOCK LLM to bypass missing keys/local service
// @ts-expect-error - overriding private method for testing
agentOrchestratorV5.callPlanner = async (_systemPrompt: string, userMessage: string) => {
  console.log('[MockPlanner] Received request');
  if (userMessage.includes('экономику')) {
    return {
      success: true,
      plan: {
        reasoning: 'Нужно рассчитать юнит-экономику товара.',
        tools: [
          {
            tool: 'calculate_unit_economics',
            args: { cost_price: 500, selling_price: 1500, marketplace: 'WB' },
          },
        ],
        requiresConfirmation: false,
      },
      tokensUsed: 100,
    };
  }
  if (userMessage.includes('комиссии')) {
    return {
      success: true,
      plan: {
        reasoning: 'Это информационный вопрос, используем RAG (search_web).',
        tools: [
          {
            tool: 'search_web',
            args: { query: 'комиссии вб 2026' },
          },
        ],
        requiresConfirmation: false,
      },
      tokensUsed: 50,
    };
  }
  return { success: false, error: 'Mock planner: Unknown intent' };
};

// @ts-expect-error - overriding private method for testing
agentOrchestratorV5.generateAnswer = async (
  _originalMessage: string,
  toolResults: Array<{ tool: string; success?: boolean; data?: unknown }>,
  _userState: unknown
) => {
  console.log('[MockAnswerer] Generating answer based on tool results');
  if (toolResults.some(r => r.tool === 'calculate_unit_economics')) {
    return {
      message:
        'При себестоимости 500р и цене 1500р, с учетом комиссий ВБ (~15%) и логистики, чистая прибыль составит около 600р.',
      tokensUsed: 50,
    };
  }
  if (toolResults.some(r => r.tool === 'search_web')) {
    return {
      message: 'Базовые комиссии Wildberries варьируются от 15% до 23% в зависимости от категории.',
      tokensUsed: 50,
    };
  }
  return { message: 'Mock answer', tokensUsed: 10 };
};

async function verify() {
  console.log('🚀 Starting Agent V5 Verification...');

  // 1. Setup
  try {
    registerAllTools();
  } catch {
    console.log('Note: Tools might already be registered');
  }

  const userId = 1; // Test user
  const context: OrchestratorContext = {
    userId,
    userName: 'Tester',
    isFirstContact: true,
  };

  // 2. Test Generic Question (RAG check)
  console.log('\n--- 📝 Test 1: Generic Question (RAG) ---');
  const msg1 = 'Какие комиссии на Wildberries?';
  console.log(`User: ${msg1}`);

  const result1 = await agentOrchestratorV5.orchestrate(msg1, context, []);
  console.log(`Agent: ${result1.message}`);
  if (result1.message.includes('комисси') || result1.message.includes('Wildberries')) {
    console.log('✅ Generic question test passed!');
  } else {
    console.log('❌ Generic question test failed or response too generic.');
  }

  // 3. Test Tool Execution (Economics)
  console.log('\n--- 📊 Test 2: Tool Execution (Economics) ---');
  const msg2 = 'Рассчитай экономику для товара с себестоимостью 500 рублей и ценой 1500';
  console.log(`User: ${msg2}`);

  const result2 = await agentOrchestratorV5.orchestrate(msg2, context, [
    { role: 'user', content: msg1, timestamp: new Date() },
    { role: 'assistant', content: result1.message, timestamp: new Date() },
  ]);

  console.log(`Agent: ${result2.message}`);
  console.log('Tools called:', result2.toolsCalled);

  if (result2.toolsCalled.includes('calculate_unit_economics')) {
    console.log('✅ Economics tool test passed!');
  } else {
    console.log('❌ Economics tool NOT called.');
  }

  console.log('\n--- 🏁 Verification Finished ---');
}

verify().catch(console.error);
