import 'dotenv/config';
import { experienceLearning } from '../../src/agent/core/ExperienceLearning.js';

async function stressTest() {
  const userId = 888777;

  console.log('--- 1. Тест дедупликации (нормализация ID) ---');
  await experienceLearning.analyzeInteraction(userId, 'цена на озон', 'ответ', undefined, [
    'ошибка 1',
  ]);
  await experienceLearning.analyzeInteraction(userId, 'озон цена на', 'ответ', undefined, [
    'ошибка 1',
  ]);

  const stats = await experienceLearning.getStats();
  console.log(`Объектов в базе: ${stats.total}`);

  console.log('\n--- 2. Тест ранжирования (Frequency Weighting) ---');
  // Добавляем частую ошибку
  await experienceLearning.analyzeInteraction(userId, 'критическая проблема', 'ответ', undefined, [
    'ОШИБКА 911',
  ]);
  await experienceLearning.analyzeInteraction(userId, 'критическая проблема', 'ответ', undefined, [
    'ОШИБКА 911',
  ]);

  // Добавляем редкую ошибку
  await experienceLearning.analyzeInteraction(userId, 'мелкий баг', 'ответ', undefined, ['баг']);

  const context = await experienceLearning.generateLearningContext('проблема баг');
  console.log('Результат контекста (первой должна быть ОШИБКА 911):');
  console.log(context);

  console.log('\n--- 3. Тест стоп-слов ---');
  const emptyContext = await experienceLearning.generateLearningContext('плиз сделай мне');
  if (!emptyContext) {
    console.log('✅ Стоп-слова успешно отфильтрованы (контекст пуст для мусорного запроса).');
  } else {
    console.log('❌ Ошибка: стоп-слова не отфильтрованы.');
  }
}

stressTest().catch(console.error);
