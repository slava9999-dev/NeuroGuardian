// ============================================
// NeuroGUARDIAN — Agent Tool Executors
// Real implementations for AI agent tools
// Version: 1.0.0 | Date: December 2024
// ============================================

// Database operations are handled through services
import { syncSalesHistory } from '../services/marketplace.js';
import {
  getProductsByUserId,
  getSalesHistory,
  getMarketplaceKeys,
  fetchWbOrders,
  fetchOzonFbsUnfulfilledOrders,
  fetchOzonAnalytics,
  fetchWbStocks,
  fetchOzonStocksV3,
  getSystemEvents,
  updateProductCostPrice,
  updateProductCategory,
  updateProductMonitoring,
} from '../services/index.js';
import { getUserReviews } from '../services/reviews-service.js';

import { getSecret } from '../lib/index.js';

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
  GetMarketplaceAccountsArgsSchema,
  SearchWebArgsSchema,
  UpdatePricesArgsSchema,
  UpdateStocksArgsSchema,
  SetStopLossArgsSchema,
  BulkProtectProductsArgsSchema,
  GetSystemLogsArgsSchema,
  GetLowMarginProductsArgsSchema,
  UpdateProductSettingsArgsSchema,
} from './validators.js';
import type { DBProduct } from '../lib/types.js';
import type { WbStatisticsSale } from '../lib/marketplace-types.js';

// Unified product matching
import { filterProducts } from '../utils/product-matcher.js';

// Types for tool responses
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Product interface for type safety
interface Product {
  product_id: string;
  nm_id?: number;
  offer_id?: string;
  title: string;
  current_price: number;
  min_price?: number;
  current_stock?: number;
  marketplace: string;
  status?: string;
  cost_price?: number;
  category?: string;
}

// Forecast interface
interface Forecast {
  status: string;
  title?: string;
  stock?: number;
  velocity?: number;
  daysRemaining?: number | null;
  recommendation?: string;
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
    const products = await getProductsByUserId(userId, args.account_id);

    const marketplace = args.marketplace === 'all' ? undefined : args.marketplace;
    let filtered = filterProducts(products, marketplace);

    // Sort
    if (args.sort_by === 'price') {
      filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
    } else if (args.sort_by === 'stock') {
      filtered.sort((a, b) => (b.current_stock || 0) - (a.current_stock || 0));
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
          cost_price: p.cost_price || 0,
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
    `📊 executeGetSalesStats: userId=${userId}, period=${args.period}, mp=${args.marketplace}, account=${args.account_id}`
  );

  const keys = await getMarketplaceKeys(userId, args.account_id);

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

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    // Ozon Stats
    if (
      keys.ozon &&
      (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
    ) {
      try {
        const rows = await fetchOzonAnalytics(keys.ozon.clientId, keys.ozon.apiKey, fromStr, toStr);
        for (const row of rows) {
          periodRevenue += row.metrics?.[0] || 0;
          periodOrders += row.metrics?.[1] || 0;
          periodReturns += row.metrics?.[2] || 0;
        }
      } catch (e) {
        console.error('Ozon stats error:', e);
      }
    }

    // WB Stats
    if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
      try {
        const wbOrders = await fetchWbOrders(keys.wb, from);
        const filtered = wbOrders.filter(
          (s: WbStatisticsSale): s is WbStatisticsSale & { date: string } => {
            if (!s.date) return false;
            const saleDate = new Date(s.date);
            return saleDate >= from && saleDate <= to;
          }
        );

        for (const sale of filtered) {
          if (sale.saleID && !sale.saleID.startsWith('R')) {
            periodOrders++;
            periodRevenue += sale.finishedPrice || sale.priceWithDisc || 0;
          } else if (sale.saleID?.startsWith('R')) {
            periodReturns++;
          }
        }
      } catch (e) {
        console.error('WB stats error:', e);
      }
    }

    return {
      orders: periodOrders,
      revenue: Math.round(periodRevenue),
      returns: periodReturns,
      avgOrder: periodOrders > 0 ? Math.round(periodRevenue / periodOrders) : 0,
    };
  }

  // Fetch current and previous period
  const [currentStats, prevStats] = await Promise.all([
    fetchPeriodStats(dateFrom, now),
    fetchPeriodStats(datePrevFrom, dateFrom),
  ]);

  // Fill breakdown for current period
  if (
    keys.ozon &&
    (!args.marketplace || args.marketplace === 'Ozon' || args.marketplace === 'all')
  ) {
    try {
      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = now.toISOString().split('T')[0];
      const rows = await fetchOzonAnalytics(keys.ozon.clientId, keys.ozon.apiKey, fromStr, toStr);

      let revenue = 0,
        orders = 0,
        returns = 0;
      for (const row of rows) {
        revenue += row.metrics?.[0] || 0;
        orders += row.metrics?.[1] || 0;
        returns += row.metrics?.[2] || 0;
      }
      stats.ozon = {
        orders,
        revenue: Math.round(revenue),
        returns,
        avgOrder: orders > 0 ? Math.round(revenue / orders) : 0,
      };
    } catch (e) {
      console.error('Ozon breakdown error:', e);
    }
  }

  if (keys.wb && (!args.marketplace || args.marketplace === 'WB' || args.marketplace === 'all')) {
    try {
      const wbOrders = await fetchWbOrders(keys.wb, dateFrom);
      let revenue = 0,
        orders = 0,
        returns = 0;
      for (const sale of wbOrders) {
        if (sale.saleID && !sale.saleID.startsWith('R')) {
          orders++;
          revenue += sale.finishedPrice || sale.priceWithDisc || 0;
        } else if (sale.saleID?.startsWith('R')) {
          returns++;
        }
      }
      stats.wb = {
        orders,
        revenue: Math.round(revenue),
        returns,
        avgOrder: orders > 0 ? Math.round(revenue / orders) : 0,
      };
    } catch (e) {
      console.error('WB breakdown error:', e);
    }
  }

  stats.total = currentStats;

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
  const keys = await getMarketplaceKeys(userId, args.account_id);

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
  if (keys.ozon && (!args.marketplace || args.marketplace === 'Ozon')) {
    try {
      const postings = await fetchOzonFbsUnfulfilledOrders(keys.ozon.clientId, keys.ozon.apiKey);
      for (const posting of postings) {
        orders.push({
          id: posting.posting_number,
          date: posting.in_process_at || posting.created_at,
          product: posting.products?.[0]?.name || 'Товар Ozon',
          price: parseFloat(posting.financial_data?.products?.[0]?.price || '0'),
          status: posting.status,
          marketplace: 'Ozon',
        });
      }
    } catch (e) {
      console.error('Ozon orders error:', e);
    }
  }

  // Fetch WB orders
  if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
    try {
      const wbOrders = await fetchWbOrders(keys.wb, dateFrom);
      for (const order of wbOrders) {
        if (args.status === 'new' || (order.saleID && !order.saleID.startsWith('R'))) {
          orders.push({
            id: order.srid || order.saleID || 'unknown',
            date: order.date || new Date().toISOString(),
            product: order.subject || order.brand || 'Товар WB',
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
  const keys = await getMarketplaceKeys(userId, args.account_id);

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
      const items = await fetchOzonStocksV3(keys.ozon.clientId, keys.ozon.apiKey);

      for (const item of items) {
        const totalStock =
          item.stocks?.reduce((sum: number, s: { present: number }) => sum + (s.present || 0), 0) ||
          0;

        if (!args.low_stock_only || totalStock < 10) {
          stocks.push({
            product: item.offer_id,
            sku: item.product_id?.toString() || item.offer_id,
            stock: totalStock,
            marketplace: 'Ozon',
          });
        }
      }
    } catch (e) {
      console.error('Ozon stocks error:', e);
    }
  }

  // Fetch WB stocks
  if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
    try {
      // Use existing fetchWbStocks helper which does FBO+FBS
      const wbStocks = await fetchWbStocks(keys.wb, []);

      // In this tool we want detailed stocks by SKU if possible,
      // but fetchWbStocks returns a summary map nmId -> stock.
      // We can iterate the map.
      wbStocks.forEach((stock, nmId) => {
        if (!args.low_stock_only || stock < 10) {
          stocks.push({
            product: `Товар ${nmId}`,
            sku: String(nmId),
            stock: stock,
            marketplace: 'WB',
          });
        }
      });
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
 * IMPROVED (Dec 2024): Uses real cost_price from database when available
 * Honest about estimation quality
 */
export async function executeCalculateUnitEconomics(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(CalculateUnitEconomicsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  // Get products with cost_price
  const products = await getProductsByUserId(userId, args.account_id);

  let targetProducts = products;
  if (args.product_id) {
    targetProducts = filterProducts(products, args.marketplace, args.product_id);
  }

  if (targetProducts.length === 0) {
    return { success: false, error: 'Товары не найдены' };
  }

  // Marketplace commission rates - NOW USES CENTRALIZED SERVICE
  // Removed hardcoded constants (Dec 2024 Audit fix)
  // getCommissionRate() returns category-specific rates from unit-economics.ts

  // Count products with real cost data
  const productsWithCost = targetProducts.filter(
    (p: DBProduct) => p.cost_price && p.cost_price > 0
  );
  const costDataCoverage = Math.round((productsWithCost.length / targetProducts.length) * 100);

  const calculations = await Promise.all(
    targetProducts.slice(0, 10).map(async (p: DBProduct) => {
      const mp = (p.marketplace || 'WB') as 'WB' | 'Ozon';

      // Call the centralized service
      const { calculateUnitEconomics, estimateCostPrice } =
        await import('../services/unit-economics.js');

      // Use real cost_price if available in DB, then from args, then estimate based on category
      let costPrice = p.cost_price || args.cost_price;
      let costSource = '';

      if (costPrice && costPrice > 0) {
        costSource = p.cost_price ? 'из БД' : 'указана вами';
      } else {
        const estimate = estimateCostPrice(p.current_price || 0, p.category || undefined);
        costPrice = estimate.costPrice;
        costSource = `⚠️ оценка ${Math.round((costPrice / (p.current_price || 1)) * 100)}% (по категории)`;
      }

      const result = calculateUnitEconomics({
        price: p.current_price || 0,
        costPrice,
        category: p.category ?? undefined,
        marketplace: mp,
        useOzonCard: true, // Account for Ozon Card by default as per TZ 2.0
      });

      return {
        product: p.title.substring(0, 40),
        marketplace: mp,
        price: result.revenue,
        costPrice: result.costPrice,
        costSource,
        commission: result.commission,
        commissionRate: `${Math.round(result.commissionRate * 100)}%`,
        logistics: result.logistics,
        otherCosts: result.storage + result.spp + result.acquiring + result.ozonCardCosts,
        ozonCard: mp === 'Ozon' ? result.ozonCardCosts : 0,
        profit: result.profit,
        margin: `${result.margin}%`,
        roi: `${result.roi}%`,
        status:
          result.margin >= 20 ? '🟢 Здоровая' : result.margin >= 10 ? '🟡 Низкая' : '🔴 Убыток',
      };
    })
  );

  // Generate honest data quality message
  let dataQualityNote: string;
  if (costDataCoverage === 100) {
    dataQualityNote = '✅ Все расчёты основаны на реальной себестоимости из вашей базы данных.';
  } else if (costDataCoverage > 0) {
    dataQualityNote = `⚠️ Только ${costDataCoverage}% товаров имеют реальную себестоимость. Остальные — оценка. Добавьте себестоимость в настройках товаров для точного расчёта.`;
  } else if (args.cost_price) {
    dataQualityNote = `ℹ️ Использована указанная вами себестоимость (${args.cost_price}₽) для всех товаров.`;
  } else {
    dataQualityNote =
      '⚠️ ВНИМАНИЕ: Себестоимость оценена как 30% от цены. Это ОЧЕНЬ приблизительно! Для точного расчёта укажите реальную себестоимость.';
  }

  return {
    success: true,
    data: {
      dataQuality: {
        note: dataQualityNote,
        productsWithRealCost: productsWithCost.length,
        totalProducts: targetProducts.length,
        coverage: `${costDataCoverage}%`,
      },
      commissionRates: {
        note: 'Комиссии и логистика в реальном времени (2025).',
        WB: 'Комиссия 8-34.5%, логистика 35-50₽, хранение 0.08₽/л/день',
        Ozon: 'Комиссия 4-24%, логистика FBO/FBS 46/80₽, эквайринг 1.5%, Ozon Card 5%',
      },
      products: calculations,
    },
  };
}

/**
 * GET_ABC_ANALYSIS — ABC analysis of products
 * CRITICAL REWRITE (Dec 2024):
 * - Uses syncSalesHistory to fetch real orders from APIs
 * - Stores data in DB for persistence and speed
 * - Calculates true ABC based on REVENUE from orders
 */
export async function executeGetAbcAnalysis(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(GetAbcAnalysisArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  // 1. Calculate date range
  const now = new Date();
  let daysBack = 30; // default to month
  if (args.period === 'week') daysBack = 7;
  else if (args.period === '3months') daysBack = 90;

  const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // 2. Trigger Sync (if keys exist)
  // We do this BEFORE fetching products ensuring data is fresh
  console.log(
    `📊 ABC Analysis: Triggering sales sync for user ${userId} (${daysBack} days, account=${args.account_id})`
  );
  await syncSalesHistory(userId, daysBack, args.account_id);

  // 3. Fetch Data from DB
  const [products, orders] = await Promise.all([
    getProductsByUserId(userId, args.account_id),
    getSalesHistory(userId, dateFrom, now, args.account_id),
  ]);

  if (products.length === 0) {
    return { success: false, error: 'Нет товаров для анализа' };
  }

  // 4. Aggregate Revenue per Product
  // Map: product_id (DB ID) -> { revenue, quantity }
  const revenueMap = new Map<string, { revenue: number; quantity: number }>();

  // Track which orders were matched to known products
  let matchedOrders = 0;

  for (const order of orders) {
    let matchedProduct = null;

    if (order.marketplace === 'WB') {
      // Find WB product by nm_id
      matchedProduct = products.find(
        (p: Product) => String(p.nm_id) === order.marketplace_product_id
      );
    } else {
      // Find Ozon product by offer_id or product_id regex
      matchedProduct = products.find(
        (p: Product) =>
          p.offer_id === order.marketplace_product_id ||
          p.product_id === `ozon-${order.marketplace_product_id}`
      );
    }

    if (matchedProduct) {
      matchedOrders++;
      const current = revenueMap.get(matchedProduct.product_id) || { revenue: 0, quantity: 0 };
      current.revenue += Number(order.price_total);
      current.quantity += Number(order.quantity);
      revenueMap.set(matchedProduct.product_id, current);
    }
  }

  console.log(`📊 ABC Analysis: Matched ${matchedOrders}/${orders.length} orders to products`);

  // 5. Build Analysis List
  // Combine real sales data with product list
  const analyzedProducts = products.map((p: Product) => {
    const sales = revenueMap.get(p.product_id);
    return {
      product_id: p.product_id,
      title: p.title,
      marketplace: p.marketplace,
      current_price: p.current_price,
      // Use real revenue if available, else 0
      revenue: sales ? sales.revenue : 0,
      quantity: sales ? sales.quantity : 0,
      hasRealData: !!sales,
    };
  });

  // 6. perform ABC Classification
  // Sort by revenue descending
  const sorted = [...analyzedProducts].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

  let cumulative = 0;
  const classified = sorted.map(p => {
    cumulative += p.revenue;
    const percentage = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;

    let category: 'A' | 'B' | 'C';
    if (percentage <= 80) category = 'A';
    else if (percentage <= 95) category = 'B';
    else category = 'C';

    // Special case: if total revenue is 0 (no sales data), everything is C (or maybe unknown?)
    // User requested "Honest", so if 0 revenue, it's C or "No Data"
    if (totalRevenue === 0) category = 'C';

    return {
      ...p,
      product: p.title.substring(0, 40),
      category,
      revenueShare: totalRevenue > 0 ? `${Math.round((p.revenue / totalRevenue) * 100)}%` : '0%',
    };
  });

  // 7. Group & Format Output
  const aProducts = classified.filter(p => p.category === 'A');
  const bProducts = classified.filter(p => p.category === 'B');
  const cProducts = classified.filter(p => p.category === 'C');

  // Honest Data Quality Status
  const productsWithSales = classified.filter(p => p.hasRealData).length;
  const coveragePercent = Math.round((productsWithSales / products.length) * 100);

  let dataQualityMessage = '';
  if (orders.length === 0) {
    dataQualityMessage =
      '🔴 НЕТ ДАННЫХ О ПРОДАЖАХ. Проверьте API ключи. Показаны все товары как категория C.';
  } else if (coveragePercent < 50) {
    dataQualityMessage = `⚠️ ЧАСТИЧНЫЕ ДАННЫЕ. Продажи найдены только для ${coveragePercent}% товаров.`;
  } else {
    dataQualityMessage = `✅ КАЧЕСТВЕННЫЙ АНАЛИЗ. Данные о продажах за ${daysBack} дн.`;
  }

  return {
    success: true,
    data: {
      period: args.period || 'month',
      dataQuality: {
        status: orders.length > 0 ? 'good' : 'poor',
        message: dataQualityMessage,
        ordersAnalyzed: orders.length,
        totalRevenue: Math.round(totalRevenue),
      },
      summary: {
        A: {
          count: aProducts.length,
          revenue: Math.round(aProducts.reduce((s, p) => s + p.revenue, 0)),
          share:
            totalRevenue > 0
              ? `${Math.round((aProducts.reduce((s, p) => s + p.revenue, 0) / totalRevenue) * 100)}%`
              : '0%',
          description: 'Лидеры продаж (80% выручки)',
        },
        B: {
          count: bProducts.length,
          revenue: Math.round(bProducts.reduce((s, p) => s + p.revenue, 0)),
          share:
            totalRevenue > 0
              ? `${Math.round((bProducts.reduce((s, p) => s + p.revenue, 0) / totalRevenue) * 100)}%`
              : '0%',
          description: 'Середнячки (15% выручки)',
        },
        C: {
          count: cProducts.length,
          revenue: Math.round(cProducts.reduce((s, p) => s + p.revenue, 0)),
          share:
            totalRevenue > 0
              ? `${Math.round((cProducts.reduce((s, p) => s + p.revenue, 0) / totalRevenue) * 100)}%`
              : '0%',
          description: 'Аутсайдеры (5% выручки) или новинки без продаж',
        },
      },
      topA: aProducts.slice(0, 5).map(p => ({
        title: p.product,
        revenue: Math.round(p.revenue),
        quantity: p.quantity,
        marketplace: p.marketplace,
        action: 'Контролируйте остатки! Это ваши кормильцы.',
      })),
      bottomC: cProducts.slice(0, 5).map(p => ({
        title: p.product,
        revenue: Math.round(p.revenue),
        quantity: p.quantity,
        marketplace: p.marketplace,
        action: 'Проверьте цену или рекламу. Нет продаж.',
      })),
    },
  };
}

/**
 * GET_STOCK_FORECAST — Forecast when products will run out
 * CRITICAL REWRITE (Dec 2024):
 * - Uses syncSalesHistory to fetch real orders for velocity calculation
 * - Calculates Days-On-Hand (DOH) based on trailing 30-day velocity
 */
export async function executeGetStockForecast(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(GetStockForecastArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  // 1. Sync recent sales to get accurate velocity
  console.log(
    `📊 Stock Forecast: Triggering sales sync for user ${userId} (account=${args.account_id})`
  );
  await syncSalesHistory(userId, 30, args.account_id); // 30 days history is enough for velocity

  const now = new Date();
  const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 2. Fetch Data from DB
  const [products, orders] = await Promise.all([
    getProductsByUserId(userId, args.account_id),
    getSalesHistory(userId, dateFrom, now, args.account_id),
  ]);

  let filtered = products;
  if (args.product_id) {
    filtered = filterProducts(products, undefined, args.product_id);
  }

  if (filtered.length === 0) {
    return { success: false, error: 'Товары не найдены' };
  }

  // 3. Calculate Velocity (Sales/Day) per Product
  const salesMap = new Map<string, number>(); // product_id -> quantity sold in 30 days

  for (const order of orders) {
    // Determine mapping logic (same as ABC analysis)
    let matchedId = null;
    if (order.marketplace === 'WB') {
      const p = products.find((p: Product) => String(p.nm_id) === order.marketplace_product_id);
      if (p) matchedId = p.product_id;
    } else {
      const p = products.find(
        (p: Product) =>
          p.offer_id === order.marketplace_product_id ||
          p.product_id === `ozon-${order.marketplace_product_id}`
      );
      if (p) matchedId = p.product_id;
    }

    if (matchedId) {
      const current = salesMap.get(matchedId) || 0;
      salesMap.set(matchedId, current + Number(order.quantity));
    }
  }

  // 4. Generate Forecasts
  const forecasts = filtered.map((p: Product) => {
    const sold30Days = salesMap.get(p.product_id) || 0;

    // Velocity per day (based on 30 days)
    const velocity = sold30Days / 30; // units/day

    let daysLeft = 999;
    let status: 'ok' | 'warning' | 'critical' | 'out_of_stock' = 'ok';
    let predictedDate = null;
    let message = '';
    const currentStock = p.current_stock || 0;

    if (currentStock <= 0) {
      status = 'out_of_stock';
      daysLeft = 0;
      message = 'УЖЕ ЗАКОНЧИЛСЯ';
    } else if (velocity <= 0) {
      // No sales data - can't predict
      status = 'ok';
      message = 'Нет продаж за 30 дней (застой)';
    } else {
      daysLeft = Math.round(currentStock / velocity);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysLeft);
      predictedDate = targetDate.toISOString().split('T')[0];

      if (daysLeft < 7) {
        status = 'critical';
        message = `Хватит на ${daysLeft} дн. (до ${predictedDate})`;
      } else if (daysLeft < 14) {
        status = 'warning';
        message = `Хватит на ${daysLeft} дн. (до ${predictedDate})`;
      } else {
        status = 'ok';
        message = `Запас > 2 недель (${daysLeft} дн.)`;
      }
    }

    return {
      product_id: p.product_id,
      title: p.title.substring(0, 50),
      marketplace: p.marketplace,
      current_stock: p.current_stock,
      sold_30_days: sold30Days,
      velocity: Number(velocity.toFixed(2)),
      days_left: daysLeft,
      status,
      message,
      recommendation:
        status === 'critical'
          ? 'СРОЧНО ПОПОЛНИТЬ! Вымоется меньше чем через неделю.'
          : status === 'warning'
            ? 'Пора планировать поставку.'
            : status === 'out_of_stock'
              ? 'ТОВАР ОТСУТСТВУЕТ!'
              : 'Запас достаточный.',
    };
  });

  // Check if we actually have data
  const hasData = salesMap.size > 0;

  // Sort by urgency (days left ascending)
  const sorted = [...forecasts].sort((a, b) => a.days_left - b.days_left);

  return {
    success: true,
    data: {
      dataQuality: hasData ? 'reliable' : 'no_sales_data',
      summary: hasData
        ? `Прогноз построен на основе ${orders.length} продаж за 30 дней.`
        : '⚠️ НЕТ ДАННЫХ О ПРОДАЖАХ. Прогноз невозможен.',
      // Use sorted for outputs
      criticalItems: sorted
        .filter(f => f.status === 'critical' || f.status === 'out_of_stock')
        .slice(0, 10),
      warningItems: sorted.filter(f => f.status === 'warning').slice(0, 5),
      totalAnalyzed: forecasts.length,
      outOfStockCount: forecasts.filter((f: Forecast) => f.status === 'out_of_stock').length,
    },
  };
}

import { MARKETPLACE_KNOWLEDGE } from '../data/marketplace-knowledge.js';

/**
 * GET_MARKETPLACE_INFO — Reference information about marketplaces
 */
export function executeGetMarketplaceInfo(rawArgs: unknown): ToolResult {
  const validation = validateToolArgs(GetMarketplaceInfoArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  const info = MARKETPLACE_KNOWLEDGE as Record<string, Record<string, string>>;
  const mpKey = args.marketplace || 'both';
  const topicInfo = info[args.topic];

  if (!topicInfo) {
    return {
      success: false,
      error: `Тема "${args.topic}" не найдена. Доступные: ${Object.keys(info).join(', ')}`,
    };
  }

  // Support 'both' by merging or picking the right keys
  let content = '';
  if (mpKey === 'both') {
    if (topicInfo.both) {
      content = topicInfo.both;
    } else {
      content =
        (topicInfo.WB ? `[WB]\n${topicInfo.WB}` : '') +
        (topicInfo.Ozon ? `\n\n[Ozon]\n${topicInfo.Ozon}` : '');
    }
  } else {
    content =
      topicInfo[mpKey] ||
      topicInfo.both ||
      `Информация для ${mpKey} по теме ${args.topic} отсутствует.`;
  }

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

  // Retrieve Serper.dev API key via common helper (handles caching and ENV fallback)
  const apiKey = await getSecret('serper_api_key', 'web_search');

  if (!apiKey) {
    console.warn('⚠️ Web Search: SERPER_API_KEY not found');
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

    // HELPER: Extract Marketplace IDs from search results automatically
    // This helps the AI agent to easily pick up competitor products without hallucinating IDs
    const extracted_products: Array<{
      source: 'WB' | 'Ozon';
      id: string;
      link: string;
      title: string;
    }> = [];

    for (const res of results) {
      if (!res.link) continue;

      // Try WB
      const wbMatch = res.link.match(/wildberries\.ru\/catalog\/(\d+)/i);
      if (wbMatch && wbMatch[1]) {
        extracted_products.push({
          source: 'WB',
          id: wbMatch[1],
          link: res.link,
          title: res.title || 'WB Product',
        });
        continue;
      }

      // Try Ozon (format: /product/name-id/ or /product/id/)
      // Ozon IDs are typically at the end of path, before slash or query
      const ozonMatch =
        res.link.match(/ozon\.ru\/product\/.*?[-/](\d{8,12})/i) ||
        res.link.match(/ozon\.ru\/product\/(\d{8,12})/i);
      if (ozonMatch && ozonMatch[1]) {
        extracted_products.push({
          source: 'Ozon',
          id: ozonMatch[1],
          link: res.link,
          title: res.title || 'Ozon Product',
        });
      }
    }

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
        extracted_products, // <--- NEW: Ready-to-use product IDs for get_competitor_price
        relatedQuestions, // Common follow-up questions
      },
    };
  } catch (error) {
    console.error('Web search error:', error);
    return { success: false, error: 'Ошибка поиска: ' + String(error) };
  }
}

/**
 * GET_MARKETPLACE_ACCOUNTS — List user's connected accounts
 */
export async function executeGetMarketplaceAccounts(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(GetMarketplaceAccountsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const { getMarketplaceAccounts } = await import('../services/users.js');
    const accounts = await getMarketplaceAccounts(userId);

    let filtered = accounts;
    if (args.marketplace !== 'all') {
      filtered = accounts.filter(
        a => a.marketplace.toLowerCase() === args.marketplace.toLowerCase()
      );
    }

    return {
      success: true,
      data: {
        total: accounts.length,
        accounts: filtered.map(a => ({
          id: a.id,
          name: a.name,
          marketplace: a.marketplace,
          is_active: a.is_active,
          last_sync: a.last_sync_at,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * UPDATE_PRICES — Prepare price updates for confirmation
 */
export async function executeUpdatePrices(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(UpdatePricesArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const argsWithAccount = args as {
      account_id?: number;
      marketplace?: string;
      products?: Array<{ product_id: string; new_price: number }>;
      change_value?: number;
    };
    const products = await getProductsByUserId(userId, argsWithAccount.account_id);
    const updates: Array<{
      product_id: string;
      nm_id?: number;
      title: string;
      marketplace: 'WB' | 'Ozon';
      currentPrice: number;
      newPrice: number;
      minPrice: number;
      belowMinPrice: boolean;
    }> = [];

    // Case 1: Specific products from array
    if (args.products && args.products.length > 0) {
      for (const item of args.products) {
        const filtered = filterProducts(products, args.marketplace, item.product_id);
        if (filtered.length > 0) {
          const p = filtered[0];
          updates.push({
            product_id: p.product_id,
            nm_id: p.nm_id || undefined,
            title: p.title,
            marketplace: p.marketplace as 'WB' | 'Ozon',
            currentPrice: p.current_price,
            newPrice: item.new_price,
            minPrice: p.min_price,
            belowMinPrice: p.min_price > 0 && item.new_price < p.min_price,
          });
        }
      }
    }
    // Case 2: Percentage change for all/marketplace
    else if (args.change_value !== undefined) {
      const targetMarketplace = args.marketplace === 'all' ? undefined : args.marketplace;
      const filtered = filterProducts(products, targetMarketplace);

      for (const p of filtered) {
        const diff = Math.round(p.current_price * (args.change_value / 100));
        const newPrice = p.current_price + diff;
        updates.push({
          product_id: p.product_id,
          nm_id: p.nm_id || undefined,
          title: p.title,
          marketplace: p.marketplace as 'WB' | 'Ozon',
          currentPrice: p.current_price,
          newPrice,
          minPrice: p.min_price,
          belowMinPrice: p.min_price > 0 && newPrice < p.min_price,
        });
      }
    }

    if (updates.length === 0) {
      return { success: false, error: 'Товары для обновления не найдены' };
    }

    return {
      success: true,
      data: {
        price_updates: updates,
        marketplace: args.marketplace,
        account_id: argsWithAccount.account_id,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * UPDATE_STOCKS — Prepare stock updates for confirmation (FBS ONLY)
 */
export async function executeUpdateStocks(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(UpdateStocksArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const argsWithAccount = args as {
      account_id?: number;
      marketplace?: string;
      products: Array<{ product_id: string; new_stock: number }>;
    };
    const products = await getProductsByUserId(userId, argsWithAccount.account_id);
    const stockUpdates: Array<{
      product_id: string;
      sku?: string;
      offer_id?: string;
      title: string;
      marketplace: 'WB' | 'Ozon';
      currentStock: number;
      newStock: number;
    }> = [];

    for (const item of args.products) {
      const filtered = filterProducts(products, args.marketplace, item.product_id);
      if (filtered.length > 0) {
        const p = filtered[0];
        stockUpdates.push({
          product_id: p.product_id,
          sku: String(p.nm_id || p.product_id), // WB uses nm_id as sku
          offer_id: p.offer_id || p.product_id, // Ozon uses offer_id
          title: p.title,
          marketplace: p.marketplace as 'WB' | 'Ozon',
          currentStock: p.current_stock || 0,
          newStock: item.new_stock,
        });
      }
    }

    if (stockUpdates.length === 0) {
      return { success: false, error: 'Товары для обновления остатков не найдены' };
    }

    return {
      success: true,
      data: {
        stock_updates: stockUpdates,
        marketplace: args.marketplace,
        account_id: argsWithAccount.account_id,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * UPDATE_PRODUCT_SETTINGS — Update cost_price, category, or min_price
 * CRITICAL: This allows the agent to fix missing cost data that Sentinel relies on.
 */
export async function executeUpdateProductSettings(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(UpdateProductSettingsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const products = await getProductsByUserId(userId);
    const filtered = filterProducts(products, undefined, args.product_id);

    if (filtered.length === 0) {
      return { success: false, error: `Товар "${args.product_id}" не найден` };
    }

    const p = filtered[0];
    const changes: string[] = [];

    if (args.cost_price !== undefined) {
      await updateProductCostPrice(userId, p.product_id, args.cost_price);
      changes.push(`себестоимость: ${args.cost_price}₽`);
    }

    if (args.category !== undefined) {
      await updateProductCategory(userId, p.product_id, args.category);
      changes.push(`категория: ${args.category}`);
    }

    if (args.min_price !== undefined || args.is_monitored !== undefined) {
      const newMonitored =
        args.is_monitored !== undefined ? args.is_monitored : (p.is_monitored ?? true);
      const newMin = args.min_price !== undefined ? args.min_price : p.min_price;
      await updateProductMonitoring(userId, p.product_id, newMonitored, newMin);
      if (args.min_price !== undefined) changes.push(`мин. цена: ${args.min_price}₽`);
      if (args.is_monitored !== undefined)
        changes.push(`мониторинг: ${newMonitored ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    if (changes.length === 0) {
      return { success: false, error: 'Нет данных для обновления' };
    }

    return {
      success: true,
      data: {
        message: `Обновлены настройки для "${p.title}": ${changes.join(', ')}`,
        product_id: p.product_id,
        changes,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * SET_STOP_LOSS — Calculate and prepare stop-loss for confirmation
 */
export async function executeSetStopLoss(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(SetStopLossArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const products = await getProductsByUserId(userId);
    const filtered = filterProducts(products, undefined, args.product_id);

    if (filtered.length === 0) {
      return { success: false, error: `Товар "${args.product_id}" не найден` };
    }

    const p = filtered[0];
    let minPrice: number;

    if (args.min_price) {
      minPrice = args.min_price;
    } else if (args.percentage) {
      minPrice = Math.round(p.current_price * (1 - args.percentage / 100));
    } else {
      // Default: 10% below current
      minPrice = Math.round(p.current_price * 0.9);
    }

    return {
      success: true,
      data: {
        product_id: p.product_id,
        product_title: p.title,
        marketplace: p.marketplace,
        current_price: p.current_price,
        min_price: minPrice,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * BULK_PROTECT_PRODUCTS — Prepare bulk protection for confirmation
 */
export async function executeBulkProtectProducts(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(BulkProtectProductsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const products = await getProductsByUserId(userId);
    let targetProducts = products;

    if (args.only_unprotected) {
      targetProducts = products.filter((p: Product) => !p.min_price || p.min_price === 0);
    }

    if (targetProducts.length === 0) {
      return {
        success: false,
        error: 'Нет товаров для защиты (возможно, все уже защищены)',
      };
    }

    const updates = targetProducts.map((p: Product) => ({
      product_id: p.product_id,
      title: p.title,
      current_price: p.current_price,
      min_price: Math.round(p.current_price * (1 - args.percentage / 100)),
    }));

    return {
      success: true,
      data: {
        percentage: args.percentage,
        count: updates.length,
        product_ids: updates.map((u: { product_id: string }) => u.product_id),
        preview: updates.slice(0, 5),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * GET_SYSTEM_LOGS — Admin only: Retrieve system events
 */
export async function executeGetSystemLogs(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const validation = validateToolArgs(GetSystemLogsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  // Authorization check
  const { getUserById } = await import('../services/index.js');
  const user = await getUserById(userId);
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  const isAdmin =
    (user && 'role' in user && user.role === 'admin') ||
    (adminId && String(userId) === String(adminId));

  if (!isAdmin) {
    return { success: false, error: '⛔ Access Denied: Admin rights required for system logs.' };
  }

  try {
    const logs = await getSystemEvents(args.limit, {
      userId: userId !== 0 ? userId : undefined, // If userId passed? No, executeGetSystemLogs has userId argument. But logic says admin checks.
      // We pass no filters for now as old filters don't map directly
    });

    return {
      success: true,
      data: {
        count: logs.length,
        logs: logs.map(l => ({
          timestamp: l.created_at,
          type: l.event_type,
          severity: (l.payload && typeof l.payload === 'object' && 'urgency' in l.payload
            ? l.payload.urgency
            : 'info') as string,
          entity: l.product_id
            ? `product:${l.product_id}`
            : l.user_id
              ? `user:${l.user_id}`
              : l.event_source,
          payload: l.payload,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * GET_COMPETITOR_PRICE — Get real-time price of a competitor product
 * UPDATED 2026-01: WB public API (card.wb.ru) is now blocked
 * Falls back to web search via Serper API
 */
export async function executeGetCompetitorPrice(
  _userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const { GetCompetitorPriceArgsSchema } = await import('./validators.js');
  const validation = validateToolArgs(GetCompetitorPriceArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  const { fetchWbCompetitorData, fetchOzonCompetitorData, extractNmIdFromUrl } =
    await import('../services/competitor-monitor.js');

  // Extract nm_id from URL or use as-is
  const nmId = extractNmIdFromUrl(args.nm_id);

  if (!nmId) {
    return {
      success: false,
      error: `Не удалось определить артикул. Передайте ссылку (https://www.wildberries.ru/catalog/123456789/detail.aspx) или артикул (123456789).`,
    };
  }

  console.log(`🔍 get_competitor_price: nm_id=${nmId}, marketplace=${args.marketplace}`);

  // ===== OZON =====
  if (args.marketplace === 'Ozon') {
    const data = await fetchOzonCompetitorData(String(nmId));
    if (data) {
      return {
        success: true,
        data: {
          marketplace: 'Ozon',
          product_id: nmId,
          price: data.price,
          available: data.available,
          stock: data.stock,
        },
      };
    }
    // Fallback: Web Search for Ozon
    console.log('📡 Ozon API unavailable, using web search fallback...');
    const { getSecret } = await import('../lib/secrets-helper.js');
    const serperKey = await getSecret('serper_api_key', 'web_search');

    if (serperKey) {
      try {
        const searchQuery = `ozon ${nmId} цена`;
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: searchQuery, gl: 'ru', hl: 'ru', num: 3 }),
        });

        if (response.ok) {
          interface SerperResult {
            title?: string;
            link?: string;
            snippet?: string;
          }
          const searchData = (await response.json()) as { organic?: SerperResult[] };
          const ozonResult = searchData.organic?.find((r: SerperResult) =>
            r.link?.includes('ozon.ru')
          );

          let extractedPrice: number | null = null;
          if (ozonResult?.snippet || ozonResult?.title) {
            const textToCheck = (ozonResult.title + ' ' + ozonResult.snippet).toLowerCase();
            // Regex for price: 1 234 ₽, 1.234 руб
            const currencyMatch = textToCheck.match(/(\d[\d\s.,]*)\s*(?:₽|руб|rur)/i);
            const priceLabelMatch = textToCheck.match(/цена\s*:?\s*(\d[\d\s.,]*)/i);
            const match = currencyMatch || priceLabelMatch;

            if (match && match[1]) {
              const raw = match[1].replace(/[\s,.]/g, '');
              extractedPrice = Math.round(parseFloat(raw));
            }
          }

          if (extractedPrice || ozonResult) {
            return {
              success: true,
              data: {
                marketplace: 'Ozon',
                product_id: nmId,
                source: 'web_search',
                price: extractedPrice,
                priceNote: extractedPrice
                  ? `Цена найдена в Google: ~${extractedPrice}₽`
                  : 'Цена не найдена в сниппете (проверьте вручную)',
                productUrl: `https://www.ozon.ru/product/${nmId}`,
                searchResults: searchData.organic?.slice(0, 2).map((r: SerperResult) => ({
                  title: r.title,
                  link: r.link,
                  snippet: r.snippet?.substring(0, 150),
                })),
              },
            };
          }
        }
      } catch (e) {
        console.error('Ozon search fallback failed:', e);
      }
    }

    return {
      success: true,
      data: {
        marketplace: 'Ozon',
        product_id: nmId,
        error: 'Прямой доступ к ценам Ozon недоступен',
        suggestion: 'Используйте search_web для поиска: "site:ozon.ru [артикул или название]"',
        productUrl: `https://www.ozon.ru/product/${nmId}`,
      },
    };
  }

  // ===== WILDBERRIES =====
  try {
    // Try direct API first (may be blocked)
    const data = await fetchWbCompetitorData(nmId);

    if (data) {
      const discount =
        data.basicPrice > data.price
          ? Math.round(((data.basicPrice - data.price) / data.basicPrice) * 100)
          : 0;

      return {
        success: true,
        data: {
          marketplace: 'WB',
          nm_id: data.nmId,
          price: data.price,
          basicPrice: data.basicPrice,
          discount: discount > 0 ? `${discount}%` : null,
          available: data.available,
          stock: data.stock,
          stockStatus:
            data.stock > 50
              ? '🟢 Много'
              : data.stock > 10
                ? '🟡 Средне'
                : data.stock > 0
                  ? '🔴 Мало'
                  : '⚫ Нет',
          url: `https://www.wildberries.ru/catalog/${data.nmId}/detail.aspx`,
        },
      };
    }
  } catch (error) {
    console.warn('WB API failed, falling back to search:', error);
  }

  // ===== FALLBACK: Web Search =====
  console.log('📡 WB API unavailable, using web search fallback...');

  const { getSecret } = await import('../lib/secrets-helper.js');
  const serperKey = await getSecret('serper_api_key', 'web_search');

  if (!serperKey) {
    return {
      success: true,
      data: {
        marketplace: 'WB',
        nm_id: nmId,
        error: 'Прямой API недоступен, интернет-поиск не настроен',
        productUrl: `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`,
        suggestion: 'Откройте ссылку вручную для просмотра цены',
      },
    };
  }

  try {
    const searchQuery = `site:wildberries.ru/catalog ${nmId} цена`;
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: 'ru',
        hl: 'ru',
        num: 3,
      }),
    });

    if (response.ok) {
      interface SerperResult {
        title?: string;
        link?: string;
        snippet?: string;
      }
      const searchData = (await response.json()) as { organic?: SerperResult[] };

      // Try to extract price from search results
      const wbResult = searchData.organic?.find((r: SerperResult) =>
        r.link?.includes('wildberries.ru')
      );

      // Extract price from snippet with improved regex
      // Matches: "1 234 ₽", "1.234 руб", "1234р", "цена 1234"
      let extractedPrice: number | null = null;
      if (wbResult?.snippet || wbResult?.title) {
        const textToCheck = (wbResult.title + ' ' + wbResult.snippet).toLowerCase();

        // Pattern 1: Price with currency (most reliable)
        const currencyMatch = textToCheck.match(/(\d[\d\s.,]*)\s*(?:₽|руб|rur)/i);

        // Pattern 2: "Price: 1234"
        const priceLabelMatch = textToCheck.match(/цена\s*:?\s*(\d[\d\s.,]*)/i);

        const match = currencyMatch || priceLabelMatch;

        if (match && match[1]) {
          // Cleanup: remove dots, commas, spaces to get pure number
          // Handle "1.200" or "1 200" or "1,200" as 1200
          // RISK: "10.50" becomes 1050. But marketplaces mostly use integer RUB.
          const raw = match[1].replace(/[\s,.]/g, '');
          extractedPrice = Math.round(parseFloat(raw));
        }
      }

      return {
        success: true,
        data: {
          marketplace: 'WB',
          nm_id: nmId,
          source: 'web_search',
          price: extractedPrice,
          priceNote: extractedPrice
            ? `Цена найдена в Google: ~${extractedPrice}₽`
            : 'Цена не найдена в сниппете (проверьте вручную)',
          productUrl: `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`,
          searchResults: searchData.organic?.slice(0, 2).map((r: SerperResult) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet?.substring(0, 150),
          })),
        },
      };
    }
  } catch (searchError) {
    console.error('Search fallback also failed:', searchError);
  }

  // Last resort: just return the product URL
  return {
    success: true,
    data: {
      marketplace: 'WB',
      nm_id: nmId,
      error: 'Не удалось получить цену автоматически',
      productUrl: `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`,
      suggestion: 'Откройте ссылку для просмотра актуальной цены',
    },
  };
}

/**
 * GET_REVIEWS — List product reviews from WB/Ozon
 */
export async function executeGetReviews(userId: number, rawArgs: unknown): Promise<ToolResult> {
  const { GetReviewsArgsSchema } = await import('./validators.js');
  const validation = validateToolArgs(GetReviewsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    const reviews = await getUserReviews(userId, args);

    if (reviews.length === 0) {
      return {
        success: true,
        data: { message: 'Отзывов не найдено за последнее время.', reviews: [] },
      };
    }

    return {
      success: true,
      data: {
        total: reviews.length,
        reviews: reviews.slice(0, args.limit).map(r => ({
          marketplace: r.marketplace,
          rating: r.rating,
          text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
          author: r.author_name,
          date: new Date(r.created_at).toLocaleDateString(),
          status: r.status,
          product: r.product_title || r.product_id,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * GET_LOW_MARGIN_PRODUCTS — Identify products with profitability issues
 */
export async function executeGetLowMarginProducts(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  const validation = validateToolArgs(GetLowMarginProductsArgsSchema, rawArgs);
  if (isValidationError(validation)) return { success: false, error: validation.error };
  const args = validation.data;

  try {
    // 1. Get products
    const products = await getProductsByUserId(userId, args.account_id);
    const marketplace = args.marketplace === 'all' ? undefined : args.marketplace;
    const filtered = filterProducts(products, marketplace);

    if (filtered.length === 0) {
      return { success: true, data: { products: [], message: 'Товары не найдены' } };
    }

    // 2. Calculate economics for each and filter
    const { calculateUnitEconomics, estimateCostPrice } =
      await import('../services/unit-economics.js');
    const lowMarginProducts = [];

    for (const p of filtered) {
      let costPrice = p.cost_price || 0;
      let isEstimated = false;

      if (costPrice <= 0) {
        const estimate = estimateCostPrice(p.current_price, p.category || undefined);
        costPrice = estimate.costPrice;
        isEstimated = true;
      }

      const econ = calculateUnitEconomics({
        price: p.current_price,
        costPrice,
        category: p.category || undefined,
        marketplace: p.marketplace as 'WB' | 'Ozon',
        useOzonCard: true,
      });

      if (econ.margin < args.threshold) {
        lowMarginProducts.push({
          id: p.product_id,
          title: p.title,
          marketplace: p.marketplace,
          price: p.current_price,
          cost_price: costPrice,
          margin: econ.margin,
          profit: econ.profit,
          is_estimated: isEstimated,
          status:
            econ.margin < 0
              ? '🔴 Убыток'
              : isEstimated
                ? '🟡 Проверьте себестоимость'
                : '🟡 Низкая маржа',
        });
      }
    }

    // Sort by margin (worst first)
    lowMarginProducts.sort((a, b) => a.margin - b.margin);

    return {
      success: true,
      data: {
        count: lowMarginProducts.length,
        threshold: args.threshold,
        products: lowMarginProducts.slice(0, 50),
        note: `Анализ ${filtered.length} товаров. Найдено ${lowMarginProducts.length} проблемных позиций. Часть себестоимостей оценена автоматически по категории.`,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
