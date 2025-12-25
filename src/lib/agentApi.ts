// ============================================
// NeuroGUARDIAN — Agent API Client
// API client for AI agent functionality
// ============================================

import { getInitData } from './telegram';

// API base - uses /api for Vercel
const API_BASE = '/api';

// ============================================
// V4 AGENT CONFIGURATION
// Set to true to use the new two-phase pipeline
// ============================================
const USE_V4_AGENT = true;

// Agent message types
export interface AgentMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// V4 Response with structured links
export interface AgentV4Response {
  success: boolean;
  message: string;
  links?: Array<{
    title: string;
    url: string;
    source: 'search_web' | 'marketplace' | 'documentation';
  }>;
  actions?: Array<{
    type: string;
    summary: string;
    details: Record<string, unknown>;
    affected_count: number;
  }>;
  data?: Record<string, unknown>;
  metadata?: {
    totalTime?: number;
    planningTime?: number;
    executionTime?: number;
    answeringTime?: number;
    tokensUsed?: number;
    toolsCalled?: string[];
  };
}

export interface AgentResponse {
  success: boolean;
  content: string;
  actionRequired?: {
    type: 'confirmation';
    operation: string;
    details: Record<string, unknown>;
    confirmationMessage: string;
  };
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsUsed?: string[];
    model?: string;
    complexity?: 'simple' | 'complex';
  };
  error?: string;
}

export interface ConfirmationResponse {
  success: boolean;
  content: string;
  operation: string;
  executed: boolean;
}

// Task complexity classification
export type TaskComplexity = 'simple' | 'complex';

const COMPLEX_PATTERNS = [
  'оптимизируй',
  'проанализируй',
  'почему',
  'стратегия',
  'рекомендации',
  'если.*то',
  'помоги',
  'как лучше',
];

// Classify task complexity for UI feedback
export function classifyComplexity(message: string): TaskComplexity {
  const lowerMessage = message.toLowerCase();

  for (const pattern of COMPLEX_PATTERNS) {
    if (new RegExp(pattern).test(lowerMessage)) {
      return 'complex';
    }
  }

  return 'simple';
}

// Agent API
export const agentApi = {
  /**
   * Send a message to the AI agent
   * Uses V4 (two-phase pipeline) when USE_V4_AGENT is true
   */
  sendMessage: async (message: string, history: AgentMessage[] = []): Promise<AgentResponse> => {
    const initData = getInitData();
    const action = USE_V4_AGENT ? 'agent-v4' : 'agent';

    try {
      const response = await fetch(`${API_BASE}?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          action,
          message,
          history,
          initData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // V4 returns 'message' field, V3 returns 'content' field
      if (USE_V4_AGENT) {
        const v4Data = data as AgentV4Response;

        // Build content with links formatted as markdown
        let content = v4Data.message;

        // Append validated links section if present
        if (v4Data.links && v4Data.links.length > 0) {
          content += '\n\n**🔗 Ссылки:**\n';
          for (const link of v4Data.links) {
            content += `- [${link.title}](${link.url})\n`;
          }
        }

        return {
          success: v4Data.success,
          content,
          metadata: {
            tokensUsed: v4Data.metadata?.tokensUsed,
            executionTime: v4Data.metadata?.totalTime,
            toolsUsed: v4Data.metadata?.toolsCalled,
            model: 'v4-pipeline',
          },
        };
      }

      return data;
    } catch (error) {
      console.error('Agent API error:', error);

      // Fallback to mock response for development
      if (import.meta.env.DEV) {
        return getMockResponse(message);
      }

      return {
        success: false,
        content: '❌ Не удалось связаться с агентом. Проверьте подключение.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Confirm or cancel an operation
   */
  confirmAction: async (
    operation: string,
    confirmed: boolean,
    details: Record<string, unknown>
  ): Promise<AgentResponse> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=agent-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          action: 'agent-confirm',
          operation,
          confirmed,
          details,
          initData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Confirm API error:', error);

      if (import.meta.env.DEV && confirmed) {
        return {
          success: true,
          content: `✅ **Операция выполнена!**\n\nИзменения применены успешно.`,
        };
      }

      return {
        success: false,
        content: confirmed ? '❌ Не удалось выполнить операцию.' : '👍 Операция отменена.',
      };
    }
  },

  /**
   * Get agent capabilities and status
   */
  getStatus: async (): Promise<{
    available: boolean;
    model: string;
    capabilities: string[];
  }> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=agent-status`, {
        headers: {
          'X-Init-Data': initData || '',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch {
      return {
        available: import.meta.env.DEV,
        model: 'gpt-4o-mini',
        capabilities: ['Статистика продаж', 'Управление ценами', 'Защита товаров', 'Аналитика'],
      };
    }
  },

  /**
   * Load chat history from server
   */
  loadHistory: async (): Promise<AgentMessage[]> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=get-chat-history`, {
        headers: {
          'X-Init-Data': initData || '',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Load history error:', error);
      return [];
    }
  },

  /**
   * Save chat history to server
   */
  saveHistory: async (messages: AgentMessage[]): Promise<boolean> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=save-chat-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          action: 'save-chat-history',
          messages,
          initData,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Save history error:', error);
      return false;
    }
  },

  /**
   * Clear chat history on server
   */
  clearHistory: async (): Promise<boolean> => {
    const initData = getInitData();

    try {
      const response = await fetch(`${API_BASE}?action=clear-chat-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '',
        },
        body: JSON.stringify({
          action: 'clear-chat-history',
          initData,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Clear history error:', error);
      return false;
    }
  },
};

// ============================================
// MOCK RESPONSES FOR DEVELOPMENT
// ============================================

function getMockResponse(message: string): AgentResponse {
  const lowerMessage = message.toLowerCase();

  // Simulate processing delay
  const startTime = Date.now();

  // Pattern matching for mock responses
  if (lowerMessage.includes('продаж') || lowerMessage.includes('выручк')) {
    return {
      success: true,
      content: `📊 **Статистика продаж за сегодня:**

• Всего заказов: **42**
• Выручка: **156,780 ₽**
• Средний чек: **3,733 ₽**
• Топ товар: Кроссовки Nike Air Max 270

📈 По сравнению со вчера: **+12%**`,
      metadata: {
        tokensUsed: 245,
        executionTime: Date.now() - startTime + 150,
        toolsUsed: ['get_sales', 'calculate_stats'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  if (
    lowerMessage.includes('цен') &&
    (lowerMessage.includes('измени') ||
      lowerMessage.includes('повыс') ||
      lowerMessage.includes('пониз'))
  ) {
    return {
      success: true,
      content: `⚠️ **Запрос на изменение цен:**

Обнаружено товаров для изменения: **5**

Планируемые изменения:
• Nike Air Max 270: 12,500 ₽ → 13,000 ₽
• Adidas Hoodie: 6,500 ₽ → 6,990 ₽
• Samsung S23: без изменений`,
      actionRequired: {
        type: 'confirmation',
        operation: 'price_update',
        details: {
          products: [
            { id: 'wb-123', name: 'Nike Air Max 270', oldPrice: 12500, newPrice: 13000 },
            { id: 'wb-456', name: 'Adidas Hoodie', oldPrice: 6500, newPrice: 6990 },
          ],
          totalProducts: 2,
        },
        confirmationMessage: 'Изменить цены для 2 товаров?',
      },
      metadata: {
        tokensUsed: 380,
        executionTime: Date.now() - startTime + 200,
        toolsUsed: ['search_products', 'prepare_price_update'],
        model: 'gpt-4o',
        complexity: 'complex',
      },
    };
  }

  if (lowerMessage.includes('защит') || lowerMessage.includes('stop-loss')) {
    return {
      success: true,
      content: `🛡️ **Статус защиты товаров:**

✅ Защищено: **45** товаров
⚠️ Без защиты: **12** товаров
🚨 Сработало сегодня: **3** раза

**Рекомендация:** У вас 12 товаров без установленного Stop-Loss. Хотите установить минимальную цену для всех?`,
      metadata: {
        tokensUsed: 156,
        executionTime: Date.now() - startTime + 100,
        toolsUsed: ['get_protection_status'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  if (
    lowerMessage.includes('топ') ||
    lowerMessage.includes('лучш') ||
    lowerMessage.includes('продаётся')
  ) {
    return {
      success: true,
      content: `🏆 **Топ-5 товаров по продажам:**

1. **Кроссовки Nike Air Max 270** — 23 шт., 287,500 ₽
2. **Худи Adidas Originals** — 18 шт., 117,000 ₽
3. **Samsung Galaxy S23** — 5 шт., 449,950 ₽
4. **Sony WH-1000XM5** — 8 шт., 279,920 ₽
5. **Футболка Puma Essential** — 45 шт., 134,550 ₽

📊 Общая выручка топ-5: **1,268,920 ₽**`,
      metadata: {
        tokensUsed: 289,
        executionTime: Date.now() - startTime + 180,
        toolsUsed: ['get_sales', 'sort_products'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // APP HELP: API key setup
  if (
    lowerMessage.includes('api') ||
    lowerMessage.includes('ключ') ||
    lowerMessage.includes('подключ')
  ) {
    return {
      success: true,
      content: `🔑 **Как подключить API маркетплейса:**

**Для Wildberries:**
1. Откройте [seller.wildberries.ru](https://seller.wildberries.ru)
2. Профиль → Настройки → Доступ к API
3. Создайте новый токен с правами: *Контент, Цены, Склад*
4. Скопируйте ключ (показывается только 1 раз!)

**Для Ozon:**
1. Откройте [seller.ozon.ru](https://seller.ozon.ru)
2. Настройки → API ключи
3. Создайте ключ и скопируйте *API-ключ* и *Client ID*

⚙️ Затем перейдите во вкладку **Настройки** в приложении и вставьте ключи.

*Нужна помощь? Напишите "инструкция"!*`,
      metadata: {
        executionTime: Date.now() - startTime + 80,
        toolsUsed: ['app_help'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // APP HELP: How to use features
  if (
    lowerMessage.includes('как') &&
    (lowerMessage.includes('пользоват') ||
      lowerMessage.includes('работа') ||
      lowerMessage.includes('настро'))
  ) {
    return {
      success: true,
      content: `📚 **Как пользоваться приложением:**

**1️⃣ Подключите маркетплейс**
Перейдите в Настройки → введите API ключи WB или Ozon

**2️⃣ Синхронизируйте товары**
Нажмите "Синхронизировать" — я загружу все ваши товары

**3️⃣ Установите Stop-Loss**
Для каждого товара укажите минимальную цену — ниже неё продавать невыгодно

**4️⃣ Включите защиту**
Нажмите кнопку "ARMED" — система будет следить 24/7

**5️⃣ Спросите меня!**
Не знаете что делать? Просто напишите мне — я помогу! 💬

*Попробуйте: "Покажи статистику" или "Защити все товары"*`,
      metadata: {
        executionTime: Date.now() - startTime + 90,
        toolsUsed: ['app_help', 'tutorial'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // APP HELP: What buttons do
  if (
    lowerMessage.includes('кнопк') ||
    lowerMessage.includes('что делает') ||
    lowerMessage.includes('инструкц')
  ) {
    return {
      success: true,
      content: `🎛️ **Обзор интерфейса:**

**Вкладки внизу:**
• 📊 **Защита** — панель управления, статистика, включение/отключение
• ⚙️ **Настройки** — API ключи, режим защиты, подписка
• 📜 **Legal** — юридическая информация
• 🤖 **Агент** — это я! Пишите сюда любые вопросы

**На панели Защита:**
• **ARMED/DISARMED** — главный переключатель защиты
• **Безопасность** — информация о шифровании ключей
• **Инструкция** — пошаговый туториал
• **История** — логи срабатываний защиты
• **Товары** — список всех ваших товаров

*Что-то непонятно? Просто спросите!* 😊`,
      metadata: {
        executionTime: Date.now() - startTime + 70,
        toolsUsed: ['app_help', 'ui_guide'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // APP HELP: Subscription/Payment
  if (
    lowerMessage.includes('подписк') ||
    lowerMessage.includes('оплат') ||
    lowerMessage.includes('тариф') ||
    lowerMessage.includes('plan')
  ) {
    return {
      success: true,
      content: `💳 **Тарифные планы:**

🎁 **Пробный период** — 3 дня бесплатно
Полный функционал без ограничений!

📦 **Basic** — 499 ₽/мес
До 50 товаров под защитой

🚀 **Pro** — 999 ₽/мес
До 500 товаров + приоритетная поддержка

📅 **Yearly** — 9,990 ₽/год
Экономия 2,000 ₽ (как 10 месяцев по цене 12)

👉 Для оплаты перейдите в **Настройки** → **Подписка**`,
      metadata: {
        executionTime: Date.now() - startTime + 60,
        toolsUsed: ['billing_info'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // Greeting / Help
  if (
    lowerMessage.includes('привет') ||
    lowerMessage.includes('здравствуй') ||
    lowerMessage.includes('помог') ||
    lowerMessage.includes('умеешь')
  ) {
    return {
      success: true,
      content: `👋 **Привет! Я ваш личный агент для WB и Ozon!**

Вот что я умею:

**📊 Статистика:**
• "Покажи продажи" — выручка и заказы
• "Топ товаров" — лучшие по продажам
• "Статус защиты" — сколько товаров под защитой

**💰 Управление:**
• "Защити все товары" — массовый Stop-Loss
• "Измени цены" — корректировка цен

**❓ Помощь:**
• "Как подключить API" — инструкция
• "Что делают кнопки" — обзор интерфейса
• "Тарифы" — информация о подписке

*Просто напишите, что нужно сделать!* 😊`,
      metadata: {
        executionTime: Date.now() - startTime + 50,
        toolsUsed: ['greeting', 'capabilities'],
        model: 'gpt-4o-mini',
        complexity: 'simple',
      },
    };
  }

  // Default fallback
  return {
    success: true,
    content: `🤔 Не совсем понял запрос, но я постараюсь помочь!

**Попробуйте спросить:**
• "Покажи продажи" — статистика
• "Статус защиты" — защищённые товары
• "Как подключить API" — инструкция
• "Что умеешь" — мои возможности

Или просто опишите проблему своими словами — разберёмся вместе! 💬`,
    metadata: {
      tokensUsed: 87,
      executionTime: Date.now() - startTime + 50,
      model: 'gpt-4o-mini',
      complexity: 'simple',
    },
  };
}

export default agentApi;
