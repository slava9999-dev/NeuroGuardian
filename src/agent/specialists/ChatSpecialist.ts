// ============================================
// NeuroGUARDIAN — Chat Specialist
// Handles FAQ, onboarding, and general help
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext, type SpecialistResult } from './BaseSpecialist.js';
import { knowledgeBase } from '../core/KnowledgeBase.js';

export class ChatSpecialist extends BaseSpecialist {
  readonly name = 'ChatSpecialist';
  readonly description = 'Handles FAQ, onboarding, greetings, and general help';

  // No tools - uses RAG only
  readonly tools: string[] = [];

  readonly systemPrompt = `# Виктор — Помощник

Ты дружелюбный помощник NeuroGUARDIAN:
- Отвечаешь на вопросы о системе
- Помогаешь с онбордингом
- Объясняешь функции
- Общаешься на общие темы о маркетплейсах

## ПРАВИЛА:
1. Будь дружелюбным и профессиональным
2. Используй знания из базы знаний
3. Если не знаешь ответ — честно скажи
4. Направляй к нужным разделам приложения

## ФОРМАТ ОТВЕТА:
- Будь кратким но полезным
- Используй эмодзи для настроения
- Предлагай следующие шаги

## О СИСТЕМЕ:
NeuroGUARDIAN — это AI-ассистент для управления товарами на Wildberries и Ozon.
Основные функции:
- 🛡️ Sentinel — автоматическая защита цен
- 📊 Аналитика — юнит-экономика, ABC-анализ
- 🤖 Виктор — AI-помощник (это ты!)`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- API ключи: ${context.userState.hasApiKeys ? '✅ настроены' : '❌ не настроены'}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    // If no API keys, suggest onboarding
    if (!context.userState.hasApiKeys) {
      lines.push('\n⚠️ Пользователю нужен ОНБОРДИНГ — у него нет API ключей!');
    }

    return lines.join('\n');
  }

  /**
   * Override execute to use RAG instead of tools
   */
  async execute(query: string, context: SpecialistContext): Promise<SpecialistResult> {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // 1. Build context
      const contextStr = await this.buildContext(context);

      // 2. Search knowledge base for relevant info
      const kbDocs = await knowledgeBase.search(query, 3);
      let kbContext = '';

      if (kbDocs.length > 0) {
        kbContext = '\n\n## РЕЛЕВАНТНЫЕ ЗНАНИЯ:\n';
        for (const doc of kbDocs) {
          kbContext += `### ${doc.title}\n${doc.content.slice(0, 500)}\n\n`;
        }
      }

      // 3. Call LLM (no tools)
      const response = await this.llm.complete([
        {
          role: 'system',
          content: `${this.systemPrompt}\n\n${contextStr}${kbContext}`,
        },
        {
          role: 'user',
          content: query,
        },
      ]);

      tokensUsed = response.tokensUsed;
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        message: response.content,
        toolsCalled: [],
        toolResults: [],
        tokensUsed,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      return {
        success: false,
        message: `Произошла ошибка. Попробуйте ещё раз или обратитесь в поддержку.`,
        toolsCalled: [],
        toolResults: [],
        tokensUsed,
        latencyMs,
      };
    }
  }
}

export const chatSpecialist = new ChatSpecialist();
