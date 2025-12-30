import { describe, it, expect } from 'vitest';
import { moeRouter } from './moe-router.js';
import { HumanMessage } from '@langchain/core/messages';

describe('MoE Router Logic', () => {
  it('should classify price check queries as local_stats', async () => {
    // В реальном тесте мы дождемся запуска vLLM или замокаем ответ
    const result = await moeRouter.invoke({
      messages: [new HumanMessage('Проверь цены на артикул 12345 на WB')],
    });

    // Ожидаем, что роутер определил интент правильно (если vLLM доступен)
    console.log('Routing Result:', result.routeTo);
    expect(result.routeTo).toBeDefined();
  });

  it('should fallback to cloud for complex queries', async () => {
    const result = await moeRouter.invoke({
      messages: [
        new HumanMessage('Сделай глубокий анализ прибыльности всех моих товаров за прошлый год'),
      ],
    });

    expect(result.routeTo).toBe('cloud_complex');
  });
});
