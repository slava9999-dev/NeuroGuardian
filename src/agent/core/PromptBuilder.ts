// ============================================
// NeuroGUARDIAN — Dynamic Prompt Builder
// Assembles prompts dynamically from modules
// Reduces token usage by 70%
// Version: 5.1.0 | Date: January 2026
// ============================================

import type { UserState, ChatMessage, ToolDefinition } from '../../core/types/agent.types.js';
import { toolRegistry } from '../execution/ToolRegistry.js';
import { knowledgeBase } from './KnowledgeBase.js';
import { memoryManager } from './MemoryManager.js';
import { experienceLearning } from './ExperienceLearning.js';
import { logger } from '../../api-lib/lib/logger.js';

/**
 * Prompt context for building
 */
interface PromptContext {
  userState: UserState;
  recentHistory: ChatMessage[];
  relevantKnowledge?: string[];
  isFirstContact?: boolean;
  userId?: number; // For memory retrieval
}

/**
 * Prompt Builder - Assembles prompts dynamically
 *
 * Instead of a 570-line static prompt, we build:
 * - Core personality (20 tokens)
 * - User state context (10-20 tokens)
 * - Relevant knowledge via RAG (30-50 tokens)
 * - Recent history (50-100 tokens)
 * - Tool descriptions (filtered, 50-100 tokens)
 *
 * Total: ~150-290 tokens vs 1500+ tokens
 */
export class PromptBuilder {
  /**
   * Build knowledge context (RAG)
   */
  private async buildKnowledgeContext(query: string): Promise<string> {
    try {
      if (!query) return '';

      const docs = await knowledgeBase.search(query, 2);

      if (docs.length === 0) return '';

      const context = docs.map(d => `SOURCE: ${d.title}\n${d.content}`).join('\n\n');

      return `## РЕЛЕВАНТНЫЕ ЗНАНИЯ (RAG)
<KNOWLEDGE_BASE>
${context}
</KNOWLEDGE_BASE>`;
    } catch (error) {
      logger.warn('RAG Error', { error });
      return '';
    }
  }

  /**
   * Build memory context from long-term memory
   * This retrieves stored facts about the user and their business
   */
  private async buildMemoryContext(userId: number, query: string): Promise<string> {
    try {
      const lines: string[] = [];

      // 1. Get user preferences
      const preferences = await memoryManager.getUserPreferences(userId);
      if (Object.keys(preferences).length > 0) {
        lines.push('## 📝 ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ');
        lines.push('Ты помнишь об этом пользователе:');
        for (const [key, value] of Object.entries(preferences)) {
          lines.push(`- ${key}: ${value}`);
        }
      }

      // 2. Search for relevant facts based on query
      const relevantFacts = await memoryManager.searchRelevantFacts(userId, query);
      if (relevantFacts.length > 0) {
        if (lines.length === 0) {
          lines.push('## 📝 ПАМЯТЬ О БИЗНЕСЕ');
        } else {
          lines.push('');
          lines.push('### Известные факты:');
        }
        for (const fact of relevantFacts.slice(0, 5)) {
          lines.push(`- ${fact}`);
        }
      }

      if (lines.length > 0) {
        logger.debug('Memory context built', { userId, factsCount: relevantFacts.length });
      }

      return lines.join('\n');
    } catch (error) {
      logger.warn('Memory context error', { error, userId });
      return '';
    }
  }

  /**
   * Build complete prompt with all modules (Legacy build method)
   * This is used by the orchestrator
   */
  async build(
    _userId: number,
    state: UserState,
    _availableTools: ToolDefinition[],
    query: string
  ): Promise<string> {
    const parts = [
      CORE_PERSONALITY,
      this.buildUserContext(state),
      this.buildPendingContext(state),
      await this.buildKnowledgeContext(query),
      toolRegistry.generatePrompt({ includeExamples: true }),
      PLANNER_OUTPUT_FORMAT,
    ];

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Build planner prompt (Preferred new method)
   */
  async buildPlannerPrompt(context: PromptContext, query: string): Promise<string> {
    const sections: string[] = [];

    // 1. Core personality (minimal)
    sections.push(CORE_PERSONALITY);

    // 2. User context
    sections.push(this.buildUserContext(context.userState));

    // 3. Pending state (if any)
    sections.push(this.buildPendingContext(context.userState));

    // 4. RAG knowledge
    sections.push(await this.buildKnowledgeContext(query));

    // 5. Tool descriptions
    sections.push(toolRegistry.generatePrompt({ includeExamples: true }));

    // 6. Memory context (long-term facts)
    if (context.userId) {
      sections.push(await this.buildMemoryContext(context.userId, query));
    }

    // 7. Experience Learning context (learn from past mistakes!)
    try {
      const learningContext = await experienceLearning.generateLearningContext(query);
      if (learningContext) {
        sections.push(learningContext);
      }
    } catch (error) {
      logger.warn('Failed to get learning context', { error });
    }

    // 8. Recent history summary
    if (context.recentHistory.length > 0) {
      sections.push(this.buildHistoryContext(context.recentHistory));
    }

    // 9. First contact instructions
    if (context.isFirstContact) {
      sections.push(FIRST_CONTACT_INSTRUCTIONS);
    }

    // 10. Output format
    sections.push(PLANNER_OUTPUT_FORMAT);

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Build answerer prompt
   */
  buildAnswererPrompt(context: PromptContext): string {
    const sections: string[] = [];

    sections.push(CORE_PERSONALITY);
    sections.push(ANSWERER_RULES);
    sections.push(this.buildUserContext(context.userState));
    sections.push(ANSWERER_OUTPUT_FORMAT);

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Build user context section
   */
  private buildUserContext(state: UserState): string {
    const lines: string[] = ['## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ'];

    lines.push(`- Маркетплейс: ${state.marketplace || 'не подключён'}`);
    lines.push(`- Товаров: ${state.productsCount}`);
    lines.push(`- Подписка: ${state.subscriptionTier}`);

    if (!state.hasWbKey && !state.hasOzonKey) {
      lines.push(`- ⚠️ API ключи НЕ подключены — нужен онбординг!`);
    }

    if (state.lastMentionedProducts.length > 0) {
      lines.push(
        `- Недавно обсуждали товары: ${state.lastMentionedProducts.slice(0, 3).join(', ')}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Build pending context
   */
  private buildPendingContext(state: UserState): string {
    const lines: string[] = [];

    if (state.awaitingInput) {
      lines.push('## ⚠️ ОЖИДАЕМ ОТВЕТА');
      lines.push(`Ты спросил: "${state.awaitingInput.question}"`);
      lines.push(`Ожидаешь: ${state.awaitingInput.type}`);
      if (state.awaitingInput.forProductId) {
        lines.push(`Для товара: ${state.awaitingInput.forProductId}`);
      }
      lines.push(`→ Если ответ — число или короткая фраза, это скорее всего ответ на твой вопрос!`);
    } else if (state.pendingAction) {
      lines.push('## ⚠️ ОЖИДАЕМ ПОДТВЕРЖДЕНИЯ');
      lines.push(`Действие ожидает подтверждения: ${state.pendingAction.type}`);
      lines.push(`→ Если "да"/"ok" — выполни действие. Если "нет"/"отмена" — отмени.`);
    }

    return lines.join('\n');
  }

  /**
   * Build history context
   */
  private buildHistoryContext(history: ChatMessage[]): string {
    const lines: string[] = ['## НЕДАВНЯЯ ИСТОРИЯ'];

    const recent = history.slice(-4); // Last 4 messages
    for (const msg of recent) {
      const role = msg.role === 'user' ? '👤' : '🤖';
      const content =
        msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
      lines.push(`${role}: ${content}`);
    }

    return lines.join('\n');
  }
}

// ============================================
// PROMPT MODULES (Static parts)
// ============================================

const CORE_PERSONALITY = `# ВИКТОР — Управляющий Магазином

Ты — Виктор, профессиональный управляющий магазинами на Wildberries и Ozon.
Ты НЕ бот, НЕ помощник. Ты — СОТРУДНИК продавца.

ПРАВИЛА:
1. Обращайся по имени, будь человечным
2. Не используй технический жаргон
3. Давай конкретные цифры и рекомендации
4. Проактивно предупреждай о проблемах
5. Не придумывай данные — если нет, скажи`;

const FIRST_CONTACT_INSTRUCTIONS = `## 🚀 ПЕРВЫЙ КОНТАКТ

Это ПЕРВОЕ сообщение пользователя. Обязательно:
1. Поприветствуй и подтверди вступление в должность
2. Объясни кратко свои обязанности
3. Проверь есть ли API ключи
4. Если нет ключей — дай инструкцию по получению`;

const PLANNER_OUTPUT_FORMAT = `## ФОРМАТ ОТВЕТА

Отвечай СТРОГО в JSON:
{
  "reasoning": "Краткое объяснение выбора",
  "tools": [
    { "tool": "tool_name", "args": {...}, "reason": "зачем" }
  ],
  "requires_confirmation": false
}

Если не нужны инструменты (приветствие, благодарность) → tools: []`;

const ANSWERER_RULES = `## ПРАВИЛА ОТВЕТА

1. Используй ТОЛЬКО данные из результатов инструментов
2. НЕ придумывай ссылки — бери только из available_urls
3. Форматируй цены с ₽, используй эмодзи для акцентов
4. Если есть проблема — предложи конкретное действие
5. Если нужно подтверждение — чётко спроси да/нет`;

const ANSWERER_OUTPUT_FORMAT = `## ФОРМАТ ОТВЕТА

{
  "message": "Текст ответа пользователю",
  "links": [{ "title": "...", "url": "...", "source": "..." }],
  "actions": [{ "type": "...", "summary": "...", "details_json": "{}", "affected_count": 0 }]
}`;

// Singleton instance
export const promptBuilder = new PromptBuilder();
