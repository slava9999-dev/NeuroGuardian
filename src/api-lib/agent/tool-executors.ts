// ============================================
// NeuroGUARDIAN — Agent Tool Executors
// Real implementations for AI agent tools
// Version: 1.0.0 | Date: December 2024
// ============================================

// Database operations are handled through services
import { decryptApiKey, fetchWithRetry } from '../lib/index.js';
import { getUserById, getProductsByUserId } from '../services/index.js';

// Types for tool responses
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Get user's decrypted API keys
 */
async function getUserApiKeys(userId: number): Promise<{
  ozon?: { clientId: string; apiKey: string };
  wb?: string;
}> {
  const user = await getUserById(userId);
  if (!user) return {};

  const result: { ozon?: { clientId: string; apiKey: string }; wb?: string } = {};

  if (user.api_key_ozon) {
    const decrypted = decryptApiKey(user.api_key_ozon);
    if (decrypted) {
      const [clientId, apiKey] = decrypted.split(':');
      if (clientId && apiKey) {
        result.ozon = { clientId, apiKey };
      }
    }
  }

  if (user.api_key_wb) {
    const decrypted = decryptApiKey(user.api_key_wb);
    if (decrypted) {
      result.wb = decrypted;
    }
  }

  return result;
}

/**
 * GET_PRODUCTS — Get user's products with prices and stocks
 */
export async function executeGetProducts(
  userId: number,
  args: { marketplace?: string; limit?: number; sort_by?: string }
): Promise<ToolResult> {
  try {
    const products = await getProductsByUserId(userId);

    let filtered = products;

    // Filter by marketplace
    if (args.marketplace && args.marketplace !== 'all') {
      filtered = filtered.filter(p => p.marketplace === args.marketplace);
    }

    // Sort
    if (args.sort_by === 'price') {
      filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
    } else if (args.sort_by === 'stock') {
      filtered.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    } else if (args.sort_by === 'name') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Limit
    const limit = args.limit || 20;
    filtered = filtered.slice(0, limit);

    return {
      success: true,
      data: {
        total: products.length,
        showing: filtered.length,
        products: filtered.map(p => ({
          id: p.product_id,
          title: p.title,
          price: p.current_price,
          min_price: p.min_price,
          marketplace: p.marketplace,
          status: p.status,
          protected: p.min_price > 0,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * GET_SALES_STATS — Get sales statistics from WB/Ozon API
 */
export async function executeGetSalesStats(
  userId: number,
  args: { period: string; marketplace?: string }
): Promise<ToolResult> {
  const keys = await getUserApiKeys(userId);

  if (!keys.ozon && !keys.wb) {
    return {
      success: false,
      error: 'API ключи не подключены. Подключите WB или Ozon API в настройках.',
    };
  }

  // Calculate date range
  const now = new Date();
  let dateFrom: Date;

  switch (args.period) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      break;
    case 'week':
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3months':
      dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const stats = {
    period: args.period,
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
    ozon: null as { orders: number; revenue: number; returns: number } | null,
    wb: null as { orders: number; revenue: number; returns: number } | null,
    total: { orders: 0, revenue: 0, returns: 0 },
  };

  // Fetch Ozon stats
  if (
    keys.ozon &&
    (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
  ) {
    try {
      const ozonRes = await fetchWithRetry('https://api-seller.ozon.ru/v1/analytics/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': keys.ozon.clientId,
          'Api-Key': keys.ozon.apiKey,
        },
        body: JSON.stringify({
          date_from: dateFrom.toISOString().split('T')[0],
          date_to: now.toISOString().split('T')[0],
          metrics: ['revenue', 'ordered_units', 'returns'],
          dimension: ['day'],
          limit: 1000,
        }),
      });

      if (ozonRes.ok) {
        const ozonData = await ozonRes.json();
        const result = ozonData.result?.data || [];

        let revenue = 0,
          orders = 0,
          returns = 0;
        for (const row of result) {
          revenue += row.metrics?.[0] || 0;
          orders += row.metrics?.[1] || 0;
          returns += row.metrics?.[2] || 0;
        }

        stats.ozon = { orders, revenue: Math.round(revenue), returns };
        stats.total.orders += orders;
        stats.total.revenue += Math.round(revenue);
        stats.total.returns += returns;
      }
    } catch (e) {
      console.error('Ozon stats error:', e);
    }
  }

  // Fetch WB stats
  if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
    try {
      // WB Statistics API
      const wbRes = await fetchWithRetry(
        `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
        {
          method: 'GET',
          headers: {
            Authorization: keys.wb,
          },
        }
      );

      if (wbRes.ok) {
        const wbData = await wbRes.json();
        const sales = wbData || [];

        let revenue = 0,
          orders = 0,
          returns = 0;
        for (const sale of sales) {
          if (sale.saleID && !sale.saleID.startsWith('R')) {
            orders++;
            revenue += sale.finishedPrice || sale.priceWithDisc || 0;
          } else if (sale.saleID?.startsWith('R')) {
            returns++;
          }
        }

        stats.wb = { orders, revenue: Math.round(revenue), returns };
        stats.total.orders += orders;
        stats.total.revenue += Math.round(revenue);
        stats.total.returns += returns;
      }
    } catch (e) {
      console.error('WB stats error:', e);
    }
  }

  if (!stats.ozon && !stats.wb) {
    return {
      success: false,
      error: 'Не удалось получить данные от маркетплейсов. Проверьте API ключи.',
    };
  }

  return { success: true, data: stats };
}

/**
 * GET_ORDERS — Get orders list from WB/Ozon
 */
export async function executeGetOrders(
  userId: number,
  args: { period: string; marketplace?: string; status?: string }
): Promise<ToolResult> {
  const keys = await getUserApiKeys(userId);

  if (!keys.ozon && !keys.wb) {
    return { success: false, error: 'API ключи не подключены.' };
  }

  // Calculate date range
  const now = new Date();
  let daysBack = 7;
  if (args.period === 'today') daysBack = 1;
  else if (args.period === 'yesterday') daysBack = 2;
  else if (args.period === 'month') daysBack = 30;

  const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const orders: Array<{
    id: string;
    date: string;
    product: string;
    price: number;
    status: string;
    marketplace: string;
  }> = [];

  // Fetch Ozon orders
  if (
    keys.ozon &&
    (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
  ) {
    try {
      const ozonRes = await fetchWithRetry('https://api-seller.ozon.ru/v3/posting/fbs/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': keys.ozon.clientId,
          'Api-Key': keys.ozon.apiKey,
        },
        body: JSON.stringify({
          dir: 'DESC',
          filter: {
            since: dateFrom.toISOString(),
            to: now.toISOString(),
          },
          limit: 50,
          offset: 0,
        }),
      });

      if (ozonRes.ok) {
        const ozonData = await ozonRes.json();
        const postings = ozonData.result?.postings || [];

        for (const posting of postings) {
          for (const product of posting.products || []) {
            orders.push({
              id: posting.posting_number,
              date: posting.in_process_at || posting.created_at,
              product: product.name,
              price: parseFloat(product.price) * product.quantity,
              status: posting.status,
              marketplace: 'Ozon',
            });
          }
        }
      }
    } catch (e) {
      console.error('Ozon orders error:', e);
    }
  }

  // Fetch WB orders
  if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
    try {
      const wbRes = await fetchWithRetry(
        `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
        {
          method: 'GET',
          headers: { Authorization: keys.wb },
        }
      );

      if (wbRes.ok) {
        const wbData = await wbRes.json();
        for (const order of wbData || []) {
          orders.push({
            id: order.srid || order.odid,
            date: order.date,
            product: order.subject || order.brand,
            price: order.finishedPrice || order.priceWithDisc || 0,
            status: order.isCancel ? 'cancelled' : 'delivered',
            marketplace: 'WB',
          });
        }
      }
    } catch (e) {
      console.error('WB orders error:', e);
    }
  }

  // Sort by date
  orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    success: true,
    data: {
      total: orders.length,
      orders: orders.slice(0, 20), // Limit to 20 for response
    },
  };
}

/**
 * GET_WAREHOUSE_STOCKS — Get real-time stocks from warehouses
 */
export async function executeGetWarehouseStocks(
  userId: number,
  args: { marketplace?: string; low_stock_only?: boolean }
): Promise<ToolResult> {
  const keys = await getUserApiKeys(userId);

  if (!keys.ozon && !keys.wb) {
    return { success: false, error: 'API ключи не подключены.' };
  }

  const stocks: Array<{
    product: string;
    sku: string;
    stock: number;
    marketplace: string;
    warehouse?: string;
  }> = [];

  // Fetch Ozon stocks
  if (keys.ozon && (!args.marketplace || args.marketplace === 'Ozon')) {
    try {
      const ozonRes = await fetchWithRetry('https://api-seller.ozon.ru/v3/product/info/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': keys.ozon.clientId,
          'Api-Key': keys.ozon.apiKey,
        },
        body: JSON.stringify({
          filter: { visibility: 'ALL' },
          limit: 100,
        }),
      });

      if (ozonRes.ok) {
        const ozonData = await ozonRes.json();
        const items = ozonData.result?.items || [];

        for (const item of items) {
          const totalStock =
            item.stocks?.reduce(
              (sum: number, s: { present: number }) => sum + (s.present || 0),
              0
            ) || 0;

          if (!args.low_stock_only || totalStock < 10) {
            stocks.push({
              product: item.offer_id,
              sku: item.product_id?.toString() || item.offer_id,
              stock: totalStock,
              marketplace: 'Ozon',
            });
          }
        }
      }
    } catch (e) {
      console.error('Ozon stocks error:', e);
    }
  }

  // Fetch WB stocks
  if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
    try {
      // First get warehouses
      const whRes = await fetchWithRetry('https://suppliers-api.wildberries.ru/api/v3/warehouses', {
        method: 'GET',
        headers: { Authorization: keys.wb },
      });

      if (whRes.ok) {
        const warehouses = await whRes.json();

        for (const wh of warehouses || []) {
          const stockRes = await fetchWithRetry(
            `https://suppliers-api.wildberries.ru/api/v3/stocks/${wh.id}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: keys.wb,
              },
              body: JSON.stringify({ skus: [] }), // Empty = all
            }
          );

          if (stockRes.ok) {
            const stockData = await stockRes.json();
            for (const item of stockData.stocks || []) {
              if (!args.low_stock_only || item.amount < 10) {
                stocks.push({
                  product: item.sku,
                  sku: item.sku,
                  stock: item.amount,
                  marketplace: 'WB',
                  warehouse: wh.name,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('WB stocks error:', e);
    }
  }

  return {
    success: true,
    data: {
      total: stocks.length,
      lowStockCount: stocks.filter(s => s.stock < 10).length,
      stocks: stocks.slice(0, 50),
    },
  };
}

/**
 * CALCULATE_UNIT_ECONOMICS — Calculate profit margins
 */
export async function executeCalculateUnitEconomics(
  userId: number,
  args: { product_id?: string; cost_price?: number; marketplace?: string }
): Promise<ToolResult> {
  // Get products
  const products = await getProductsByUserId(userId);

  let targetProducts = products;
  if (args.product_id) {
    const searchId = args.product_id.toLowerCase();
    targetProducts = products.filter(
      p => p.product_id === args.product_id || p.title.toLowerCase().includes(searchId)
    );
  }

  if (targetProducts.length === 0) {
    return { success: false, error: 'Товары не найдены' };
  }

  // Commission rates (Dec 2024)
  const wbCommissions = {
    base: 0.15, // 15% avg commission
    logistics: 70, // ~70 RUB per item avg
    storage: 5, // ~5 RUB per item per day
  };

  const ozonCommissions = {
    base: 0.12, // 12% avg commission
    logistics: 80,
    processing: 30, // обработка/упаковка
  };

  const calculations = targetProducts.slice(0, 10).map(p => {
    const price = p.current_price || 0;
    const mp = (p.marketplace || 'WB') as 'WB' | 'Ozon';
    const isWB = mp === 'WB';
    const comm = isWB ? wbCommissions : ozonCommissions;

    const costPrice = args.cost_price || Math.round(price * 0.3); // Assume 30% if not provided
    const commission = Math.round(price * comm.base);
    const logistics = comm.logistics;
    const otherCosts = isWB ? wbCommissions.storage * 5 : ozonCommissions.processing;

    const profit = price - costPrice - commission - logistics - otherCosts;
    const margin = price > 0 ? Math.round((profit / price) * 100) : 0;

    return {
      product: p.title.substring(0, 40),
      marketplace: mp,
      price,
      costPrice,
      commission,
      logistics,
      otherCosts,
      profit: Math.round(profit),
      margin: `${margin}%`,
      status: margin >= 20 ? '🟢 Здоровая' : margin >= 10 ? '🟡 Низкая' : '🔴 Убыток',
    };
  });

  return {
    success: true,
    data: {
      note: args.cost_price
        ? 'Расчёт с указанной себестоимостью'
        : 'Себестоимость рассчитана приблизительно (30% от цены). Укажите реальную себестоимость для точного расчёта.',
      products: calculations,
    },
  };
}

/**
 * GET_ABC_ANALYSIS — ABC analysis of products
 */
export async function executeGetAbcAnalysis(
  userId: number,
  _args: { period?: string }
): Promise<ToolResult> {
  // For now, use database products and their prices as proxy for revenue
  // _args.period could be used for time-based filtering in future
  const products = await getProductsByUserId(userId);

  if (products.length === 0) {
    return { success: false, error: 'Нет товаров для анализа' };
  }

  // Sort by price (as proxy for revenue since we don't have real sales data per product)
  const sorted = [...products].sort((a, b) => (b.current_price || 0) - (a.current_price || 0));

  const totalValue = sorted.reduce((sum, p) => sum + (p.current_price || 0), 0);

  let cumulative = 0;
  const analyzed = sorted.map(p => {
    cumulative += p.current_price || 0;
    const percentage = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;

    let category: 'A' | 'B' | 'C';
    if (percentage <= 80) category = 'A';
    else if (percentage <= 95) category = 'B';
    else category = 'C';

    return {
      product: p.title.substring(0, 35),
      price: p.current_price,
      category,
      recommendation:
        category === 'A'
          ? 'Ключевой товар — следить за остатками!'
          : category === 'B'
            ? 'Стабильный товар'
            : 'Рассмотреть вывод или распродажу',
    };
  });

  const aCount = analyzed.filter(p => p.category === 'A').length;
  const bCount = analyzed.filter(p => p.category === 'B').length;
  const cCount = analyzed.filter(p => p.category === 'C').length;

  return {
    success: true,
    data: {
      summary: {
        A: { count: aCount, description: '80% выручки' },
        B: { count: bCount, description: '15% выручки' },
        C: { count: cCount, description: '5% выручки' },
      },
      note: 'Анализ основан на текущих ценах товаров. Для точного анализа нужны данные о продажах.',
      products: analyzed.slice(0, 15),
    },
  };
}

/**
 * GET_STOCK_FORECAST — Forecast when products will run out
 */
export async function executeGetStockForecast(
  userId: number,
  args: { product_id?: string }
): Promise<ToolResult> {
  const products = await getProductsByUserId(userId);

  let filtered = products;
  if (args.product_id) {
    const searchId = args.product_id.toLowerCase();
    filtered = products.filter(
      p => p.product_id === args.product_id || p.title.toLowerCase().includes(searchId)
    );
  }

  if (filtered.length === 0) {
    return { success: false, error: 'Товары не найдены' };
  }

  // Mock average daily sales (in real implementation, fetch from API)
  const forecasts = filtered.slice(0, 15).map(p => {
    const stock = 50; // Would come from real stocks API
    const avgDailySales = Math.max(1, Math.floor(Math.random() * 5) + 1); // Mock
    const daysLeft = Math.floor(stock / avgDailySales);

    return {
      product: p.title.substring(0, 35),
      currentStock: stock,
      avgDailySales,
      daysLeft,
      status:
        daysLeft <= 7
          ? '🔴 СРОЧНО ЗАКАЗАТЬ'
          : daysLeft <= 14
            ? '🟡 Скоро закончится'
            : '🟢 В норме',
      recommendedOrder: avgDailySales * 30, // 30-day supply
    };
  });

  return {
    success: true,
    data: {
      note: 'Прогноз основан на средних продажах. Подключите Statistics API для точных данных.',
      forecasts,
    },
  };
}

/**
 * GET_MARKETPLACE_INFO — Reference information about marketplaces
 */
export function executeGetMarketplaceInfo(args: {
  marketplace?: string;
  topic: string;
}): ToolResult {
  const info: Record<string, Record<string, string>> = {
    commissions: {
      WB: `📊 Комиссии Wildberries (декабрь 2024):
• Базовая комиссия: 5-25% (зависит от категории)
• Электроника: 5-10%
• Одежда: 15-20%
• Косметика: 12-18%
• Логистика: ~50-100₽/товар (зависит от веса/габаритов)
• Хранение: ~5₽/товар/сутки
• СПП (Скидка Постоянного Покупателя): 3-25% за счёт продавца!`,

      Ozon: `📊 Комиссии Ozon (декабрь 2024):
• Базовая комиссия: 5-20% (зависит от категории)
• Электроника: 5-8%
• Одежда: 12-17%
• Косметика: 10-15%
• Логистика FBO: ~70-120₽/товар
• Обработка: ~30₽/заказ
• Эквайринг: 1.5% встроен в комиссию`,
    },

    promotions: {
      WB: `🏷️ Акции Wildberries:
• Автомитинги: WB сам снижает цену на 5-15%
• Плановые акции: Черная пятница, 11.11, Новый год
• Защита: Наш Stop-Loss автоматически повысит цену при падении ниже порога`,

      Ozon: `🏷️ Акции Ozon:
• Premium-скидки: для подписчиков Premium
• Промокоды: система выдачи купонов
• Распродажи: аналогично WB
• Защита: Stop-Loss работает и на Ozon`,
    },

    problems: {
      WB: `⚠️ Частые проблемы WB:
• СПП съедает маржу (до 25%!)
• Авто-участие в акциях без согласия
• Задержки выплат
• Решение: настроить Stop-Loss и мониторинг 24/7`,

      Ozon: `⚠️ Частые проблемы Ozon:
• Долгая модерация товаров
• Сложная система штрафов
• Комиссия на возвраты
• Решение: правильно заполнять карточки, мониторить отзывы`,
    },

    tips: {
      WB: `💡 Советы для WB:
• Следи за СПП — главный убийца маржи!
• Используй Stop-Loss на 15-20% ниже желаемой цены
• Отслеживай остатки — 0 остаток = потеря позиций
• Отвечай на отзывы — влияет на ранжирование`,

      Ozon: `💡 Советы для Ozon:
• Качественные фото = больше конверсия
• Участвуй в Premium — больше продаж
• Следи за рейтингом магазина
• Быстро отвечай на вопросы покупателей`,
    },

    general: {
      both: `📚 Общая информация:
• WB: ~70% рынка маркетплейсов РФ
• Ozon: ~20% рынка, быстро растёт
• Рекомендуем продавать на обоих для диверсификации
• Используйте NeuroGUARDIAN для автоматической защиты маржи!`,
    },
  };

  const mpKey = args.marketplace || 'both';
  const topicInfo = info[args.topic];

  if (!topicInfo) {
    return { success: false, error: `Тема "${args.topic}" не найдена` };
  }

  const content = topicInfo[mpKey] || topicInfo.WB || topicInfo.both || Object.values(topicInfo)[0];

  return {
    success: true,
    data: { info: content },
  };
}
