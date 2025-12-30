import { inngest } from '../lib/inngest.js';
import { moeRouter } from '../agent/moe-router.js';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Основная функция обработки запросов через MoE Router
 */
export const processMoEQuery = inngest.createFunction(
  { id: 'moe-query-processor', name: 'MoE Query Processor' },
  { event: 'ai/query.received' },
  async ({ event, step }) => {
    const { query } = event.data;

    // 1. Классификация интента через локальный роутер
    const routingResult = await step.run('classify-intent', async () => {
      const state = await moeRouter.invoke({
        messages: [new HumanMessage(query)],
      });
      return {
        intent: state.intent,
        routeTo: state.routeTo,
        confidence: state.confidence,
      };
    });

    // 2. Маршрутизация на основе интента
    if (routingResult.routeTo === 'local_stats') {
      // Здесь будет вызов локального воркера или специализированного инструмента
      return await step.run('handle-local-stats', async () => {
        // Mock: в реальности здесь будет сигнал локальному воркеру
        return { source: 'local', result: 'Price check initiated locally' };
      });
    }

    if (routingResult.routeTo === 'local_chat') {
      return await step.run('handle-local-chat', async () => {
        // Здесь вызов локальной Llama-3 или Phi-3
        return { source: 'local_llm', result: 'Hello from local intelligence!' };
      });
    }

    // 3. Фоллбэк на облако (Gemini) для сложных задач
    return await step.run('handle-cloud-complex', async () => {
      // Здесь вызов существующего orchestrator-v4
      return { source: 'cloud_gemini', result: 'Complex analysis performed via Gemini' };
    });
  }
);

/**
 * Фоновая проверка цен (Heavy Task)
 */
export const backgroundPriceCheck = inngest.createFunction(
  { id: 'background-price-check', name: 'Background Price Check' },
  { event: 'marketplace/price.check' },
  async ({ event, step }) => {
    const { items } = event.data;

    // Группировка товаров и асинхронная проверка
    const results = await step.run('process-items', async () => {
      return items.map((sku: string) => ({ sku, status: 'queued' }));
    });

    return { processed: items.length, results };
  }
);
