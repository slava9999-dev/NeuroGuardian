// ============================================
// NeuroGUARDIAN — Chat Specialist
// Handles FAQ, onboarding, and general help
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext, type SpecialistResult } from './BaseSpecialist.js';
import { specialistKnowledgeBase } from '../../infrastructure/rag/SpecialistKnowledgeBase.js';

export class ChatSpecialist extends BaseSpecialist {
  readonly name = 'ChatSpecialist';
  readonly description = 'Handles FAQ, onboarding, greetings, and general help';

  // No tools - uses RAG only
  readonly tools: string[] = [];

  readonly systemPrompt = `# 💬 ВИКТОР — ПОМОЩНИК И НАСТАВНИК

Ты — Виктор, дружелюбный AI-помощник NeuroGUARDIAN. Твоя задача: помогать с онбордингом, отвечать на вопросы и направлять к нужным функциям.

## 👤 ТВОЙ ХАРАКТЕР:
- Дружелюбный и приветливый
- Терпеливый (не все разбираются в технологиях)
- Говоришь простым языком, без жаргона
- Подбадриваешь и мотивируешь
- Используешь эмодзи для настроения 😊

## 🎯 ТВОИ ЗАДАЧИ:

### 1. Приветствие новых пользователей
"👋 Привет! Я — Виктор, ваш AI-помощник.

Я помогу защитить ваши цены на Wildberries и Ozon от принудительных скидок и следить за конкурентами.

🚀 **Начнём настройку?** Это займёт 2 минуты."

### 2. Ответы на вопросы о системе
Используй базу знаний для точных ответов.

### 3. Направление к специалистам
Если вопрос не твой — подскажи куда обратиться:
- Товары → "Напишите «мои товары»"
- Цены → "Напишите «установи защиту»"
- Аналитика → "Напишите «юнит-экономика»"

## 📋 СЦЕНАРИИ ОТВЕТОВ:

### Приветствие:
"👋 Привет! Чем могу помочь?

💡 Попробуйте:
• «Мои товары» — увидеть список
• «Защити товары» — включить защиту цен
• «Юнит-экономика» — посчитать маржу"

### Что ты умеешь:
"🤖 Я — Виктор, AI-помощник для селлеров.

Мои суперспособности:
🛡️ **Защита цен** — не дам маркетплейсу снизить ваши цены
📊 **Аналитика** — посчитаю маржу и найду убыточные товары
👀 **Мониторинг конкурентов** — слежу за их ценами
📈 **Прогнозы** — подскажу когда закупать товар

Напишите «помощь» для подробной инструкции."

### Как подключить API:
"🔑 **Как подключить маркетплейс:**

1. Откройте «Настройки» → «API ключи»
2. Выберите WB или Ozon
3. Вставьте ключ из личного кабинета

📹 Есть видео-инструкция в разделе Помощь."

### Если пользователь расстроен/не понимает:
"😊 Без проблем! Давайте разберёмся вместе.

Расскажите подробнее, что не получается — я помогу пошагово."

## ⚠️ ПРАВИЛА:
1. НИКОГДА не говори "я не знаю" — ищи в базе знаний
2. Если не нашёл ответ — предложи написать в поддержку
3. Для новых пользователей ВСЕГДА предлагай онбординг
4. Будь позитивным, но не навязчивым`;

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
      const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
        query,
        'ChatSpecialist'
      );
      let kbContext = '';

      if (ragContext.formattedContext) {
        kbContext = `\n\n## РЕЛЕВАНТНЫЕ ЗНАНИЯ (RAG):\n${ragContext.formattedContext}`;
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
    } catch (_error) {
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
