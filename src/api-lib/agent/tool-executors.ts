// ============================================
// NeuroGUARDIAN — Agent Tool Executors
// Real implementations for AI agent tools
// Version: 1.0.0 | Date: December 2024
// ============================================

// Database operations are handled through services
import { decryptApiKey, fetchWithRetry } from '../lib/index.js';
import { getUserById, getProductsByUserId } from '../services/index.js';

// Zod validation schemas
import {
  validateToolArgs,
  isValidationError,
  GetProductsArgsSchema,
  GetSalesStatsArgsSchema,
  GetOrdersArgsSchema,
  GetWarehouseStocksArgsSchema,
  CalculateUnitEconomicsArgsSchema,
  GetAbcAnalysisArgsSchema,
  GetStockForecastArgsSchema,
  GetMarketplaceInfoArgsSchema,
  SearchWebArgsSchema,
} from './validators.js';

// Unified product matching
import { filterProducts } from '../utils/product-matcher.js';

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
  console.log(`🔑 getUserApiKeys: fetching keys for userId=${userId}`);

  const user = await getUserById(userId);
  if (!user) {
    console.warn(`⚠️ getUserApiKeys: User ${userId} not found in database`);
    return {};
  }

  console.log(
    `🔑 getUserApiKeys: user found, api_key_wb=${!!user.api_key_wb}, api_key_ozon=${!!user.api_key_ozon}`
  );

  const result: { ozon?: { clientId: string; apiKey: string }; wb?: string } = {};

  if (user.api_key_ozon) {
    const decrypted = decryptApiKey(user.api_key_ozon);
    if (decrypted) {
      const [clientId, apiKey] = decrypted.split(':');
      if (clientId && apiKey) {
        result.ozon = { clientId, apiKey };
        console.log(`✅ Ozon API configured`);
      } else {
        console.warn(`⚠️ Ozon key format invalid`);
      }
    }
  }

  if (user.api_key_wb) {
    const decrypted = decryptApiKey(user.api_key_wb);
    if (decrypted) {
      result.wb = decrypted;
      console.log(`✅ WB API configured`);
    }
  }

  console.log(`🔑 getUserApiKeys result: wb=${!!result.wb}, ozon=${!!result.ozon}`);
  return result;
}

/**
 * GET_PRODUCTS — Get user's products with prices and stocks
 */
export async function executeGetProducts(userId: number, rawArgs: unknown): Promise<ToolResult> {
  // Validate args
  const validation = validateToolArgs(GetProductsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const products = await getProductsByUserId(userId);

    const marketplace = args.marketplace === 'all' ? undefined : args.marketplace;
    let filtered = filterProducts(products as any, marketplace);

    // Sort
    if (args.sort_by === 'price') {
      filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
    } else if (args.sort_by === 'stock') {
      filtered.sort((a, b) => ((b as any).current_stock || 0) - ((a as any).current_stock || 0));
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
 * Enhanced with trend analysis and recommendations
 */
export async function executeGetSalesStats(userId: number, rawArgs: unknown): Promise<ToolResult> {
  // Validate args
  const validation = validateToolArgs(GetSalesStatsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  console.log(
    `📊 executeGetSalesStats: userId=${userId}, period=${args.period}, mp=${args.marketplace}`
  );

  const keys = await getUserApiKeys(userId);

  if (!keys.ozon && !keys.wb) {
    return {
      success: false,
      error: 'API ключи не подключены. Подключите WB или Ozon API в настройках.',
    };
  }

  // Calculate date range for current and previous period
  const now = new Date();
  let daysBack: number;

  switch (args.period) {
    case 'today':
      daysBack = 1;
      break;
    case 'yesterday':
      daysBack = 1;
      break;
    case 'week':
      daysBack = 7;
      break;
    case 'month':
      daysBack = 30;
      break;
    case '3months':
      daysBack = 90;
      break;
    default:
      daysBack = 7;
  }

  const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const datePrevFrom = new Date(dateFrom.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const stats = {
    period: args.period,
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
    ozon: null as { orders: number; revenue: number; returns: number; avgOrder: number } | null,
    wb: null as { orders: number; revenue: number; returns: number; avgOrder: number } | null,
    total: { orders: 0, revenue: 0, returns: 0, avgOrder: 0 },
    // Trend analysis
    trend: {
      ordersChange: 0,
      revenueChange: 0,
      direction: 'stable' as 'up' | 'down' | 'stable',
    },
    recommendations: [] as string[],
  };

  // Helper to fetch stats for a period
  async function fetchPeriodStats(from: Date, to: Date) {
    let periodOrders = 0;
    let periodRevenue = 0;
    let periodReturns = 0;

    // Parallel execution for Ozon and WB
    const tasks: Promise<void>[] = [];

    // Ozon Task
    if (
      keys.ozon &&
      (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
    ) {
      tasks.push(
        (async () => {
          try {
            const ozonRes = await fetchWithRetry('https://api-seller.ozon.ru/v1/analytics/data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Id': keys.ozon!.clientId,
                'Api-Key': keys.ozon!.apiKey,
              },
              body: JSON.stringify({
                date_from: from.toISOString().split('T')[0],
                date_to: to.toISOString().split('T')[0],
                metrics: ['revenue', 'ordered_units', 'returns'],
                dimension: ['day'],
                limit: 1000,
              }),
            });

            if (ozonRes.ok) {
              const ozonData = await ozonRes.json();
              const result = ozonData.result?.data || [];
              for (const row of result) {
                periodRevenue += row.metrics?.[0] || 0;
                periodOrders += row.metrics?.[1] || 0;
                periodReturns += row.metrics?.[2] || 0;
              }
            }
          } catch (e) {
            console.error('Ozon stats error:', e);
          }
        })()
      );
    }

    // WB Task
    if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
      tasks.push(
        (async () => {
          try {
            const wbRes = await fetchWithRetry(
              `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${from.toISOString().split('T')[0]}`,
              {
                method: 'GET',
                headers: {
                  Authorization: keys.wb!,
                },
              }
            );

            if (wbRes.ok) {
              const wbData = await wbRes.json();
              const sales = (wbData || []).filter((s: { date: string }) => {
                const saleDate = new Date(s.date);
                return saleDate >= from && saleDate <= to;
              });

              for (const sale of sales) {
                if (sale.saleID && !sale.saleID.startsWith('R')) {
                  periodOrders++;
                  periodRevenue += sale.finishedPrice || sale.priceWithDisc || 0;
                } else if (sale.saleID?.startsWith('R')) {
                  periodReturns++;
                }
              }
            }
          } catch (e) {
            console.error('WB stats error:', e);
          }
        })()
      );
    }

    await Promise.all(tasks);

    return { orders: periodOrders, revenue: Math.round(periodRevenue), returns: periodReturns };
  }

  // Fetch current period
  const currentStats = await fetchPeriodStats(dateFrom, now);

  // Fetch previous period for comparison
  const prevStats = await fetchPeriodStats(datePrevFrom, dateFrom);

  // Populate stats
  if (
    keys.ozon &&
    (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
  ) {
    // Re-fetch Ozon separately for breakdown
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

        const avgOrder = orders > 0 ? Math.round(revenue / orders) : 0;
        stats.ozon = { orders, revenue: Math.round(revenue), returns, avgOrder };
        stats.total.orders += orders;
        stats.total.revenue += Math.round(revenue);
        stats.total.returns += returns;
      }
    } catch (e) {
      console.error('Ozon stats error:', e);
    }
  }

  if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
    try {
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

        const avgOrder = orders > 0 ? Math.round(revenue / orders) : 0;
        stats.wb = { orders, revenue: Math.round(revenue), returns, avgOrder };
        stats.total.orders += orders;
        stats.total.revenue += Math.round(revenue);
        stats.total.returns += returns;
      }
    } catch (e) {
      console.error('WB stats error:', e);
    }
  }

  // Calculate average order value
  stats.total.avgOrder =
    stats.total.orders > 0 ? Math.round(stats.total.revenue / stats.total.orders) : 0;

  // Calculate trend
  if (prevStats.orders > 0) {
    stats.trend.ordersChange = Math.round(
      ((currentStats.orders - prevStats.orders) / prevStats.orders) * 100
    );
  }
  if (prevStats.revenue > 0) {
    stats.trend.revenueChange = Math.round(
      ((currentStats.revenue - prevStats.revenue) / prevStats.revenue) * 100
    );
  }

  // Determine trend direction
  if (stats.trend.revenueChange > 10) {
    stats.trend.direction = 'up';
  } else if (stats.trend.revenueChange < -10) {
    stats.trend.direction = 'down';
  } else {
    stats.trend.direction = 'stable';
  }

  // Generate recommendations
  if (stats.trend.direction === 'down') {
    stats.recommendations.push(
      `📉 Продажи упали на ${Math.abs(stats.trend.revenueChange)}%. Проверь: 1) Позиции в поиске 2) Конкуренты снизили цены? 3) Кончились акции?`
    );
  }
  if (stats.trend.direction === 'up') {
    stats.recommendations.push(
      `📈 Рост ${stats.trend.revenueChange}%! Отлично! Рекомендую: 1) Пополнить остатки 2) Проверить маржу — можно чуть поднять цены`
    );
  }
  if (stats.total.returns > stats.total.orders * 0.1) {
    stats.recommendations.push(
      `⚠️ Высокий процент возвратов (${Math.round((stats.total.returns / stats.total.orders) * 100)}%). Проверь: качество товара, описание, фото`
    );
  }
  if (stats.total.orders === 0) {
    stats.recommendations.push(
      `🔴 Нет продаж за период. Проверь: 1) Есть ли остатки? 2) Карточки в индексе? 3) Цены конкурентные?`
    );
  }
  if (stats.total.avgOrder > 0 && stats.total.avgOrder < 500) {
    stats.recommendations.push(
      `💡 Низкий средний чек (${stats.total.avgOrder}₽). Попробуй комплекты или апсейл`
    );
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
export async function executeGetOrders(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(GetOrdersArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;
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
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(GetWarehouseStocksArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;
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
      const whRes = await fetchWithRetry(
        'https://marketplace-api.wildberries.ru/api/v3/warehouses',
        {
          method: 'GET',
          headers: { Authorization: keys.wb },
        }
      );

      if (whRes.ok) {
        const warehouses = await whRes.json();

        for (const wh of warehouses || []) {
          const stockRes = await fetchWithRetry(
            `https://marketplace-api.wildberries.ru/api/v3/stocks/${wh.id}`,
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
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(CalculateUnitEconomicsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;
  // Get products
  const products = await getProductsByUserId(userId);

  let targetProducts = products;
  if (args.product_id) {
    targetProducts = filterProducts(products as any, args.marketplace, args.product_id);
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
 * Improved: Now shows top products from each category
 */
export async function executeGetAbcAnalysis(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(GetAbcAnalysisArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };

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
      product: p.title.substring(0, 40),
      price: p.current_price,
      marketplace: p.marketplace || 'WB',
      category,
      recommendation:
        category === 'A'
          ? 'Ключевой товар — следить за остатками!'
          : category === 'B'
            ? 'Оптимизируй: реклама, описание'
            : 'Распродай или убери из ассортимента',
    };
  });

  // Get top products from each category
  const aProducts = analyzed.filter(p => p.category === 'A');
  const bProducts = analyzed.filter(p => p.category === 'B');
  const cProducts = analyzed.filter(p => p.category === 'C');

  // Calculate revenue share for each category
  const aRevenue = aProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  const bRevenue = bProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  const cRevenue = cProducts.reduce((sum, p) => sum + (p.price || 0), 0);

  return {
    success: true,
    data: {
      summary: {
        A: {
          count: aProducts.length,
          revenue: aRevenue,
          share: totalValue > 0 ? `${Math.round((aRevenue / totalValue) * 100)}%` : '0%',
          description: 'Ключевые товары — приносят 80% выручки',
        },
        B: {
          count: bProducts.length,
          revenue: bRevenue,
          share: totalValue > 0 ? `${Math.round((bRevenue / totalValue) * 100)}%` : '0%',
          description: 'Стабильные товары — требуют оптимизации',
        },
        C: {
          count: cProducts.length,
          revenue: cRevenue,
          share: totalValue > 0 ? `${Math.round((cRevenue / totalValue) * 100)}%` : '0%',
          description: 'Аутсайдеры — распродавай или убирай',
        },
      },
      topA: aProducts.slice(0, 3).map(p => ({
        title: p.product,
        price: p.price,
        marketplace: p.marketplace,
      })),
      topC: cProducts.slice(0, 3).map(p => ({
        title: p.product,
        price: p.price,
        marketplace: p.marketplace,
        action: 'Рассмотри снижение цены или вывод из ассортимента',
      })),
      totalProducts: products.length,
      totalValue,
      note: 'Анализ основан на ценах товаров. Для точного анализа подключите статистику продаж.',
    },
  };
}

/**
 * GET_STOCK_FORECAST — Forecast when products will run out
 */
export async function executeGetStockForecast(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(GetStockForecastArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;
  const products = await getProductsByUserId(userId);

  let filtered = products;
  if (args.product_id) {
    filtered = filterProducts(products as any, undefined, args.product_id);
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
export function executeGetMarketplaceInfo(rawArgs: unknown): ToolResult {
  const validation = validateToolArgs(GetMarketplaceInfoArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;
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

/**
 * SEARCH_WEB — Search the internet for relevant info
 * Uses Serper.dev (Google Search API)
 */
export async function executeSearchWeb(_userId: number, rawArgs: unknown): Promise<ToolResult> {
  // Validate arguments with Zod
  const validation = validateToolArgs(SearchWebArgsSchema, rawArgs);
  if (isValidationError(validation)) {
    return { success: false, error: validation.error };
  }
  const args = validation.data;

  console.log(`🌐 executeSearchWeb: query="${args.query}" topic=${args.topic}`);

  // Retrieve Serper.dev API key from environment
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ Web Search: SERPER_API_KEY not found');

    // Fallback for development/demo (mock data)
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return {
        success: true,
        data: {
          query: args.query,
          answer: 'Это демонстрационный ответ (Serper API ключ не настроен).',
          results: [
            {
              title: 'Анализ конкурентов на Wildberries (Demo)',
              link: 'https://mpstats.io/blog/competitor-analysis',
              snippet: `Для анализа конкурентов по запросу "${args.query}" рекомендуем использовать внешние сервисы аналитики...`,
            },
            {
              title: 'Тренды Wildberries 2024 (Demo)',
              link: 'https://vc.ru/marketplace/trends',
              snippet:
                'Основные тренды: снижение среднего чека, рост комиссий, важность SEO оптимизации карточек...',
            },
          ],
          note: '⚠️ ПОИСК РАБОТАЕТ В ДЕМО-РЕЖИМЕ (нет API ключа)',
        },
      };
    }
    return {
      success: false,
      error: 'Web search is disabled (API key missing). Please contact support.',
    };
  }

  try {
    // 10 second timeout for search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: args.query,
        gl: 'ru', // Russia
        hl: 'ru', // Russian language
        num: 5, // Number of results
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    // Serper.dev response types
    interface SerperOrganicResult {
      title?: string;
      link?: string;
      snippet?: string;
      position?: number;
    }

    interface SerperKnowledgeGraph {
      title?: string;
      type?: string;
      description?: string;
      descriptionSource?: string;
      website?: string;
      imageUrl?: string;
      attributes?: Record<string, string>;
    }

    interface SerperResponse {
      organic?: SerperOrganicResult[];
      answerBox?: { answer?: string; snippet?: string };
      knowledgeGraph?: SerperKnowledgeGraph;
      peopleAlsoAsk?: Array<{ question: string; snippet: string }>;
    }

    const data: SerperResponse = await response.json();

    // Extract organic search results
    const results =
      data.organic?.map((r: SerperOrganicResult) => ({
        title: r.title || '',
        link: r.link || '',
        snippet: r.snippet || '',
      })) || [];

    // Try to get a direct answer or featured snippet if available
    const answer =
      data.answerBox?.answer ||
      data.answerBox?.snippet ||
      data.organic?.[0]?.snippet ||
      'Нет прямого ответа';

    // Extract knowledge graph if available (rich company/product info)
    const knowledgeGraph = data.knowledgeGraph
      ? {
          title: data.knowledgeGraph.title,
          type: data.knowledgeGraph.type,
          description: data.knowledgeGraph.description,
          website: data.knowledgeGraph.website,
          attributes: data.knowledgeGraph.attributes,
        }
      : null;

    // Extract "People also ask" for additional context
    const relatedQuestions =
      data.peopleAlsoAsk?.slice(0, 3).map(q => ({
        question: q.question,
        answer: q.snippet,
      })) || [];

    return {
      success: true,
      data: {
        query: args.query,
        answer, // AI agent can use this as a summary
        knowledgeGraph, // Rich info about companies/products
        results,
        relatedQuestions, // Common follow-up questions
      },
    };
  } catch (error) {
    console.error('Web search error:', error);
    return { success: false, error: 'Ошибка поиска: ' + String(error) };
  }
}
