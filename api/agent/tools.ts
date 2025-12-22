// ============================================
// NeuroGUARDIAN — AI Agent Tools Definitions
// OpenAI Function Calling tool definitions
// ============================================

/**
 * Tool definitions for OpenAI Function Calling
 * GPT decides which tool to call based on user message
 */
export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description:
        'Получить список товаров пользователя с ценами, остатками и статусом защиты. Используй когда пользователь спрашивает о своих товарах.',
      parameters: {
        type: 'object',
        properties: {
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'all'],
            description: 'Маркетплейс для фильтрации. По умолчанию all.',
          },
          limit: {
            type: 'number',
            description: 'Максимум товаров. По умолчанию 20.',
          },
          sort_by: {
            type: 'string',
            enum: ['price', 'stock', 'name'],
            description: 'Сортировка: price (по цене), stock (по остаткам), name (по названию)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_sales_stats',
      description:
        'Получить статистику продаж за период. Используй когда пользователь спрашивает о продажах, выручке, заказах.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'yesterday', 'week', 'month', '3months'],
            description: 'Период для статистики',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'all'],
            description: 'Маркетплейс',
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_unit_economics',
      description:
        'Расчёт юнит-экономики: прибыль на товар с учётом комиссий, логистики, налогов. Используй когда пользователь спрашивает о прибыли, рентабельности, маржинальности.',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'ID конкретного товара (опционально)',
          },
          cost_price: {
            type: 'number',
            description: 'Себестоимость товара в рублях (если пользователь указал)',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon'],
            description: 'Маркетплейс для расчёта комиссий',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_abc_analysis',
      description:
        'ABC-анализ товаров: какие приносят 80% выручки (A), 15% (B), 5% (C). Используй когда пользователь хочет понять какие товары самые важные.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', '3months'],
            description: 'Период для анализа',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stock_forecast',
      description:
        'Прогноз остатков: когда товар закончится на складе. Используй когда пользователь спрашивает о запасах, когда заказывать товар.',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'ID товара (опционально, если не указан - все товары)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_stop_loss',
      description:
        'Установить минимальную цену (Stop-Loss) для защиты от демпинга. ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ!',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'ID товара',
          },
          min_price: {
            type: 'number',
            description: 'Минимальная цена в рублях',
          },
          percentage: {
            type: 'number',
            description: 'Или процент от текущей цены (например 15 = -15%)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bulk_protect_products',
      description: 'Массовая защита товаров Stop-Loss. ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ!',
      parameters: {
        type: 'object',
        properties: {
          percentage: {
            type: 'number',
            description: 'Процент от текущей цены для Stop-Loss (5-50%)',
          },
          only_unprotected: {
            type: 'boolean',
            description: 'Только незащищённые товары',
          },
        },
        required: ['percentage'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_prices',
      description:
        'Изменить цены на товары. ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ! Если product_ids не указан — система возьмёт все товары (макс 10). Укажи либо price_change (в рублях), либо price_change_percent (в %).',
      parameters: {
        type: 'object',
        properties: {
          product_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Опционально: список конкретных ID товаров. Если не указать — изменятся все товары.',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'all'],
            description: 'Маркетплейс для изменения цен (по умолчанию all)',
          },
          price_change: {
            type: 'number',
            description:
              'Изменение цены в рублях. Положительное = повысить (+500), отрицательное = понизить (-200)',
          },
          price_change_percent: {
            type: 'number',
            description:
              'Или изменение в процентах. Положительное = повысить (+10), отрицательное = понизить (-5)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_orders',
      description:
        'Получить список заказов за период. Используй когда пользователь спрашивает о заказах.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'yesterday', 'week', 'month'],
            description: 'Период',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'all'],
          },
          status: {
            type: 'string',
            enum: ['all', 'new', 'processing', 'delivered', 'cancelled'],
            description: 'Статус заказов',
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_warehouse_stocks',
      description: 'Получить остатки на складах маркетплейса в реальном времени.',
      parameters: {
        type: 'object',
        properties: {
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon'],
          },
          low_stock_only: {
            type: 'boolean',
            description: 'Только товары с низким остатком (< 10 шт)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_marketplace_info',
      description:
        'Получить справочную информацию о маркетплейсе: комиссии, правила, лимиты, типичные проблемы. Используй для ответов на общие вопросы продавцов.',
      parameters: {
        type: 'object',
        properties: {
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'both'],
            description: 'Маркетплейс',
          },
          topic: {
            type: 'string',
            enum: [
              'commissions',
              'logistics',
              'payments',
              'returns',
              'promotions',
              'problems',
              'tips',
              'general',
            ],
            description:
              'Тема: commissions (комиссии), logistics (логистика), payments (выплаты), returns (возвраты), promotions (акции), problems (проблемы), tips (советы), general (общее)',
          },
        },
        required: ['topic'],
      },
    },
  },
];

/**
 * Tools that require user confirmation before execution
 */
export const CONFIRMATION_REQUIRED_TOOLS = [
  'set_stop_loss',
  'bulk_protect_products',
  'update_prices',
];

/**
 * Check if a tool requires confirmation
 */
export function requiresConfirmation(toolName: string): boolean {
  return CONFIRMATION_REQUIRED_TOOLS.includes(toolName);
}
