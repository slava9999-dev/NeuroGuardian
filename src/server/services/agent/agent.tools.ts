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
        'Изменить цены на товары. ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ! Используй когда пользователь хочет поднять/понизить цены.',
      parameters: {
        type: 'object',
        properties: {
          product_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Список ID товаров',
          },
          price_change: {
            type: 'number',
            description: 'Изменение цены в рублях (+500 или -200)',
          },
          price_change_percent: {
            type: 'number',
            description: 'Или изменение в процентах (+10 или -5)',
          },
        },
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
];
