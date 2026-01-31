import { promptBuilder } from './src/agent/core/PromptBuilder.js';
import { stateManager } from './src/agent/core/StateManager.js';
import { registerAllTools } from './src/agent/execution/index.js';
import { logger } from './src/api-lib/lib/logger.js';

async function dumpPrompt() {
  registerAllTools();
  const userId = 7548070478;
  const userState = await stateManager.getState(userId);
  const query =
    'Виктор, проанализируй мои товары. Найди те, где низкая маржа, и предложи для них SEO-оптимизацию заголовков, чтобы мы могли поднять цену и привлечь премиум-аудиторию. Какие шаги предпримем?';

  const prompt = await promptBuilder.buildPlannerPrompt(
    {
      userState,
      recentHistory: [],
      userId,
      isFirstContact: false,
    },
    query
  );

  console.log('--- PLANNER PROMPT ---');
  console.log(prompt);
  console.log('----------------------');
}

dumpPrompt();
