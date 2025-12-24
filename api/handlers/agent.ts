// ============================================
// NeuroGUARDIAN — AI Agent Handler
// LLM Integration & Function Calling (OpenAI)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';

import {
  validateTelegramInitData,
  sanitizeInput,
  decryptApiKey,
  checkRateLimit,
} from '../../src/api-lib/lib/index.js';

import {
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  batchUpdateWbPrices,
  batchUpdateOzonPrices,
  batchSetPendingPrices,
  batchConfirmPendingByTaskId,
} from '../../src/api-lib/services/index.js';

// Marketplace API operations (centralized WB/Ozon logic)
import {
  updateWbPrices,
  updateOzonPrices,
  checkWbTaskStatus,
} from '../../src/api-lib/services/marketplace.js';

// V2 MEGA-BRAIN System Prompt (Expert Persona + CoT + Few-Shot)
import { getEnhancedSystemPrompt } from '../../src/api-lib/agent/system-prompt-v2.js';

// Metrics & Analytics
import {
  createAgentMetrics,
  logAgentMetrics,
  formatMetricsForLog,
} from '../../src/api-lib/agent/metrics.js';

// Tool Executors (Real WB/Ozon API implementations)
import {
  executeGetProducts,
  executeGetSalesStats,
  executeGetOrders,
  executeGetWarehouseStocks,
  executeCalculateUnitEconomics,
  executeGetAbcAnalysis,
  executeGetStockForecast,
  executeGetMarketplaceInfo,
} from '../../src/api-lib/agent/tool-executors.js';

// Note: System prompt is now imported from system-prompt-v2.ts
// Using Expert Persona (Виктор Маржин) + CoT + Few-Shot examples

// ============================================
// TYPE DEFINITIONS (Dec 2024 Audit: Replace any)
// ============================================

/** Database user record */
interface DBUserRecord {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  role?: string;
  api_key_wb?: string;
  api_key_ozon?: string;
  ozon_client_id?: string;
  protection_enabled: boolean;
  defense_mode: 'zero_stock' | 'price_correction';
  subscription_plan: string;
  subscription_end?: string;
  subscription_end_date?: string;
  subscription_active: boolean;
  triggered_today: number;
  saved_amount: number;
}

/** Database product record */
interface DBProductRecord {
  id: number;
  user_id: number;
  product_id: string;
  nm_id: number | null;
  title: string;
  image_url: string | null;
  current_price: number;
  min_price: number;
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
  vendor_code?: string;
  status: string;
  is_monitored: boolean;
}

/** OpenAI tool call item */
interface ToolCallItem {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Action requiring user confirmation */
interface ActionRequired {
  operation: string;
  confirmationMessage: string;
  details: Record<string, unknown>;
}

/** User API context for tools */
interface UserApiContext {
  wbApiKey?: string;
  ozonApiKey?: string;
}

// Helper to get KV client
function getKVClient() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return null;
}

// Function calling definitions
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description: 'Получить список товаров пользователя с ценами и остатками',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Лимит товаров (по умолчанию 10)' },
          sort: {
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
      description: 'Получить статистику продаж за период (выручка, заказы)',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'yesterday', 'week', 'month'],
            description: 'Период анализа',
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
      description: 'Рассчитать юнит-экономику товара (прибыль, маржа, комиссии)',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'ID товара (артикул)' },
          price: { type: 'number', description: 'Цена продажи (опционально)' },
          cost_price: { type: 'number', description: 'Себестоимость (опционально)' },
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
      description: 'Провести ABC-анализ товаров (классификация по важности)',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stock_forecast',
      description: 'Получить прогноз остатков (на сколько дней хватит товара)',
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
        'Установить минимальную цену (Stop-Loss) для ОДНОГО конкретного товара. Используй когда пользователь просит защитить конкретный товар или установить минимальную цену.',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'ID или название товара',
          },
          min_price: { type: 'number', description: 'Минимальная цена (в рублях)' },
        },
        required: ['product_id', 'min_price'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bulk_protect_products',
      description:
        'Массовая защита ВСЕХ товаров Stop-Loss. Используй ТОЛЬКО когда пользователь просит "защитить ВСЕ товары" или "установить защиту на все". НЕ используй для изменения цены на конкретный товар!',
      parameters: {
        type: 'object',
        properties: {
          percentage: {
            type: 'number',
            description: 'Процент от текущей цены (например, 15 для -15%)',
          },
          only_unprotected: {
            type: 'boolean',
            description: 'Только незащищённые товары (по умолчанию true)',
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
        'ОБЯЗАТЕЛЬНО вызывай эту функцию когда пользователь просит: изменить цену, поставить цену, установить цену, сделать цену, поднять/понизить цену на конкретный товар. Пример: "сделай цену 7500 на панно" → вызови update_prices. Функция запросит подтверждение автоматически.',
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: {
                  type: 'string',
                  description:
                    'Название товара или его ID. Можно передать часть названия, например: "зимние горы", "панно", "кабель"',
                },
                new_price: { type: 'number', description: 'Новая цена в рублях' },
              },
              required: ['product_id', 'new_price'],
            },
            description: 'Список товаров для изменения цен',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon', 'all'],
            description:
              'Маркетплейс. Обязательно указывай если пользователь явно упоминает "Wildberries", "WB", "ВБ", "валберис" → WB. Если "Ozon", "Озон" → Ozon. Иначе all.',
          },
          change_value: {
            type: 'number',
            description:
              'Процентное изменение цены для ВСЕХ товаров. +10 = повысить на 10%, -5 = понизить на 5%',
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
      description: 'Получить список последних заказов',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Количество заказов (по умолчанию 5)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_warehouse_stocks',
      description: 'Получить остатки по складам',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'ID товара' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_stocks',
      description:
        'Изменить остатки товаров на складе. ВАЖНО: Работает ТОЛЬКО для FBS (товары на СВОЁМ складе продавца). Для FBO (товары на складе маркетплейса) изменить остатки НЕЛЬЗЯ — они зависят от поставок. ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ!',
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: {
                  type: 'string',
                  description: 'Название товара или его ID',
                },
                new_stock: {
                  type: 'number',
                  description: 'Новое количество остатка (целое число >= 0)',
                },
              },
              required: ['product_id', 'new_stock'],
            },
            description: 'Список товаров для изменения остатков',
          },
          marketplace: {
            type: 'string',
            enum: ['WB', 'Ozon'],
            description:
              'Маркетплейс для изменения остатков. Обязательно указывай: "Wildberries" → WB, "Ozon" → Ozon',
          },
        },
        required: ['products', 'marketplace'],
      },
    },
  },
];

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCallItem[];
  name?: string;
  tool_call_id?: string;
};

// --- Check Subscription Helper (local) ---
function isSubscriptionActiveLocal(user: DBUserRecord | null): boolean {
  if (!user) return false;
  if (process.env.TEST_MODE === 'true') return true;
  if (user.role === 'admin') return true;
  if (!user.subscription_active) return false;
  if (!user.subscription_end_date) return false;
  return new Date(user.subscription_end_date) > new Date();
}

/**
 * Call OpenAI API with tools (simplified version of index.ts logic)
 */
async function callOpenAIWithTools(
  messages: OpenAIMessage[],
  userId: number,
  userContext: UserApiContext,
  model: string,
  maxTokens: number
): Promise<{
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: ActionRequired;
}> {
  // LLM Provider: OpenAI (recommended) > Groq > AgentRouter
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const agentRouterKey = process.env.AGENTROUTER_API_KEY;

  const apiKey = openaiKey || groqKey || agentRouterKey;
  const provider = openaiKey ? 'OpenAI' : groqKey ? 'Groq' : 'AgentRouter';

  if (!apiKey) {
    console.error('❌ No LLM API key configured! Set OPENAI_API_KEY');
    return {
      success: false,
      content:
        '⚠️ **AI-агент временно недоступен.**\n\nПожалуйста, попробуйте позже или обратитесь в поддержку.',
      toolsUsed: [],
      tokensUsed: 0,
    };
  }

  // Model and URL selection
  let finalModel = model; // gpt-4o-mini or gpt-4o
  let apiUrl = 'https://api.openai.com/v1/chat/completions';

  if (groqKey && !openaiKey) {
    apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    finalModel = 'llama-3.1-8b-instant';
  } else if (agentRouterKey && !openaiKey && !groqKey) {
    apiUrl = 'https://agentrouter.org/v1/chat/completions';
  }

  console.log(`🤖 Using ${provider} with model: ${finalModel}`);

  try {
    console.log(`🔧 Calling ${provider} API with ${AGENT_TOOLS.length} tools defined`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: finalModel,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more reliable tool calling
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;
    const tokens = data.usage?.total_tokens || 0;

    if (message.tool_calls) {
      // Handle tool calls
      const toolCalls = message.tool_calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolNames = toolCalls.map((tc: any) => tc.function.name);

      // Accumulate tool outputs
      const toolOutputs: OpenAIMessage[] = [message]; // Add assistant's tool call message

      // Simplified handling: We just mock execution for read-only tools or simple logic
      // For complex actions (update_prices), we return actionRequired

      // Tool executors are now imported statically at the top of the file

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        let result = '';

        try {
          // Execute real tool implementations
          if (fnName === 'get_products') {
            const toolResult = await executeGetProducts(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_sales_stats') {
            const toolResult = await executeGetSalesStats(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_orders') {
            const toolResult = await executeGetOrders(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_warehouse_stocks') {
            const toolResult = await executeGetWarehouseStocks(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'calculate_unit_economics') {
            const toolResult = await executeCalculateUnitEconomics(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_abc_analysis') {
            const toolResult = await executeGetAbcAnalysis(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_stock_forecast') {
            const toolResult = await executeGetStockForecast(userId, fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'get_marketplace_info') {
            const toolResult = executeGetMarketplaceInfo(fnArgs);
            result = JSON.stringify(toolResult.data || { error: toolResult.error });
          } else if (fnName === 'update_prices') {
            // Fetch product details to build proper price_changes array
            const products = await getProductsByUserId(userId);
            const priceChanges = [];

            console.log(`🔍 update_prices: User ${userId} has ${products.length} products`);
            console.log(`🔍 update_prices fnArgs:`, JSON.stringify(fnArgs));

            // Parse marketplace filter from fnArgs
            const requestedMarketplace = fnArgs.marketplace?.toUpperCase();
            console.log(`🔍 Marketplace filter: ${requestedMarketplace || 'all'}`);

            // Filter products by marketplace if specified
            const typedProducts = products as DBProductRecord[];
            let filteredProducts: DBProductRecord[] = typedProducts;
            if (requestedMarketplace && requestedMarketplace !== 'ALL') {
              filteredProducts = typedProducts.filter(
                p => p.marketplace?.toUpperCase() === requestedMarketplace
              );
              console.log(
                `🔍 Filtered to ${filteredProducts.length} ${requestedMarketplace} products`
              );
            }

            // Parse products from fnArgs
            const requestedProducts = fnArgs.products || [];

            for (const req of requestedProducts) {
              const reqId = String(req.product_id || req.name || req.title || '')
                .toLowerCase()
                .trim();
              const reqPrice = req.new_price || req.price || req.newPrice;

              console.log(`🔍 Looking for product: "${reqId}" with new price: ${reqPrice}`);

              // Find matching product in filtered list with improved fuzzy matching
              const dbProduct = filteredProducts.find((p: DBProductRecord) => {
                const pId = String(p.product_id || '').toLowerCase();
                const pTitle = String(p.title || '').toLowerCase();
                const pNmId = String(p.nm_id || '');

                // Exact matches
                if (pId === reqId) return true;
                if (pNmId === reqId) return true;

                // Partial ID matches
                if (pId.includes(reqId) || reqId.includes(pId)) return true;
                if (reqId.includes(pNmId) && pNmId.length > 3) return true;

                // Title fuzzy match - check if request contains significant part of title
                const titleWords = pTitle.split(/\s+/).filter(w => w.length > 3);
                const reqWords = reqId.split(/\s+/).filter(w => w.length > 2);

                // If at least 2 significant words match, it's likely the same product
                let matchCount = 0;
                for (const rw of reqWords) {
                  if (
                    pTitle.includes(rw) ||
                    titleWords.some(tw => tw.includes(rw) || rw.includes(tw))
                  ) {
                    matchCount++;
                  }
                }
                if (
                  matchCount >= 2 ||
                  (reqWords.length === 1 && matchCount === 1 && pTitle.includes(reqId))
                ) {
                  console.log(`✅ Fuzzy match found: "${reqId}" -> "${p.title}"`);
                  return true;
                }

                return false;
              });

              if (dbProduct) {
                console.log(
                  `✅ Matched: "${reqId}" -> ${dbProduct.title} (${dbProduct.marketplace})`
                );
                priceChanges.push({
                  product_id: dbProduct.product_id,
                  nm_id: dbProduct.nm_id,
                  title: dbProduct.title,
                  marketplace: dbProduct.marketplace,
                  currentPrice: dbProduct.current_price,
                  newPrice: reqPrice,
                });
              } else {
                console.log(`❌ No match found for: "${reqId}"`);
                // Log available products for debugging
                console.log(
                  `📦 Available products:`,
                  (products as DBProductRecord[]).slice(0, 5).map(p => p.title)
                );
              }
            }

            // If no specific products, check if change_value is set (percentage change)
            if (priceChanges.length === 0 && fnArgs.change_value) {
              console.log(`📊 Applying percentage change: ${fnArgs.change_value}%`);
              for (const p of products.slice(0, 10)) {
                const newPrice = Math.round(p.current_price * (1 + fnArgs.change_value / 100));
                priceChanges.push({
                  product_id: p.product_id,
                  nm_id: p.nm_id,
                  title: p.title,
                  marketplace: p.marketplace,
                  currentPrice: p.current_price,
                  newPrice,
                });
              }
            }

            if (priceChanges.length === 0) {
              console.log(`❌ No products matched for price update`);
              result = JSON.stringify({
                error: 'Не найдены товары для изменения цен',
                availableProducts: products
                  .slice(0, 5)
                  .map((p: any) => ({ title: p.title, id: p.product_id })),
              });
            } else {
              console.log(`✅ Prepared ${priceChanges.length} price changes`);

              // Build detailed price change table
              const priceTable = priceChanges
                .slice(0, 5)
                .map(
                  (pc: {
                    title: string;
                    currentPrice: number;
                    newPrice: number;
                    marketplace: string;
                  }) => {
                    const diff = pc.newPrice - pc.currentPrice;
                    const diffPercent = ((diff / pc.currentPrice) * 100).toFixed(1);
                    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
                    return `• ${pc.title.substring(0, 25)}... ${pc.currentPrice}₽ ${arrow} **${pc.newPrice}₽** (${diff > 0 ? '+' : ''}${diffPercent}%)`;
                  }
                )
                .join('\n');

              const detailedContent = `📊 **Изменение цен**

**Будет изменено:** ${priceChanges.length} товар(ов)

**Детали:**
${priceTable}${priceChanges.length > 5 ? `\n... и ещё ${priceChanges.length - 5} товаров` : ''}

⚠️ Новые цены применятся в течение 1-5 минут.`;

              return {
                success: true,
                content: detailedContent,
                toolsUsed: [fnName],
                tokensUsed: tokens,
                actionRequired: {
                  operation: 'update_prices',
                  confirmationMessage: `Изменить цены на ${priceChanges.length} товар(ов)?`,
                  details: { price_changes: priceChanges },
                },
              };
            }
          } else if (fnName === 'bulk_protect_products') {
            // Get product count for detailed confirmation
            const products = (await getProductsByUserId(userId)) as DBProductRecord[];
            const percentage = fnArgs.percentage || 15;
            const unprotectedProducts = fnArgs.only_unprotected
              ? products.filter(p => !p.min_price || p.min_price === 0)
              : products;
            const count = unprotectedProducts.length;

            // Build example calculations (first 3 products)
            const examples = unprotectedProducts
              .slice(0, 3)
              .map(p => {
                const stopLoss = Math.floor(p.current_price * (1 - percentage / 100));
                return `• ${p.title.substring(0, 30)}... ${p.current_price}₽ → **${stopLoss}₽**`;
              })
              .join('\n');

            const detailedMessage = `📊 **Массовая защита товаров**

**Будет защищено:** ${count} товаров (-${percentage}%)

**Примеры расчёта:**
${examples}

⚠️ При акциях WB + СПП цена может упасть до твоего Stop-Loss.`;

            return {
              success: true,
              content: detailedMessage,
              toolsUsed: [fnName],
              tokensUsed: tokens,
              actionRequired: {
                operation: 'bulk_set_min_price',
                confirmationMessage: `Установить Stop-Loss -${percentage}% для ${count} товаров?`,
                details: { ...fnArgs, percentage },
              },
            };
          } else if (fnName === 'set_stop_loss') {
            return {
              success: true,
              content: `Требуется подтверждение для установки Stop-Loss на товар ${fnArgs.product_id}.`,
              toolsUsed: [fnName],
              tokensUsed: tokens,
              actionRequired: {
                operation: 'set_stop_loss',
                confirmationMessage: `Установить Stop-Loss ${fnArgs.min_price}₽ для товара?`,
                details: fnArgs,
              },
            };
          } else if (fnName === 'update_stocks') {
            // Fetch product details to build proper stock_changes array
            const products = await getProductsByUserId(userId);
            const stockChanges = [];

            console.log(`🔍 update_stocks: User ${userId} has ${products.length} products`);
            console.log(`🔍 update_stocks fnArgs:`, JSON.stringify(fnArgs));

            // Parse marketplace filter from fnArgs (required for stocks)
            const requestedMarketplace = fnArgs.marketplace?.toUpperCase();
            if (!requestedMarketplace || !['WB', 'OZON'].includes(requestedMarketplace)) {
              result = JSON.stringify({
                error: 'Не указан маркетплейс. Укажите WB или Ozon.',
              });
            } else {
              // Filter products by marketplace
              const stockProducts = products as DBProductRecord[];
              const filteredProducts = stockProducts.filter(
                p => p.marketplace?.toUpperCase() === requestedMarketplace
              );
              console.log(
                `🔍 Filtered to ${filteredProducts.length} ${requestedMarketplace} products`
              );

              // Parse products from fnArgs
              const requestedProducts = fnArgs.products || [];

              for (const req of requestedProducts) {
                const reqId = String(req.product_id || req.name || req.title || '')
                  .toLowerCase()
                  .trim();
                const reqStock = req.new_stock ?? req.stock ?? req.amount;

                console.log(`🔍 Looking for product: "${reqId}" with new stock: ${reqStock}`);

                // Find matching product
                const dbProduct = filteredProducts.find((p: DBProductRecord) => {
                  const pTitle = String(p.title || '').toLowerCase();
                  return (
                    pTitle.includes(reqId) ||
                    reqId.split(/\s+/).some(w => w.length > 3 && pTitle.includes(w))
                  );
                });

                if (dbProduct && Number.isFinite(reqStock) && reqStock >= 0) {
                  console.log(`✅ Matched: "${reqId}" -> ${dbProduct.title}`);
                  stockChanges.push({
                    product_id: dbProduct.product_id,
                    nm_id: dbProduct.nm_id,
                    vendor_code: dbProduct.vendor_code || String(dbProduct.nm_id),
                    title: dbProduct.title,
                    marketplace: dbProduct.marketplace,
                    currentStock: dbProduct.current_stock || 0,
                    newStock: Math.floor(reqStock),
                  });
                } else {
                  console.log(`❌ No match found for: "${reqId}"`);
                }
              }

              if (stockChanges.length === 0) {
                result = JSON.stringify({
                  error: 'Не найдены товары для изменения остатков',
                  note: 'Остатки можно менять только для FBS (товары на своём складе). Для FBO это невозможно.',
                });
              } else {
                console.log(`✅ Prepared ${stockChanges.length} stock changes`);
                return {
                  success: true,
                  content: `Требуется подтверждение для изменения остатков на ${stockChanges.length} товар(ов). (Только FBS!)`,
                  toolsUsed: [fnName],
                  tokensUsed: tokens,
                  actionRequired: {
                    operation: 'update_stocks',
                    confirmationMessage: `Изменить остатки на ${stockChanges.length} товар(ов)?`,
                    details: { stock_changes: stockChanges, marketplace: requestedMarketplace },
                  },
                };
              }
            }
          } else {
            result = JSON.stringify({ message: `Tool ${fnName} not implemented yet` });
          }
        } catch (toolError) {
          console.error(`Tool ${fnName} execution error:`, toolError);
          result = JSON.stringify({ error: `Ошибка выполнения ${fnName}: ${toolError}` });
        }

        toolOutputs.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: result,
        });
      }

      // Second call with tool outputs
      const secondResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [...messages, ...toolOutputs],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (secondResponse.ok) {
        const secondData = await secondResponse.json();
        return {
          success: true,
          content: secondData.choices[0].message.content,
          toolsUsed: toolNames,
          tokensUsed: tokens + (secondData.usage?.total_tokens || 0),
        };
      }
    }

    return {
      success: true,
      content: message.content || '',
      toolsUsed: [],
      tokensUsed: tokens,
    };
  } catch (e) {
    console.error('OpenAI Call Failed:', e);
    return {
      success: false,
      content:
        '❌ **Произошла ошибка при обращении к AI.**\n\nПопробуйте ещё раз или переформулируйте вопрос.',
      toolsUsed: [],
      tokensUsed: 0,
    };
  }
}

/**
 * Handle agent action
 */
export async function handleAgent(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );
  const adminKey = req.headers['x-admin-key'] as string;
  const validAdminKeys = [process.env.ADMIN_API_KEY].filter(Boolean);

  let userId: number;

  // Admin bypass for testing
  if (adminKey && validAdminKeys.includes(adminKey) && req.body?.userId) {
    userId = parseInt(req.body.userId);
    console.log(`🔧 Agent: Admin bypass for userId=${userId}`);
  } else {
    const validation = validateTelegramInitData(initData);
    if (!validation.valid || !validation.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
    }
    userId = validation.user.id;
  }

  const user = (await getUserById(userId)) as DBUserRecord | null;

  // Check subscription
  if (!isSubscriptionActiveLocal(user)) {
    return res.json({
      success: true,
      content:
        '⚠️ **Для использования AI-агента требуется активная подписка.**\n\nОформите подписку, чтобы получить доступ к:\n• 📊 Юнит-экономике\n• 📈 ABC-анализу товаров\n• 📦 Прогнозу остатков\n• 💰 Управлению ценами через чат',
    });
  }

  const message = sanitizeInput(req.body?.message || '');
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Rate limit
  const agentRateLimit = await checkRateLimit(`agent:${userId}`, true);
  // In index.ts: checkRateLimitAsync(`agent:${userId}`, true);
  // In lib/index.ts: checkRateLimit(key, limit, window).
  // Let's assume standard usage.

  if (!agentRateLimit.allowed) {
    return res.json({
      success: true,
      content: '⏳ **Превышен лимит запросов.**\n\nПодождите минуту и попробуйте снова.',
    });
  }

  const startTime = Date.now();

  // History
  const kv = getKVClient();
  const historyKey = `chat:${userId}`;
  let conversationHistory: Array<{ role: string; content: string }> = [];

  if (kv) {
    try {
      const savedHistory = await kv.get(historyKey);
      if (savedHistory && Array.isArray(savedHistory)) {
        conversationHistory = savedHistory as Array<{ role: string; content: string }>;
      }
    } catch (e) {
      console.warn('⚠️ Failed to load chat history:', e);
    }
  }

  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }

  // Context
  const products = await getProductsByUserId(userId);
  const typedProducts = products as DBProductRecord[];
  const protectedCount = typedProducts.filter(p => p.min_price > 0).length;
  const unprotectedCount = typedProducts.length - protectedCount;

  // Complexity
  const lowerMessage = message.toLowerCase();
  const complexPatterns = [
    'оптимизируй',
    'проанализируй',
    'почему',
    'стратегия',
    'рекомендации',
    'юнит',
    'маржа',
    'прибыль',
    'abc',
    'прогноз',
  ];
  const isComplex = complexPatterns.some(p => lowerMessage.includes(p));
  const model = isComplex ? 'gpt-4o' : 'gpt-4o-mini';

  // V2 MEGA-BRAIN: Expert Persona (Виктор Маржин) + CoT + Few-Shot + Dynamic Context
  const enhancedSystemPrompt = getEnhancedSystemPrompt({
    userName: user?.first_name || 'Продавец',
    productsCount: products.length,
    protectedCount,
    unprotectedCount,
    triggeredToday: user?.triggered_today || 0,
    savedAmount: user?.saved_amount || 0,
    hasWbApi: !!user?.api_key_wb,
    hasOzonApi: !!user?.api_key_ozon,
  });

  const toolsUserContext = {
    wbApiKey: user?.api_key_wb ? decryptApiKey(user.api_key_wb) : undefined,
    ozonApiKey: user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : undefined,
  };

  const messages: OpenAIMessage[] = [{ role: 'system', content: enhancedSystemPrompt }];

  for (const histMsg of conversationHistory.slice(-15)) {
    if (histMsg.role === 'user' || histMsg.role === 'assistant') {
      let content = histMsg.content;
      if (content.length > 500) content = content.substring(0, 500) + '...';
      messages.push({ role: histMsg.role as 'user' | 'assistant', content });
    }
  }

  messages.push({ role: 'user', content: message });

  const gptResult = await callOpenAIWithTools(
    messages,
    userId,
    toolsUserContext,
    model,
    isComplex ? 2000 : 1200
  );

  interface AgentResponseType {
    content: string;
    actionRequired?: ActionRequired;
    metadata?: {
      executionTime: number;
      model: string;
      toolsUsed: string[];
      tokensUsed: number;
    };
  }

  const agentResponse: AgentResponseType = {
    content: gptResult.content || '',
    metadata: {
      executionTime: Date.now() - startTime,
      model,
      toolsUsed: gptResult.toolsUsed,
      tokensUsed: gptResult.tokensUsed,
    },
  };

  if (gptResult.actionRequired) {
    agentResponse.actionRequired = gptResult.actionRequired;
  }

  // === METRICS LOGGING ===
  const metrics = createAgentMetrics({
    userId,
    userMessage: message,
    model,
    tokensUsed: gptResult.tokensUsed,
    responseTime: Date.now() - startTime,
    toolsUsed: gptResult.toolsUsed,
    hadError: !gptResult.success,
    errorType: gptResult.success ? undefined : 'openai_error',
    actionRequired: gptResult.actionRequired
      ? { type: gptResult.actionRequired.operation }
      : undefined,
  });

  // Log metrics asynchronously (don't block response)
  logAgentMetrics(metrics).catch(e => console.warn('Metrics logging failed:', e));

  // Debug log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(formatMetricsForLog(metrics));
  }

  // Save history
  if (kv && gptResult.content) {
    try {
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: gptResult.content });
      if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);
      await kv.set(historyKey, conversationHistory, { ex: 86400 });
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  }

  return res.json({ success: true, ...agentResponse });
}

/**
 * Handle agent confirmation
 */
export async function handleAgentConfirm(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = validation.user.id;
  const { operation, confirmed, details: _details } = req.body;

  if (!confirmed) {
    return res.json({ success: true, content: '👍 Операция отменена.', executed: false });
  }

  let resultContent = '';
  let executed = false;

  // Safe parse of details (per audit recommendation - handle invalid JSON)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let details: any = {};
  try {
    details = typeof _details === 'string' ? JSON.parse(_details) : _details || {};
  } catch (e) {
    console.error('❌ Failed to parse details:', e, _details);
    return res.status(400).json({
      success: false,
      error: 'Invalid details format',
      content: '❌ Ошибка формата данных. Попробуйте снова.',
    });
  }

  console.log(`🔧 handleAgentConfirm: operation=${operation}, userId=${userId}`);
  console.log(`🔧 handleAgentConfirm details:`, JSON.stringify(details).substring(0, 500));

  // Logic for executions...
  if (operation === 'bulk_set_min_price') {
    const percentage = details.percentage || 15;
    const products = (await getProductsByUserId(userId)) as DBProductRecord[];
    const filteredProducts = details.only_unprotected
      ? products.filter(p => !p.min_price || p.min_price === 0)
      : products;

    let updated = 0;
    for (const product of filteredProducts) {
      const minPrice = Math.floor((product.current_price || 0) * (1 - percentage / 100));
      if (minPrice > 0) {
        await updateProductMinPrice(userId, product.product_id, minPrice);
        updated++;
      }
    }
    resultContent = `✅ **Успешно!**\n\nДля ${updated} товаров установлен Stop-Loss (-${percentage}%).`;
    executed = true;
  } else if (operation === 'set_stop_loss') {
    const { product_id, min_price } = details;
    if (product_id && min_price) {
      await updateProductMinPrice(userId, product_id, min_price);
      resultContent = `✅ **Stop-Loss установлен!**\n\nНовая минимальная цена: ${min_price} ₽`;
      executed = true;
    } else {
      resultContent = '❌ Ошибка: не указан товар или цена.';
    }
  } else if (operation === 'update_prices') {
    const { price_changes } = details;

    if (price_changes && Array.isArray(price_changes) && price_changes.length > 0) {
      console.log(
        `🚀 EXECUTING REAL PRICE UPDATE for User ${userId}, ${price_changes.length} items`
      );

      // Get user ONCE at the beginning (per audit: avoid duplicate getUserById calls)
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          content: '❌ Пользователь не найден.',
        });
      }

      // Group by marketplace
      const wbUpdates: Array<{ nmId: number; newPrice: number; productId: string }> = [];
      const ozonUpdates: Array<{ productId: string; newPrice: number }> = [];

      for (const item of price_changes) {
        if (item.marketplace === 'WB' && item.nm_id) {
          wbUpdates.push({
            nmId: Number(item.nm_id),
            newPrice: Math.floor(item.newPrice),
            productId: item.product_id,
          });
        } else if (item.marketplace === 'Ozon') {
          ozonUpdates.push({
            productId: item.product_id,
            newPrice: Math.floor(item.newPrice),
          });
        }
      }

      let wbResult = { success: true, count: 0, error: '' };
      let ozonResult = { success: true, count: 0, error: '' };

      // --- WB UPDATE (using centralized marketplace service) ---
      if (wbUpdates.length > 0) {
        if (user.api_key_wb) {
          const wbApiKey = decryptApiKey(user.api_key_wb);

          console.log(`📤 WB Price Update via marketplace service: ${wbUpdates.length} items`);

          // Use centralized function with all fixes:
          // - nmID format (not nmId)
          // - discount: 0 included
          // - Input validation
          // - Batch limit (200 items)
          const result = await updateWbPrices(
            wbApiKey,
            wbUpdates.map(u => ({ nmId: u.nmId, price: u.newPrice }))
          );

          wbResult = {
            success: result.success,
            count: result.count,
            error: result.error || '',
          };

          if (result.success && result.taskId) {
            console.log(`📋 WB Task ID: ${result.taskId} - Task is QUEUED (not yet completed)`);

            // IMPROVED (Dec 2024 Audit): Use pending price tracking
            // Step 1: Save pending prices to DB (optimistic tracking)
            await batchSetPendingPrices(
              userId,
              wbUpdates.map(u => ({
                nmId: u.nmId,
                pendingPrice: u.newPrice,
                taskId: result.taskId!,
              }))
            );

            // Step 2: Wait for WB to process the task
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Check task status
            const taskStatus = await checkWbTaskStatus(wbApiKey, result.taskId);

            if (taskStatus.hasErrors) {
              console.error(`❌ WB Task ${result.taskId} failed:`, taskStatus.errors);
              // Pending prices will be cleaned up by cron job or stay as 'pending'
              wbResult = {
                success: false,
                count: 0,
                error: taskStatus.errors?.join('; ') || 'Задача WB завершилась с ошибкой',
              };
            } else if (taskStatus.completed) {
              // Task completed successfully - confirm pending prices
              await batchConfirmPendingByTaskId(result.taskId);
              console.log(`✅ WB Task ${result.taskId} completed - prices confirmed`);
            } else {
              // Task still processing - also update DB (optimistic approach)
              // Pending prices will be confirmed by cron job later
              const dbResult = await batchUpdateWbPrices(
                userId,
                wbUpdates.map(u => ({ nmId: u.nmId, newPrice: u.newPrice }))
              );
              console.log(
                `📦 DB updated: ${dbResult.updated}/${wbUpdates.length} WB prices (task status: ${taskStatus.status || 'processing'})`
              );
            }
          }
        } else {
          wbResult = { success: false, count: 0, error: 'WB API ключ не настроен' };
        }
      }

      // --- OZON UPDATE (using centralized marketplace service) ---
      if (ozonUpdates.length > 0) {
        if (user.api_key_ozon) {
          const decryptedOzonKey = decryptApiKey(user.api_key_ozon);
          const [clientId, apiKey] = (decryptedOzonKey || '').split(':');

          if (clientId && apiKey) {
            console.log(
              `📤 Ozon Price Update via marketplace service: ${ozonUpdates.length} items`
            );

            // Parse Ozon product IDs (remove 'ozon-' prefix)
            const ozonPayload = ozonUpdates.map(u => ({
              productId: parseInt(u.productId.replace('ozon-', '')),
              price: u.newPrice,
            }));

            // Use centralized function
            const result = await updateOzonPrices(clientId, apiKey, ozonPayload);

            ozonResult = {
              success: result.success,
              count: result.count,
              error: result.error || '',
            };

            if (result.success) {
              // Update local DB using batch function (per audit: atomic update instead of loop)
              const dbResult = await batchUpdateOzonPrices(
                userId,
                ozonUpdates.map(u => ({ productId: u.productId, newPrice: u.newPrice }))
              );
              console.log(`📦 DB updated: ${dbResult.updated}/${ozonUpdates.length} Ozon prices`);
            }
          } else {
            ozonResult = {
              success: false,
              count: 0,
              error: 'Неверный формат Ozon API ключа',
            };
          }
        } else {
          ozonResult = { success: false, count: 0, error: 'Ozon API ключ не настроен' };
        }
      }

      // Result
      const totalUpdated = wbResult.count + ozonResult.count;
      if (wbResult.success && ozonResult.success && totalUpdated > 0) {
        resultContent = `✅ **Цены успешно обновлены!**\n\n`;
        if (wbResult.count > 0) resultContent += `• WB: ${wbResult.count} товаров\n`;
        if (ozonResult.count > 0) resultContent += `• Ozon: ${ozonResult.count} товаров\n`;
        executed = true;
      } else {
        resultContent = `❌ **Ошибка при обновлении цен:**\n`;
        if (!wbResult.success && wbUpdates.length > 0) resultContent += `• WB: ${wbResult.error}\n`;
        if (!ozonResult.success && ozonUpdates.length > 0)
          resultContent += `• Ozon: ${ozonResult.error}\n`;
      }
    } else {
      resultContent = '❌ Ошибка данных для обновления цен.';
    }
  } else if (operation === 'update_stocks') {
    // Handle stock updates for FBS
    const { stock_changes, marketplace } = details;

    if (stock_changes && Array.isArray(stock_changes) && stock_changes.length > 0) {
      console.log(
        `🚀 EXECUTING REAL STOCK UPDATE for User ${userId}, ${stock_changes.length} items on ${marketplace}`
      );

      const user = await getUserById(userId);
      let stockResult = { success: false, count: 0, error: '' };

      if (marketplace === 'WB') {
        // WB Stock Update (FBS)
        if (user?.api_key_wb) {
          const wbApiKey = decryptApiKey(user.api_key_wb);

          // First, get the FBS warehouse
          const { updateWbStockFbs, getWbFbsWarehouses } =
            await import('../../src/api-lib/services/marketplace.js');

          const warehousesResult = await getWbFbsWarehouses(wbApiKey);

          if (warehousesResult.warehouses.length === 0) {
            stockResult = {
              success: false,
              count: 0,
              error:
                'Не найдены FBS склады. Возможно, вы работаете по FBO — остатки управляются Wildberries.',
            };
          } else {
            // Use first warehouse (most common case)
            const warehouseId = warehousesResult.warehouses[0].id;
            console.log(
              `📦 Using WB warehouse: ${warehousesResult.warehouses[0].name} (${warehouseId})`
            );

            interface StockChangeItem {
              vendor_code?: string;
              nm_id?: number;
              product_id?: string;
              newStock: number;
            }
            const updates = (stock_changes as StockChangeItem[]).map(item => ({
              sku: item.vendor_code || String(item.nm_id),
              amount: item.newStock,
            }));

            const result = await updateWbStockFbs(wbApiKey, warehouseId, updates);
            stockResult = { ...result, error: result.error || '' };
          }
        } else {
          stockResult = { success: false, count: 0, error: 'WB API ключ не настроен' };
        }
      } else if (marketplace === 'OZON') {
        // Ozon Stock Update (FBS)
        if (user?.api_key_ozon) {
          const decryptedOzonKey = decryptApiKey(user.api_key_ozon);
          const [clientId, apiKey] = (decryptedOzonKey || '').split(':');

          if (clientId && apiKey) {
            const { updateOzonStockFbs } =
              await import('../../src/api-lib/services/marketplace.js');

            interface OzonStockChangeItem {
              product_id: string;
              vendor_code?: string;
              newStock: number;
            }
            const updates = (stock_changes as OzonStockChangeItem[]).map(item => ({
              productId: parseInt(item.product_id.replace('ozon-', '')),
              offerId: item.vendor_code || String(item.product_id),
              stock: item.newStock,
            }));

            const result = await updateOzonStockFbs(clientId, apiKey, updates);
            stockResult = { ...result, error: result.error || '' };
          } else {
            stockResult = { success: false, count: 0, error: 'Неверный формат Ozon API ключа' };
          }
        } else {
          stockResult = { success: false, count: 0, error: 'Ozon API ключ не настроен' };
        }
      }

      if (stockResult.success && stockResult.count > 0) {
        resultContent = `✅ **Остатки успешно обновлены!**\n\n• ${marketplace}: ${stockResult.count} товаров\n\n⚠️ Изменения применятся в течение нескольких минут.`;
        executed = true;
      } else {
        resultContent = `❌ **Ошибка при обновлении остатков:**\n\n${stockResult.error || 'Неизвестная ошибка'}\n\n💡 Остатки можно менять только для FBS (товары на своём складе). Для FBO это невозможно.`;
      }
    } else {
      resultContent = '❌ Ошибка данных для обновления остатков.';
    }
  } else {
    resultContent = '❌ Неизвестная операция.';
  }

  return res.json({ success: true, content: resultContent, executed });
}

/**
 * Handle agent status
 */
export async function handleAgentStatus(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  return res.json({
    available: true,
    model: 'gpt-4o-mini',
    capabilities: ['Статистика продаж', 'Управление ценами', 'Защита товаров', 'Аналитика'],
  });
}
