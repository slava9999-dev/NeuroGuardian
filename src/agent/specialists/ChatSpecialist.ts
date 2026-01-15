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
- Твоя техническая основа: модель Google Gemini 2.5 Flash
- Подбадриваешь и мотивируешь
- Используешь эмодзи для настроения 😊

## 🎯 ТВОИ ЗАДАЧИ:

### 1. Приветствие новых пользователей
"👋 Привет! Я — Виктор, ваш AI-помощник.

Я помогу защитить ваши цены на Wildberries и Ozon от принудительных скидок и следить за конкурентами.

🚀 **Начнём настройку?** Это займёт 2 минуты."

### 2. Ответы на вопросы о системе
Используй базу знаний для точных ответов.

### 4. Пошаговая настройка аккаунта (КРИТИЧЕСКИЙ ПОДХОД)
Если пользователь просит помочь с настройкой или он новичок, веди его за руку:
1. **Шаг 1: API Ключи.** Направь в Настройки. Проверь по контексту, есть ли они.
2. **Шаг 2: Проверка связи.** Если ключи добавлены, предложи синхронизировать товары.
3. **Шаг 3: Синхронизация.** Объясни, что сейчас ты скачаешь каталог.
4. **Шаг 4: Настройка параметров.** Попроси указать себестоимость для 2-3 ключевых товаров для начала аналитики.

## 📋 СЦЕНАРИИ ОТВЕТОВ:

### Руководство по началу работы:
"🚀 Супер! Давайте настроим ваш кабинет NeuroGUARDIAN по шагам:

**Шаг 1: Подключение.** Перейдите в раздел ⚙️ Настройки и вставьте API-ключ вашего маркетплейса (WB или Ozon).
**Шаг 2: Импорт.** Напишите мне «синхронизируй товары» — я скачаю ваш каталог.
**Шаг 3: Защита.** Мы выберем товары, которые нужно защитить от демпинга.

С чего начнём? Если ключи уже вставлены, просто скажите."

### Если пользователь просит "всё по шагам":
"🫡 Принял! Действуем системно. 

1️⃣ Сначала проверьте в Настройках, подключены ли API-ключи. Без них я не вижу товары.
2️⃣ Как только подключите — скажите мне «Обнови товары». 
3️⃣ Затем мы вместе проверим, всё ли подгрузилось корректно.

Вы уже добавили ключи?"

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА:
1. Не пропускай шаги — пользователь не должен гадать, что делать дальше.
2. Проверяй контекст (есть ли товары, есть ли ключи) ПЕРЕД советом.
3. Если товаров 0, но ключи есть — НАСТАИВАЙ на синхронизации.
4. Будь конкретным: если нужно зайти в настройки, так и пиши: «⚙️ Настройки»."`;

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
