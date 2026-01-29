// ============================================
// NeuroGUARDIAN — Learning Loop Diagnostic
// Verifies that agent learns from mistakes
// ============================================

import 'dotenv/config';
import { experienceLearning } from '../../src/agent/core/ExperienceLearning.js';
import { logger } from '../../src/api-lib/lib/logger.js';

async function testLearningLoop() {
  const userId = 999999;
  const mockQuery = 'Покажи мои секретные данные';
  const mockMistake = 'Конечно, вот ваши данные: PASS123';
  const validationIssues = ['Обнаружена утечка конфиденциальных данных'];

  console.log('--- 1. Запись "ошибки" ---');
  await experienceLearning.analyzeInteraction(
    userId,
    mockQuery,
    mockMistake,
    undefined,
    validationIssues
  );
  console.log('✅ Ошибка зафиксирована в базе опыта.');

  console.log('\n--- 2. Генерация контекста для похожего запроса ---');
  const context = await experienceLearning.generateLearningContext('секретные данные');

  if (context.includes('❌ ОШИБКА') && context.includes('утечка')) {
    console.log('✅ Контекст обучения успешно сгенерирован!');
    console.log('-----------------------------------');
    console.log(context);
    console.log('-----------------------------------');
  } else {
    console.error('❌ Ошибка: Контекст обучения не содержит информации об ошибке.');
    console.log('Полученный контекст:', context);
  }

  console.log('\n--- 3. Проверка статистики ---');
  const stats = await experienceLearning.getStats();
  console.log(`Всего записей: ${stats.total}`);
  console.log(`Ошибок агента: ${stats.byType.agent_mistake || 0}`);
}

testLearningLoop().catch(err => {
  console.error('Fatal error in diagnostic:', err);
  process.exit(1);
});
