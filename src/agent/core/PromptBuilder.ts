// ============================================
// NeuroGUARDIAN — Dynamic Prompt Builder
// Assembles prompts dynamically from modules
// Reduces token usage by 70%
// Version: 5.0.0 | Date: January 2026
// ============================================

import type { UserState, ChatMessage } from '../../core/types/agent.types.js';
import { toolRegistry } from '../execution/ToolRegistry.js';

/**
 * Prompt context for building
 */
interface PromptContext {
  userState: UserState;
  recentHistory: ChatMessage[];
  relevantKnowledge?: string[];
  isFirstContact?: boolean;
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
   * Build planner prompt
   * Used for deciding which tools to call
   */
  buildPlannerPrompt(context: PromptContext): string {
    const sections: string[] = [];

    // 1. Core personality (minimal)
    sections.push(CORE_PERSONALITY);

    // 2. User context
    sections.push(this.buildUserContext(context.userState));

    // 3. Pending state (if any)
    if (context.userState.pendingAction || context.userState.awaitingInput) {
      sections.push(this.buildPendingContext(context.userState));
    }

    // 4. Tool descriptions (dynamic from registry)
    sections.push(toolRegistry.generatePrompt({ includeExamples: true }));

    // 5. Recent history summary (if relevant)
    if (context.recentHistory.length > 0) {
      sections.push(this.buildHistoryContext(context.recentHistory));
    }

    // 6. RAG knowledge (if available)
    if (context.relevantKnowledge && context.relevantKnowledge.length > 0) {
      sections.push(this.buildKnowledgeContext(context.relevantKnowledge));
    }

    // 7. First contact instructions
    if (context.isFirstContact) {
      sections.push(FIRST_CONTACT_INSTRUCTIONS);
    }

    // 8. Output format
    sections.push(PLANNER_OUTPUT_FORMAT);

    return sections.join('\n\n');
  }

  /**
   * Build answerer prompt
   * Used for generating final response from tool results
   */
  buildAnswererPrompt(context: PromptContext): string {
    const sections: string[] = [];

    // 1. Core personality
    sections.push(CORE_PERSONALITY);

    // 2. Answerer-specific rules
    sections.push(ANSWERER_RULES);

    // 3. User context
    sections.push(this.buildUserContext(context.userState));

    // 4. Output format
    sections.push(ANSWERER_OUTPUT_FORMAT);

    return sections.join('\n\n');
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
   * Build pending context (awaiting input or confirmation)
   */
  private buildPendingContext(state: UserState): string {
    const lines: string[] = ['## ⚠️ ОЖИДАЕМ ОТВЕТА'];

    if (state.awaitingInput) {
      lines.push(`Ты спросил: "${state.awaitingInput.question}"`);
      lines.push(`Ожидаешь: ${state.awaitingInput.type}`);
      if (state.awaitingInput.forProductId) {
        lines.push(`Для товара: ${state.awaitingInput.forProductId}`);
      }
      lines.push(`→ Если ответ — число или короткая фраза, это скорее всего ответ на твой вопрос!`);
    }

    if (state.pendingAction) {
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

  /**
   * Build knowledge context from RAG
   */
  private buildKnowledgeContext(knowledge: string[]): string {
    const lines: string[] = ['## РЕЛЕВАНТНЫЕ ЗНАНИЯ'];

    for (const fact of knowledge.slice(0, 3)) {
      lines.push(`• ${fact}`);
    }

    return lines.join('\n');
  }
}

// ============================================
// PROMPT MODULES (Static parts)
// ============================================

/**
 * Core personality - minimal, always included
 */
const CORE_PERSONALITY = `# ВИКТОР — Управляющий Магазином

Ты — Виктор, профессиональный управляющий магазинами на Wildberries и Ozon.
Ты НЕ бот, НЕ помощник. Ты — СОТРУДНИК продавца.

ПРАВИЛА:
1. Обращайся по имени, будь человечным
2. Не используй технический жаргон
3. Давай конкретные цифры и рекомендации
4. Проактивно предупреждай о проблемах
5. Не придумывай данные — если нет, скажи`;

/**
 * First contact special instructions
 */
const FIRST_CONTACT_INSTRUCTIONS = `## 🚀 ПЕРВЫЙ КОНТАКТ

Это ПЕРВОЕ сообщение пользователя. Обязательно:
1. Поприветствуй и подтверди вступление в должность
2. Объясни кратко свои обязанности
3. Проверь есть ли API ключи
4. Если нет ключей — дай инструкцию по получению`;

/**
 * Planner output format
 */
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

/**
 * Answerer-specific rules
 */
const ANSWERER_RULES = `## ПРАВИЛА ОТВЕТА

1. Используй ТОЛЬКО данные из результатов инструментов
2. НЕ придумывай ссылки — бери только из available_urls
3. Форматируй цены с ₽, используй эмодзи для акцентов
4. Если есть проблема — предложи конкретное действие
5. Если нужно подтверждение — чётко спроси да/нет`;

/**
 * Answerer output format
 */
const ANSWERER_OUTPUT_FORMAT = `## ФОРМАТ ОТВЕТА

{
  "message": "Текст ответа пользователю",
  "links": [{ "title": "...", "url": "...", "source": "..." }],
  "actions": [{ "type": "...", "summary": "...", "details_json": "{}", "affected_count": 0 }]
}`;

// Singleton instance
export const promptBuilder = new PromptBuilder();
