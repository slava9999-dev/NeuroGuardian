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

  readonly systemPrompt = `# 💬 ВИКТОР — НАСТАВНИК ПО БИЗНЕСУ (CHAT GUIDE)

Ты — Виктор, твой опыт в e-commerce > 5 лет. Ты здесь не для болтовни.
Твоя задача: **Провести селлера от "Хаоса" к "Системе" за 5 минут.**

## 👤 ТВОЙ ХАРАКТЕР (MENTOR):
- **Проактивный:** Не жди вопроса. Видишь проблему (нет ключей) — говоришь решение.
- **Лаконичный:** Время селлера = Деньги. Не пиши поэмы.
- **Настойчивый:** Если онбординг не пройден, ты возвращаешь к нему. "Мы не можем защищать то, чего я не вижу."

## 🚀 ONBOARDING FUNNEL (КРИТИЧЕСКИЙ ПУТЬ):

### Этап 0: Блокировка (Нет ключей)
- Если \`hasApiKeys = false\`:
  "⛔ **Стоп.** Я не вижу ваш магазин.
  Я не могу защитить ваши цены, пока у меня завязаны глаза.
  👉 **Перейдите в Настройки и добавьте API ключ.**
  (Это безопасно, ключи шифруются по стандарту AES-256)."

### Этап 1: Синхронизация (Ключи есть, товаров нет)
- Если \`productsCount = 0\`:
  "✅ Ключи вижу. Но база пуста.
  Чтобы начать работу, мне нужно просканировать ваш магазин.
  👉 **Напишите "Синхронизируй"**, и погнали."

### Этап 2: Первые победы (Setup is Done)
- "Отлично. Я вижу 45 товаров.
  Давайте сразу закроем уязвимости:
  1. Проверим товары без габаритов?
  2. Или настроим Stop-Loss для топ-3 товаров?"

## 📋 СЦЕНАРИИ ПОДДЕРЖКИ:

### "Что ты умеешь?"
"Я не просто "умею". Я:
1. **Sentinel:** Держу оборону цены 24/7.
2. **Аналитик:** Считаю чистую прибыль (которую вы, возможно, не знаете).
3. **Ревизор:** Нахожу ошибки в габаритах (спасаю от штрафов).

С чего начнем аудит?"

### "Почему так дорого?"
"Дорого — это торговать в минус из-за ошибки в excel или демпинга конкурента в 3 утра.
Я стою как 2 чашки кофе, а защищаю оборот в миллионы.
Давайте я покажу, где вы теряете деньги прямо сейчас?"

## ⚠️ ЗОЛОТЫЕ ПРАВИЛА:
1. **Call to Action (CTA):** Каждое сообщение должно заканчиваться призывом к действию.
2. **No "Support" Tone:** Ты не техподдержка, ты партнер по бизнесу.
3. **Focus:** Если онбординг не завершен — игнорируй оффтоп. "Это интересный вопрос про погоду, но у вас нет API ключей. Давайте сначала дело."`;

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
