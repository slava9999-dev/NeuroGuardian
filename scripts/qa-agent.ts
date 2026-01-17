import 'dotenv/config';

// Force Direct Mode by removing OpenRouter key BEFORE imports initialize providers
// This must happen before any other imports that might use LLMProvider
if (process.env.GEMINI_API_KEY) {
  console.log('🔌 Disabling OpenRouter to force Google Direct API...');
  delete process.env.OPENROUTER_API_KEY;
}

// We need to use dynamic imports because static imports are hoisted and evaluated
// before the code above runs in ESM.

async function runQA() {
  // Import dependencies AFTER env modification
  const { multiAgentOrchestrator } =
    await import('../src/agent/specialists/MultiAgentOrchestrator.js');
  const { stateManager } = await import('../src/agent/core/StateManager.js');

  // Setup Mock User State
  const MOCK_USER_ID = 999;
  const MOCK_STATE = {
    userId: MOCK_USER_ID,
    productsCount: 50,
    hasApiKeys: true,
    marketplace: 'WB' as const,
    subscriptionTier: 'pro' as const,
    telegramId: 123456789,
    history: [],
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock StateManager
  (stateManager as any).getState = async () => MOCK_STATE;

  // Set provider to Gemini for consistency (RAG)
  process.env.RAG_PROVIDER = 'gemini';

  console.log('🤖 INITIALIZING AGENT QA SESSION...');
  console.log('====================================');

  // Specific RAG Check Questions for New 2025 Knowledge
  const QUESTIONS = [
    'Какие штрафы за самовыкупы на Wildberries в 2025 году?',
    'Что такое индекс ошибок на Ozon и какой штраф если он выше 10%?',
    'Как рассчитать стоимость логистики КГТ на WB? Напиши формулу.',
    'Какие есть стратегии защиты от конкурентов при атаке негативными отзывами?',
  ];

  for (const question of QUESTIONS) {
    console.log(`\n❓ ВОПРОС: "${question}"`);
    console.log('⏳ Думаю...');

    const start = Date.now();
    try {
      const result = await multiAgentOrchestrator.orchestrate(question, { userId: MOCK_USER_ID });

      const duration = Date.now() - start;
      const specialist = result.specialist;

      console.log(`👤 Специалист: ${specialist}`);
      console.log(`⏱️ Время: ${duration}ms`);

      console.log(`\n💡 ОТВЕТ:\n${result.message}`);
      console.log('------------------------------------');
    } catch (error) {
      console.error('❌ ОШИБКА:', error);
    }
  }
}

runQA();
