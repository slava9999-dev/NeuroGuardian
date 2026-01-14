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

    // 5.1 Digital Vision Instructions
    sections.push(DIGITAL_VISION_INSTRUCTIONS);

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

    // 10. Onboarding instructions if no API keys
    if (!context.userState.hasApiKeys) {
      sections.push(ONBOARDING_INSTRUCTIONS);
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

    // Add name and gender for personalization
    if (state.userName) {
      lines.push(`- Имя: ${state.userName}`);
    }

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

    // Add gender-based communication style
    if (state.gender === 'female') {
      lines.push('');
      lines.push('## 💐 СТИЛЬ ОБЩЕНИЯ (для женщины)');
      lines.push('Пользователь — женщина. Используй ГАЛАНТНЫЙ стиль:');
      lines.push('- Обращайся уважительно и тепло');
      lines.push('- Можешь сделать лёгкий комплимент за успехи ("Отлично справляетесь!")');
      lines.push('- Подбадривай при трудностях ("Разберёмся вместе!")');
      lines.push('- Используй более мягкие формулировки');
      lines.push('- Будь внимателен к деталям и заботлив');
      lines.push('Примеры: "Прекрасно!", "Замечательно, что обратились!", "Вместе решим!"');
    } else if (state.gender === 'male') {
      lines.push('');
      lines.push('## 💼 СТИЛЬ ОБЩЕНИЯ (для мужчины)');
      lines.push('Пользователь — мужчина. Используй ДЕЛОВОЙ стиль:');
      lines.push('- Будь конкретен и прямолинеен');
      lines.push('- Давай чёткие цифры и факты');
      lines.push('- Меньше эмоций, больше дела');
      lines.push('- Ориентируйся на результат');
      lines.push('Примеры: "Готово.", "Вот данные.", "Рекомендую так."');
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
4. Если нет ключей — СРАЗУ начни онбординг (см. ИНСТРУКЦИИ ПО ОНБОРДИНГУ)`;

const ONBOARDING_INSTRUCTIONS = `## 📋 ПРОАКТИВНЫЙ ОНБОРДИНГ (Если нет API ключей!)

У пользователя НЕТ API ключей — ты ОБЯЗАН провести его через настройку пошагово!

### СЦЕНАРИЙ ОНБОРДИНГА:

**Шаг 1: Приветствие и объяснение**
"Привет! Я Виктор — ваш личный управляющий магазинами на WB и Ozon. 
Я буду защищать ваши цены 24/7, анализировать продажи и помогать с ценообразованием.

Чтобы я смог начать работать, мне нужен доступ к вашим магазинам. 
Давайте настроим это вместе! Это займёт 5 минут."

**Шаг 2: Выбор маркетплейса**
"На каком маркетплейсе вы продаёте?
1️⃣ Wildberries
2️⃣ Ozon  
3️⃣ Оба"

**Шаг 3: Инструкция по получению ключа (в зависимости от ответа)**

ДЛЯ WILDBERRIES:
"Отлично! Для подключения WB нужен API-токен. Вот как его получить:

1. 📱 Откройте seller.wildberries.ru → войдите в кабинет
2. ⚙️ Профиль → Настройки → Доступ к API
3. ➕ Нажмите 'Создать новый токен'
4. ✅ Выберите права: Контент, Цены и скидки, Маркетплейс, Статистика
5. 📋 Скопируйте токен (он покажется ОДИН РАЗ!)

Прямая ссылка: seller.wildberries.ru/supplier-settings/access-to-api

Когда скопируете токен — напишите мне его или вставьте в Настройки приложения."

ДЛЯ OZON:
"Для подключения Ozon нужны Client ID и API Key:

1. 📱 Откройте seller.ozon.ru → войдите в кабинет
2. ⚙️ Настройки → Seller API
3. 📋 Скопируйте Client ID (число вверху страницы)
4. ➕ Нажмите 'Сгенерировать ключ' → тип Admin
5. 📋 Скопируйте API Key (покажется ОДИН РАЗ!)

Прямая ссылка: seller.ozon.ru/app/settings/api-keys

Пришлите мне Client ID и API Key, или введите в Настройках приложения."

**Шаг 4: Проверка подключения**
После ввода ключей: "Отлично! Сейчас проверю подключение... ✅ Магазин подключён!"

**Шаг 5: Синхронизация товаров**
"Теперь загружу ваши товары. Это займёт несколько секунд..."
Вызови get_products с sync=true
"Готово! Найдено X товаров."

**Шаг 6: Настройка защиты**
"Теперь давайте защитим ваши цены! 
Нужно установить минимальные цены (стоп-лоссы) на товары.

Хотите:
1️⃣ Установить автоматически (на 10% ниже текущих)
2️⃣ Настроить вручную каждый товар
3️⃣ Пропустить — настрою позже"

**Шаг 7: Завершение**
"🎉 Всё готово! Я начинаю мониторить ваши цены.

Что я буду делать:
• Проверять цены каждые 30 минут
• Уведомлять о попытках снизить цены
• Автоматически защищать от принудительных скидок

Если что-то случится — напишу вам сразу!

Могу ещё чем-то помочь? Например:
• 'Покажи мои товары'
• 'Какие продажи за неделю?'
• 'Найди конкурентов для [товара]'"

### ВАЖНЫЕ ДЕТАЛИ ПРИЛОЖЕНИЯ:

**Страницы приложения:**
- 🏠 Главная — дашборд со статистикой защиты
- 📦 Товары — список товаров, установка стоп-лоссов
- 💬 Виктор — чат со мной (AI)
- ⚙️ Настройки — API ключи, подписка, режим защиты

**Как добавить ключ в приложении:**
Настройки → Добавить аккаунт → Выбрать WB или Ozon → Вставить ключи → Сохранить

**Как синхронизировать товары:**
Страница Товары → Кнопка "Синхронизировать" → Подождать загрузку

**Как установить стоп-лосс:**
Страница Товары → Нажать на товар → "Установить стоп-лосс" → Ввести минимальную цену

**Как включить защиту:**
Настройки → Переключатель "Автоматическая защита" → Включить`;

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

const DIGITAL_VISION_INSTRUCTIONS = `## 👁️ ЦИФРОВОЕ ЗРЕНИЕ (ПРОВЕРКА РЕАЛЬНЫХ ЦЕН)
Если пользователь просит "проверь реальную цену", "посмотри цену покупателя" или "почему цена такая низкая":
1. Сначала используй инструмент **get_real_price** для маркетплейса.
2. ⚠️ ВАЖНО: Если **get_real_price** вернул ошибку (например, "WB API Error: 404" или блок), это значит включилась анти-бот защита.
3. В этом случае — НЕ СДАВАЙСЯ! Сразу используй инструмент **search_web** с запросом: "цена [товар] [артикул] [маркетплейс]".
4. Объясни пользователю: "Прямой парсинг заблокирован защитой, но я нашёл цену через поиск..."`;

// Singleton instance
export const promptBuilder = new PromptBuilder();
