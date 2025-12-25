// ============================================
// NeuroGUARDIAN — Agent Orchestrator V3
// Main orchestration: Router → Specialist → Response
// Version: 3.0.0 | Date: December 2024
// ============================================

import { randomUUID } from 'crypto';

import { routeMessage, getSpecialistConfig, isConfirmation, isRejection } from './router.js';
import { sanitizeTextUrls } from './url-validator.js';
import {
  validateToolArgs,
  UpdatePricesDetailsSchema,
  UpdateStocksDetailsSchema,
  SetStopLossDetailsSchema,
  BulkProtectDetailsSchema,
  SetStopLossArgsSchema,
  UpdatePricesArgsSchema,
  BulkProtectProductsArgsSchema,
  UpdateStocksArgsSchema,
  GetProductsArgsSchema,
  GetSalesStatsArgsSchema,
  GetOrdersArgsSchema,
  GetWarehouseStocksArgsSchema,
  CalculateUnitEconomicsArgsSchema,
  GetAbcAnalysisArgsSchema,
  GetStockForecastArgsSchema,
  GetMarketplaceInfoArgsSchema,
  type UpdateStocksDetails,
} from './validators.js';
import { type RouterResult } from './schemas.js';
import { buildAnalyticsPrompt, ANALYTICS_TOOLS } from './specialists/analytics.js';
import { buildPricingPrompt, PRICING_TOOLS } from './specialists/pricing.js';
import { buildCompetitorsPrompt, COMPETITORS_TOOLS } from './specialists/competitors.js';
import { buildGeneralPrompt, GENERAL_TOOLS } from './specialists/general.js';
import { AGENT_TOOLS } from './tools.js';

// Tool executors
import {
  executeGetProducts,
  executeGetSalesStats,
  executeGetOrders,
  executeGetWarehouseStocks,
  executeCalculateUnitEconomics,
  executeGetAbcAnalysis,
  executeGetStockForecast,
  executeGetMarketplaceInfo,
  executeSearchWeb,
} from './tool-executors.js';

// Services for executing confirmed actions
import { updateProductMinPrice, getProductsByUserId } from '../services/index.js';

// Marketplace API (WB/Ozon price and stock updates)
import {
  updateWbPrices,
  updateOzonPrices,
  updateWbStockFbs,
  updateOzonStockFbs,
  getWbFbsWarehouses,
  getOzonFbsWarehouses,
} from '../services/marketplace.js';
import { findProductMatch } from '../utils/product-matcher.js';

// ============================================
// TYPES
// ============================================

export interface UserContext {
  userId: number;
  productsCount?: number;
  protectedCount?: number;
  hasWbApi?: boolean;
  hasOzonApi?: boolean;
  marketplace?: string;
  wbApiKey?: string;
  ozonApiKey?: string;
}

export interface OrchestratorResult {
  success: boolean;
  content: string;
  category: string;
  model: string;
  toolsUsed: string[];
  tokensUsed: number;
  executionTimeMs: number;
  actionRequired?: {
    operation: string;
    taskId: string;
    confirmationMessage: string;
    details: Record<string, unknown>;
    expiresAt: number;
  };
  routerResult?: RouterResult;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

// ============================================
// SPECIALIST PROMPT BUILDERS
// ============================================

function getSpecialistPrompt(category: string, context: UserContext): string {
  switch (category) {
    case 'analytics':
      return buildAnalyticsPrompt({
        productsCount: context.productsCount,
        marketplace: context.marketplace,
        hasWbApi: context.hasWbApi,
        hasOzonApi: context.hasOzonApi,
      });
    case 'pricing':
    case 'sentinel':
      return buildPricingPrompt({
        productsCount: context.productsCount,
        protectedCount: context.protectedCount,
        marketplace: context.marketplace,
      });
    case 'competitors':
      return buildCompetitorsPrompt({
        marketplace: context.marketplace,
      });
    case 'stocks':
      return buildAnalyticsPrompt({
        productsCount: context.productsCount,
        marketplace: context.marketplace,
        hasWbApi: context.hasWbApi,
        hasOzonApi: context.hasOzonApi,
      });
    case 'general':
    default:
      return buildGeneralPrompt({
        productsCount: context.productsCount,
        protectedCount: context.protectedCount,
        hasWbApi: context.hasWbApi,
        hasOzonApi: context.hasOzonApi,
        isNewUser: !context.hasWbApi && !context.hasOzonApi,
      });
  }
}

function getSpecialistTools(category: string): string[] {
  switch (category) {
    case 'analytics':
      return ANALYTICS_TOOLS;
    case 'pricing':
    case 'sentinel':
      return PRICING_TOOLS;
    case 'competitors':
      return COMPETITORS_TOOLS;
    case 'stocks':
      return ['get_products', 'get_warehouse_stocks', 'update_stocks', 'get_stock_forecast'];
    case 'general':
    default:
      return GENERAL_TOOLS;
  }
}

// ============================================
// TOOL EXECUTOR
// ============================================

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: number
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'get_products':
        return await executeGetProducts(
          userId,
          args as { marketplace?: string; limit?: number; sort_by?: string }
        );
      case 'get_sales_stats':
        return await executeGetSalesStats(userId, args as { period: string; marketplace?: string });
      case 'get_orders':
        return await executeGetOrders(
          userId,
          args as { period: string; marketplace?: string; status?: string }
        );
      case 'get_warehouse_stocks':
        return await executeGetWarehouseStocks(
          userId,
          args as { marketplace?: string; low_stock_only?: boolean }
        );
      case 'calculate_unit_economics':
        return await executeCalculateUnitEconomics(
          userId,
          args as { product_id?: string; cost_price?: number; marketplace?: string }
        );
      case 'get_abc_analysis':
        return await executeGetAbcAnalysis(userId, args as { period?: string });
      case 'get_stock_forecast':
        return await executeGetStockForecast(userId, args as { product_id?: string });
      case 'get_marketplace_info':
        return executeGetMarketplaceInfo(args as { marketplace?: string; topic: string });
      case 'search_web':
        return await executeSearchWeb(userId, args);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool ${toolName} execution error:`, error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// RESPONSE SANITIZATION
// ============================================

function sanitizeResponse(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // Remove HTML attributes from URLs
  cleaned = cleaned.replace(
    /(https?:\/\/[^\s"'<>]+?)["']\s*(?:target|rel|class)\s*=\s*["'][^"']*["'][^>]*>([^<]*)/gi,
    (_, url, linkText) => (linkText ? `[${linkText}](${url})` : url)
  );

  // Remove orphaned HTML attributes
  cleaned = cleaned.replace(/"\s*target\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*rel\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<a\s[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/a>/gi, '');

  // Validate URLs against whitelist
  cleaned = sanitizeTextUrls(cleaned);

  return cleaned;
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

/**
 * Main orchestration function
 * Routes message → Specialist → Tools → Response
 */
export async function orchestrateAgentRequest(
  message: string,
  context: UserContext,
  conversationHistory?: Array<{ role: string; content: string }>,
  pendingAction?: { operation: string; taskId: string; details: Record<string, unknown> }
): Promise<OrchestratorResult> {
  const startTime = Date.now();

  // Check for confirmation/rejection of pending action
  if (pendingAction) {
    if (isConfirmation(message)) {
      return handleConfirmation(pendingAction, context, startTime);
    }
    if (isRejection(message)) {
      return {
        success: true,
        content: '❌ Действие отменено.',
        category: 'confirmation',
        model: 'none',
        toolsUsed: [],
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // Step 1: Route the message
  console.log(`🎯 Routing message: "${message.substring(0, 50)}..."`);
  const routerResult = await routeMessage(message, conversationHistory);

  const { category, extractedParams } = routerResult;
  const config = getSpecialistConfig(category);

  console.log(`📍 Category: ${category}, Model: ${config.model}, Tools: ${config.tools.length}`);

  // Step 2: Build specialist prompt
  const systemPrompt = getSpecialistPrompt(category, {
    ...context,
    marketplace: extractedParams?.marketplace || context.marketplace,
  });

  // Step 3: Filter tools for this specialist
  const allowedTools = getSpecialistTools(category);
  const filteredTools =
    allowedTools.length > 0
      ? AGENT_TOOLS.filter(t => allowedTools.includes(t.function.name))
      : undefined;

  // Step 4: Call specialist
  const result = await callSpecialist(
    systemPrompt,
    message,
    conversationHistory || [],
    context.userId,
    config.model,
    config.maxTokens,
    config.temperature,
    filteredTools
  );

  // Step 5: Sanitize response
  const sanitizedContent = sanitizeResponse(result.content);

  return {
    success: result.success,
    content: sanitizedContent,
    category,
    model: config.model,
    toolsUsed: result.toolsUsed,
    tokensUsed: result.tokensUsed,
    executionTimeMs: Date.now() - startTime,
    actionRequired: result.actionRequired,
    routerResult,
  };
}

// ============================================
// SPECIALIST CALLER
// ============================================

async function callSpecialist(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  userId: number,
  model: string,
  maxTokens: number,
  temperature: number,
  tools?: typeof AGENT_TOOLS
): Promise<{
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: OrchestratorResult['actionRequired'];
}> {
  // ========================================
  // LLM Provider Selection: OpenAI > Groq > AgentRouter
  // ========================================
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const agentRouterKey = process.env.AGENTROUTER_API_KEY;

  const apiKey = openaiKey || groqKey || agentRouterKey;
  const provider = openaiKey ? 'OpenAI' : groqKey ? 'Groq' : 'AgentRouter';

  if (!apiKey) {
    console.error('❌ No LLM API key configured! Set OPENAI_API_KEY');
    return {
      success: false,
      content: '⚠️ AI-агент временно недоступен. Попробуйте позже.',
      toolsUsed: [],
      tokensUsed: 0,
    };
  }

  // Model and URL selection based on provider
  let finalModel = model;
  let apiUrl = 'https://api.openai.com/v1/chat/completions';

  if (groqKey && !openaiKey) {
    apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    // Map OpenAI models to Groq equivalents
    if (model === 'gpt-4o' || model === 'gpt-4o-mini') {
      finalModel = 'llama-3.1-70b-versatile'; // Best Groq model for complex tasks
    } else {
      finalModel = 'llama-3.1-8b-instant'; // Fast model for simple tasks
    }
  } else if (agentRouterKey && !openaiKey && !groqKey) {
    apiUrl = 'https://agentrouter.org/v1/chat/completions';
    // AgentRouter supports OpenAI model names
  }

  console.log(`🤖 V3 Specialist using ${provider} with model: ${finalModel}`);

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const requestBody: Record<string, unknown> = {
      model: finalModel,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;
    const tokens = data.usage?.total_tokens || 0;

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      return await handleToolCalls(
        message,
        messages,
        userId,
        finalModel,
        maxTokens,
        tokens,
        apiKey,
        apiUrl
      );
    }

    return {
      success: true,
      content: message.content || '',
      toolsUsed: [],
      tokensUsed: tokens,
    };
  } catch (error) {
    console.error('Specialist call error:', error);
    return {
      success: false,
      content: '❌ Произошла ошибка. Попробуйте переформулировать вопрос.',
      toolsUsed: [],
      tokensUsed: 0,
    };
  }
}

// ============================================
// TOOL CALL HANDLER
// ============================================

async function handleToolCalls(
  assistantMessage: {
    tool_calls: Array<{ id: string; function: { name: string; arguments: string } }>;
  },
  messages: OpenAIMessage[],
  userId: number,
  model: string,
  maxTokens: number,
  tokensUsed: number,
  apiKey: string,
  apiUrl: string = 'https://api.openai.com/v1/chat/completions'
): Promise<{
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: OrchestratorResult['actionRequired'];
}> {
  const toolCalls = assistantMessage.tool_calls;
  const toolNames = toolCalls.map(tc => tc.function.name);
  // Build properly typed assistant message with tool_calls
  const assistantMsg: OpenAIMessage = {
    role: 'assistant',
    content: null,
    tool_calls: toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: tc.function,
    })),
  };
  const toolOutputs: OpenAIMessage[] = [assistantMsg];

  console.log(`🔧 Executing ${toolCalls.length} tools: ${toolNames.join(', ')}`);

  for (const toolCall of toolCalls) {
    const fnName = toolCall.function.name;
    const fnArgs = JSON.parse(toolCall.function.arguments || '{}');

    // Check for actions requiring confirmation
    if (
      ['update_prices', 'set_stop_loss', 'bulk_protect_products', 'update_stocks'].includes(fnName)
    ) {
      return handleConfirmableAction(fnName, fnArgs, userId, toolNames, tokensUsed);
    }

    // NEW: Robust validation for read-only tools before execution
    // This prevents tool executor crashes from malformed LLM arguments
    let validatedArgs = fnArgs;
    switch (fnName) {
      case 'get_products': {
        const vProducts = validateToolArgs(GetProductsArgsSchema, fnArgs);
        if (vProducts.success) validatedArgs = vProducts.data;
        break;
      }
      case 'get_sales_stats': {
        const vStats = validateToolArgs(GetSalesStatsArgsSchema, fnArgs);
        if (vStats.success) validatedArgs = vStats.data;
        break;
      }
      case 'get_orders': {
        const vOrders = validateToolArgs(GetOrdersArgsSchema, fnArgs);
        if (vOrders.success) validatedArgs = vOrders.data;
        break;
      }
      case 'get_warehouse_stocks': {
        const vWh = validateToolArgs(GetWarehouseStocksArgsSchema, fnArgs);
        if (vWh.success) validatedArgs = vWh.data;
        break;
      }
      case 'calculate_unit_economics': {
        const vUnit = validateToolArgs(CalculateUnitEconomicsArgsSchema, fnArgs);
        if (vUnit.success) validatedArgs = vUnit.data;
        break;
      }
      case 'get_abc_analysis': {
        const vAbc = validateToolArgs(GetAbcAnalysisArgsSchema, fnArgs);
        if (vAbc.success) validatedArgs = vAbc.data;
        break;
      }
      case 'get_stock_forecast': {
        const vFore = validateToolArgs(GetStockForecastArgsSchema, fnArgs);
        if (vFore.success) validatedArgs = vFore.data;
        break;
      }
      case 'get_marketplace_info': {
        const vMp = validateToolArgs(GetMarketplaceInfoArgsSchema, fnArgs);
        if (vMp.success) validatedArgs = vMp.data;
        break;
      }
    }

    // Execute tool with validated args
    const result = await executeTool(fnName, validatedArgs, userId);

    toolOutputs.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: fnName,
      content: JSON.stringify(result.data || { error: result.error }),
    });
  }

  // Second call with tool results
  const secondResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [...messages, ...toolOutputs],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!secondResponse.ok) {
    throw new Error(`OpenAI second call failed: ${secondResponse.status}`);
  }

  const secondData = await secondResponse.json();
  const totalTokens = tokensUsed + (secondData.usage?.total_tokens || 0);

  return {
    success: true,
    content: secondData.choices[0].message.content || '',
    toolsUsed: toolNames,
    tokensUsed: totalTokens,
  };
}

// ============================================
// CONFIRMABLE ACTION HANDLER
// ============================================

async function handleConfirmableAction(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
  toolNames: string[],
  tokensUsed: number
): Promise<{
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: OrchestratorResult['actionRequired'];
}> {
  const taskId = randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Fetch products for matching
  const products = await getProductsByUserId(userId);
  let confirmationMessage = '';
  let previewList = '';
  let enrichedDetails: Record<string, unknown> = {};

  // 1. Validate based on tool
  switch (toolName) {
    case 'set_stop_loss': {
      const v = validateToolArgs(SetStopLossArgsSchema, args);
      if (!v.success) return { success: false, content: v.error, toolsUsed: toolNames, tokensUsed };
      const { product_id, min_price, percentage } = v.data;

      const product = findProductMatch(product_id, products as any);
      if (!product) {
        return {
          success: false,
          content: `❌ Товар "${product_id}" не найден.`,
          toolsUsed: toolNames,
          tokensUsed,
        };
      }

      const finalMinPrice =
        min_price || (percentage ? Math.round(product.current_price * (1 - percentage / 100)) : 0);
      if (finalMinPrice <= 0) {
        return {
          success: false,
          content: `❌ Не удалось рассчитать цену защиты. Укажите сумму или корректный процент.`,
          toolsUsed: toolNames,
          tokensUsed,
        };
      }

      confirmationMessage = `Установить Stop-Loss ${finalMinPrice}₽ для товара "${product.title}"?`;
      previewList = `• **${product.title}** (${product.product_id})\n  Цена: ${product.current_price}₽ → Защита: ${finalMinPrice}₽`;
      enrichedDetails = { product_id: product.product_id, min_price: finalMinPrice };
      break;
    }

    case 'update_prices': {
      const v = validateToolArgs(UpdatePricesArgsSchema, args);
      if (!v.success) return { success: false, content: v.error, toolsUsed: toolNames, tokensUsed };
      const { products: updates, marketplace, change_value } = v.data;

      const priceChanges: any[] = [];
      if (updates && updates.length > 0) {
        for (const up of updates) {
          const product = findProductMatch(up.product_id, products as any);
          if (product) {
            priceChanges.push({
              product_id: product.product_id,
              nm_id: product.nm_id,
              title: product.title,
              marketplace: product.marketplace,
              currentPrice: product.current_price,
              newPrice: up.new_price,
            });
          }
        }
      } else if (change_value) {
        // Bulk change for all or specific marketplace
        const targets = products.filter(
          p => marketplace === 'all' || p.marketplace === marketplace
        );
        for (const p of targets) {
          const newPrice = Math.round(p.current_price * (1 + change_value / 100));
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
        return {
          success: false,
          content: '❌ Товары для изменения цен не найдены.',
          toolsUsed: toolNames,
          tokensUsed,
        };
      }

      confirmationMessage = `Изменить цены для ${priceChanges.length} товаров?`;
      previewList = priceChanges
        .slice(0, 5)
        .map(pc => `• ${pc.title}: ${pc.currentPrice}₽ → **${pc.newPrice}₽**`)
        .join('\n');
      if (priceChanges.length > 5) previewList += `\n...и еще ${priceChanges.length - 5} товаров.`;

      enrichedDetails = { price_changes: priceChanges, marketplace };
      break;
    }

    case 'bulk_protect_products': {
      const v = validateToolArgs(BulkProtectProductsArgsSchema, args);
      if (!v.success) return { success: false, content: v.error, toolsUsed: toolNames, tokensUsed };
      const { percentage, only_unprotected } = v.data;

      const targets = products.filter(p => !only_unprotected || p.min_price === 0);
      if (targets.length === 0) {
        return {
          success: false,
          content: '❌ Нет подходящих товаров для массовой защиты.',
          toolsUsed: toolNames,
          tokensUsed,
        };
      }

      const protectList = targets.map(p => ({
        product_id: p.product_id,
        min_price: Math.round(p.current_price * (1 - percentage / 100)),
      }));

      confirmationMessage = `Установить защиту -${percentage}% для ${targets.length} товаров?`;
      previewList = `Будет защищено ${targets.length} товаров на сумму от ${Math.min(...protectList.map(l => l.min_price))}₽`;
      enrichedDetails = { percentage, only_unprotected, products: protectList };
      break;
    }

    case 'update_stocks': {
      const v = validateToolArgs(UpdateStocksArgsSchema, args);
      if (!v.success) return { success: false, content: v.error, toolsUsed: toolNames, tokensUsed };
      const { products: stockUpdates, marketplace } = v.data;

      const stockChanges: any[] = [];
      for (const su of stockUpdates) {
        const product = findProductMatch(su.product_id, products as any);
        if (product) {
          stockChanges.push({
            product_id: product.product_id,
            sku: su.product_id, // Often the same
            new_stock: su.new_stock,
            marketplace: product.marketplace,
          });
        }
      }

      if (stockChanges.length === 0) {
        return {
          success: false,
          content: '❌ Товары для изменения остатков не найдены.',
          toolsUsed: toolNames,
          tokensUsed,
        };
      }

      confirmationMessage = `Изменить остатки для ${stockChanges.length} товаров на ${marketplace}?`;
      previewList = stockChanges
        .slice(0, 5)
        .map(sc => `• ${sc.product_id}: → **${sc.new_stock}** шт.`)
        .join('\n');

      enrichedDetails = { stock_changes: stockChanges, marketplace };
      break;
    }

    default:
      confirmationMessage = `Выполнить действие ${toolName}?`;
      enrichedDetails = { ...args };
  }

  // Build final content
  let content = `📊 **Требуется подтверждение: ${toolName}**\n\n`;
  content += `${previewList}\n\n`;
  content += `❓ **${confirmationMessage}**\n\n`;
  content += `🚀 Отправьте **"да"** для выполнения или **"нет"** для отмены.`;

  return {
    success: true,
    content,
    toolsUsed: toolNames,
    tokensUsed,
    actionRequired: {
      operation: toolName,
      taskId,
      confirmationMessage,
      details: enrichedDetails,
      expiresAt,
    },
  };
}

// ============================================
// CONFIRMATION HANDLER
// ============================================

async function handleConfirmation(
  pendingAction: { operation: string; taskId: string; details: Record<string, unknown> },
  context: UserContext,
  startTime: number
): Promise<OrchestratorResult> {
  const { operation, details } = pendingAction;

  console.log(`✅ Executing confirmed action: ${operation}, taskId: ${pendingAction.taskId}`);

  try {
    switch (operation) {
      // ========================================
      // UPDATE_PRICES - Change prices on marketplace
      // ========================================
      case 'update_prices': {
        const validation = validateToolArgs(UpdatePricesDetailsSchema, details);
        if (!validation.success) {
          return createErrorResult(validation.error, operation, startTime);
        }

        const { price_changes } = validation.data;

        // Group by marketplace for execution
        const wbChanges = price_changes.filter(pc => pc.marketplace === 'WB');
        const ozonChanges = price_changes.filter(pc => pc.marketplace === 'Ozon');

        let resultMessage = '';

        // Execute WB
        if (wbChanges.length > 0) {
          if (!context.wbApiKey)
            return createErrorResult('WB API ключ не настроен', operation, startTime);

          const updates = wbChanges.map(pc => ({
            nmId: pc.nm_id || parseInt(pc.product_id),
            price: pc.newPrice,
          }));

          const res = await updateWbPrices(context.wbApiKey, updates);
          if (res.success) {
            resultMessage += `✅ **Wildberries**: обновлено ${res.count} товаров.\n`;
          } else {
            resultMessage += `❌ **Wildberries**: ошибка (${res.error}).\n`;
          }
        }

        // Execute Ozon
        if (ozonChanges.length > 0) {
          if (!context.ozonApiKey)
            return createErrorResult('Ozon API ключ не настроен', operation, startTime);
          const [clientId, apiKey] = context.ozonApiKey.split(':');

          const updates = ozonChanges.map(pc => ({
            productId: parseInt(pc.product_id),
            price: pc.newPrice,
          }));

          const res = await updateOzonPrices(clientId, apiKey, updates);
          if (res.success) {
            resultMessage += `✅ **Ozon**: обновлено ${res.count} товаров.\n`;
          } else {
            resultMessage += `❌ **Ozon**: ошибка (${res.error}).\n`;
          }
        }

        return createSuccessResult(resultMessage, operation, startTime);
      }

      // ========================================
      // SET_STOP_LOSS - Set price protection
      // ========================================
      case 'set_stop_loss': {
        const validation = validateToolArgs(SetStopLossDetailsSchema, details);
        if (!validation.success) return createErrorResult(validation.error, operation, startTime);

        const { product_id, min_price } = validation.data;
        await updateProductMinPrice(context.userId, product_id, min_price);

        return createSuccessResult(
          `✅ **Stop-Loss установлен!**\n\nТовар ID: \`${product_id}\` теперь защищен на уровне **${min_price}₽**.`,
          operation,
          startTime
        );
      }

      // ========================================
      // BULK_PROTECT_PRODUCTS - Protect all
      // ========================================
      case 'bulk_protect_products': {
        const validation = validateToolArgs(BulkProtectDetailsSchema, details);
        if (!validation.success) return createErrorResult(validation.error, operation, startTime);

        const { products: updates } = validation.data;
        if (!updates) return createErrorResult('Список товаров пуст', operation, startTime);

        for (const up of updates) {
          await updateProductMinPrice(context.userId, up.product_id, up.min_price);
        }

        return createSuccessResult(
          `✅ **Массовая защита установлена!**\n\nВсего защищено товаров: **${updates.length}**.`,
          operation,
          startTime
        );
      }

      // ========================================
      // UPDATE_STOCKS - Update product stocks (FBS only)
      // ========================================
      case 'update_stocks': {
        // Validate details with Zod schema
        const validation = validateToolArgs(UpdateStocksDetailsSchema, details);
        if (!validation.success) {
          return {
            success: false,
            content: `❌ ${validation.error}`,
            category: 'confirmation',
            model: 'none',
            toolsUsed: [operation],
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
          };
        }

        const validatedDetails = validation.data as UpdateStocksDetails;
        const stockChanges = validatedDetails.stock_changes;
        const marketplace = validatedDetails.marketplace;

        let resultMessage = '';

        if (marketplace === 'WB') {
          if (!context.wbApiKey) {
            return {
              success: false,
              content: '❌ WB API ключ не настроен.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          // Get first FBS warehouse
          const warehousesResult = await getWbFbsWarehouses(context.wbApiKey);
          if (warehousesResult.warehouses.length === 0) {
            return {
              success: false,
              content:
                '❌ Нет FBS складов для обновления остатков. Убедитесь, что у вас есть свой склад.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          const warehouseId = warehousesResult.warehouses[0].id;
          const wbUpdates = stockChanges.map((sc: any) => ({
            sku: sc.sku || sc.product_id?.replace('wb-', '') || '',
            amount: sc.new_stock,
          }));

          const result = await updateWbStockFbs(context.wbApiKey, warehouseId, wbUpdates);

          if (result.success) {
            resultMessage = `✅ **Остатки обновлены на WB!**\n\n`;
            resultMessage += `📦 Обновлено товаров: **${result.count}**\n`;
            resultMessage += `🏭 Склад: ${warehousesResult.warehouses[0].name}`;
          } else {
            resultMessage = `❌ Ошибка обновления остатков WB: ${result.error}`;
          }
        } else if (marketplace === 'Ozon') {
          if (!context.ozonApiKey) {
            return {
              success: false,
              content: '❌ Ozon API ключ не настроен.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          const [clientId, apiKey] = context.ozonApiKey.split(':');
          if (!clientId || !apiKey) {
            return {
              success: false,
              content: '❌ Неверный формат Ozon API ключа.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          // Get first FBS warehouse
          const warehousesResult = await getOzonFbsWarehouses(clientId, apiKey);
          const warehouseId = warehousesResult.warehouses[0]?.id;

          const ozonUpdates = (stockChanges as any[]).map(sc => ({
            productId: parseInt((sc.product_id || '').replace('ozon-', '')),
            offerId: sc.offer_id || sc.product_id || '',
            stock: sc.new_stock,
            warehouseId,
          }));

          const result = await updateOzonStockFbs(clientId, apiKey, ozonUpdates);

          if (result.success) {
            resultMessage = `✅ **Остатки обновлены на Ozon!**\n\n`;
            resultMessage += `📦 Обновлено товаров: **${result.count}**`;
            if (warehousesResult.warehouses[0]) {
              resultMessage += `\n🏭 Склад: ${warehousesResult.warehouses[0].name}`;
            }
          } else {
            resultMessage = `❌ Ошибка обновления остатков Ozon: ${result.error}`;
          }
        } else {
          return {
            success: false,
            content: `❌ Неизвестный маркетплейс: ${marketplace}`,
            category: 'confirmation',
            model: 'none',
            toolsUsed: [operation],
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
          };
        }

        return createSuccessResult(resultMessage || '🏁 Операция завершена.', operation, startTime);
      }

      // ========================================
      // UNKNOWN OPERATION
      // ========================================
      default:
        return {
          success: false,
          content: `❌ Неизвестное действие: ${operation}`,
          category: 'confirmation',
          model: 'none',
          toolsUsed: [operation],
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        };
    }
  } catch (error) {
    console.error('❌ Confirmation execution error:', error);
    return createErrorResult(
      `Ошибка выполнения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      operation,
      startTime
    );
  }
}

/**
 * Helper to create error result
 */
function createErrorResult(
  message: string,
  operation: string,
  startTime: number
): OrchestratorResult {
  return {
    success: false,
    content: `❌ ${message}`,
    category: 'confirmation',
    model: 'none',
    toolsUsed: [operation],
    tokensUsed: 0,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Helper to create success result
 */
function createSuccessResult(
  message: string,
  operation: string,
  startTime: number
): OrchestratorResult {
  return {
    success: true,
    content: message,
    category: 'confirmation',
    model: 'none',
    toolsUsed: [operation],
    tokensUsed: 0,
    executionTimeMs: Date.now() - startTime,
  };
}

// ============================================
// EXPORTS
// ============================================

export { routeMessage, isConfirmation, isRejection };
