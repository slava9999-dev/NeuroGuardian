import 'dotenv/config';

// Force Direct Mode
if (process.env.GEMINI_API_KEY) {
  delete process.env.OPENROUTER_API_KEY;
}

async function testSupport() {
  const { multiAgentOrchestrator } =
    await import('../src/agent/specialists/MultiAgentOrchestrator.js');
  const { stateManager } = await import('../src/agent/core/StateManager.js');
  const { experienceLearning } = await import('../src/agent/core/ExperienceLearning.js');
  const { sql } = await import('../src/api-lib/services/database.js');
  const { responseValidator } = await import('../src/agent/core/ResponseValidator.js');
  const { memoryManager } = await import('../src/agent/core/MemoryManager.js');

  // Mock SQL is tricky since it's a constant export.
  // We'll rely on mocking the managers instead.

  // Mock Managers to avoid actual DB calls
  (memoryManager as any).saveMessage = async () => {};
  (memoryManager as any).getRecentHistory = async () => [];
  (experienceLearning as any).analyzeInteraction = async () => {};

  const MOCK_USER_ID = 888;

  // Define type for MOCK_STATE to avoid 'any'
  interface MockState {
    userId: number;
    productsCount: number;
    hasApiKeys: boolean;
    marketplace: 'WB' | 'Ozon' | 'both' | null;
    subscriptionTier: 'free' | 'basic' | 'pro';
    telegramId: number;
    history: string[];
    lastActivity: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  const MOCK_STATE: MockState = {
    userId: MOCK_USER_ID,
    productsCount: 0,
    hasApiKeys: false,
    marketplace: null,
    subscriptionTier: 'free',
    telegramId: 888888,
    history: [],
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  (stateManager.getState as any) = async () => MOCK_STATE;

  console.log('🧪 TESTING ACTIVE SUPPORT SYSTEM...');
  console.log('====================================');

  const messages = [
    'Привет, кто ты?',
    'Я хочу чтоб ты по шагам помог мне всё настроить и синхронизировать товары',
    'Синхронизируй мои товары',
    'Я ничего не понимаю, тут всё слишком сложно! Ошибка какая-то везде.',
    'Спасибо, стало понятнее.',
  ];

  for (const msg of messages) {
    console.log(`\n👤 USER: "${msg}"`);
    try {
      const result = await multiAgentOrchestrator.orchestrate(msg, { userId: MOCK_USER_ID });
      console.log(`🤖 VIKTOR: ${result.message}`);
      console.log(`📍 Specialist: ${result.specialist}`);
      if (result.toolsCalled && result.toolsCalled.length > 0) {
        console.log(`🛠 Tools: ${result.toolsCalled.join(', ')}`);
      }
    } catch (err) {
      console.error(`❌ ORCHESTRATION FAILED:`, err);
    }
  }

  console.log('\n📊 CHECKING LEARNING STATS...');
  const stats = await experienceLearning.getStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));

  const mistakes = await experienceLearning.getCommonMistakes(3);
  console.log('\n❌ DETECTED ISSUES/COMPLAINTS:');
  mistakes.forEach(m =>
    console.log(`- [${m.type}] Query: "${m.userQuery}" (Count: ${m.frequency})`)
  );
}

testSupport().catch(console.error);
