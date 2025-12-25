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
  type UpdatePricesDetails,
  type UpdateStocksDetails,
  type SetStopLossDetails,
  type BulkProtectDetails,
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
    const fnArgs = JSON.parse(toolCall.function.arguments);

    // Check for actions requiring confirmation
    if (
      ['update_prices', 'set_stop_loss', 'bulk_protect_products', 'update_stocks'].includes(fnName)
    ) {
      return handleConfirmableAction(fnName, fnArgs, userId, toolNames, tokensUsed);
    }

    // Execute read-only tool
    const result = await executeTool(fnName, fnArgs, userId);

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
  _userId: number, // Reserved for future use
  toolNames: string[],
  tokensUsed: number
): Promise<{
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired: OrchestratorResult['actionRequired'];
}> {
  const taskId = randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  let confirmationMessage = '';
  const details: Record<string, unknown> = { ...args };

  switch (toolName) {
    case 'update_prices':
      confirmationMessage = `Изменить цены на указанные товары?`;
      break;
    case 'set_stop_loss':
      confirmationMessage = `Установить Stop-Loss ${args.min_price || args.percentage + '%'} для товара?`;
      break;
    case 'bulk_protect_products':
      confirmationMessage = `Установить защиту -${args.percentage || 15}% для всех товаров?`;
      break;
    case 'update_stocks':
      confirmationMessage = `Изменить остатки для указанных товаров?`;
      break;
    default:
      confirmationMessage = `Выполнить действие ${toolName}?`;
  }

  // Build preview content
  let content = `📊 **Требуется подтверждение**\n\n`;
  content += `${confirmationMessage}\n\n`;
  content += `⚠️ Это действие изменит данные на маркетплейсе.\n\n`;
  content += `🚀 Отправьте **"да"** для подтверждения или **"нет"** для отмены.`;

  return {
    success: true,
    content,
    toolsUsed: toolNames,
    tokensUsed,
    actionRequired: {
      operation: toolName,
      taskId,
      confirmationMessage,
      details,
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
        // Validate details with Zod schema
        const validation = validateToolArgs(UpdatePricesDetailsSchema, details);
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

        const validatedDetails = validation.data as UpdatePricesDetails;
        const priceChanges = validatedDetails.price_changes;
        const marketplace = validatedDetails.marketplace || 'WB';

        let resultMessage = '';

        if (marketplace === 'WB') {
          if (!context.wbApiKey) {
            return {
              success: false,
              content: '❌ WB API ключ не настроен. Добавьте его в настройках.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          // Format for WB: { nmId, price }
          const wbUpdates = priceChanges.map(pc => ({
            nmId: pc.nm_id || parseInt((pc.product_id || '').replace('wb-', '')),
            price: pc.newPrice,
          }));

          const result = await updateWbPrices(context.wbApiKey, wbUpdates);

          if (result.success) {
            resultMessage = `✅ **Цены обновлены на Wildberries!**\n\n`;
            resultMessage += `📦 Обновлено товаров: **${result.count}**\n`;
            if (result.taskId) {
              resultMessage += `📋 ID задачи: ${result.taskId}\n`;
              resultMessage += `\n⏳ Новые цены появятся в течение 1-5 минут.`;
            }
          } else {
            resultMessage = `❌ Ошибка обновления цен WB: ${result.error}`;
          }
        } else if (marketplace === 'Ozon') {
          if (!context.ozonApiKey) {
            return {
              success: false,
              content: '❌ Ozon API ключ не настроен. Добавьте его в настройках.',
              category: 'confirmation',
              model: 'none',
              toolsUsed: [operation],
              tokensUsed: 0,
              executionTimeMs: Date.now() - startTime,
            };
          }

          // Parse clientId:apiKey format
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

          // Format for Ozon: { productId, price }
          const ozonUpdates = priceChanges.map(pc => ({
            productId: parseInt((pc.product_id || '').replace('ozon-', '')),
            price: pc.newPrice,
          }));

          const result = await updateOzonPrices(clientId, apiKey, ozonUpdates);

          if (result.success) {
            resultMessage = `✅ **Цены обновлены на Ozon!**\n\n`;
            resultMessage += `📦 Обновлено товаров: **${result.count}**\n`;
            if (result.partialErrors && result.partialErrors.length > 0) {
              resultMessage += `\n⚠️ Предупреждения:\n`;
              result.partialErrors.forEach(e => {
                resultMessage += `- ${e}\n`;
              });
            }
          } else {
            resultMessage = `❌ Ошибка обновления цен Ozon: ${result.error}`;
          }
        }

        return {
          success: true,
          content: resultMessage,
          category: 'confirmation',
          model: 'none',
          toolsUsed: [operation],
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // ========================================
      // SET_STOP_LOSS - Protect single product
      // ========================================
      case 'set_stop_loss': {
        // Validate details with Zod schema
        const validation = validateToolArgs(SetStopLossDetailsSchema, details);
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

        const validatedDetails = validation.data as SetStopLossDetails;
        const productId = validatedDetails.product_id;
        const minPrice = validatedDetails.min_price;

        // Find product in database
        const products = await getProductsByUserId(context.userId);
        const product = products.find(
          p => p.product_id === productId || p.title.toLowerCase().includes(productId.toLowerCase())
        );

        if (!product) {
          return {
            success: false,
            content: `❌ Товар "${productId}" не найден.`,
            category: 'confirmation',
            model: 'none',
            toolsUsed: [operation],
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
          };
        }

        await updateProductMinPrice(context.userId, product.product_id, minPrice);

        const resultMessage =
          `✅ **Защита установлена!**\n\n` +
          `📦 Товар: **${product.title.substring(0, 40)}**\n` +
          `💰 Текущая цена: ${product.current_price}₽\n` +
          `🛡️ Минимальная цена: **${minPrice}₽**\n\n` +
          `Если цена упадёт ниже ${minPrice}₽, сработает автоматическая защита.`;

        return {
          success: true,
          content: resultMessage,
          category: 'confirmation',
          model: 'none',
          toolsUsed: [operation],
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // ========================================
      // BULK_PROTECT_PRODUCTS - Mass protection
      // ========================================
      case 'bulk_protect_products': {
        // Validate details with Zod schema (percentage is required, products optional)
        const validation = validateToolArgs(BulkProtectDetailsSchema, details);
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

        const validatedDetails = validation.data as BulkProtectDetails;
        const productsToProtect = validatedDetails.products;
        const percentage = validatedDetails.percentage;

        if (!productsToProtect || productsToProtect.length === 0) {
          // If no specific products, protect all with percentage
          const allProducts = await getProductsByUserId(context.userId);
          const discount = percentage || 15;

          let protectedCount = 0;
          for (const product of allProducts) {
            if (product.current_price > 0) {
              const minPrice = Math.round(product.current_price * (1 - discount / 100));
              await updateProductMinPrice(context.userId, product.product_id, minPrice);
              protectedCount++;
            }
          }

          return {
            success: true,
            content:
              `✅ **Массовая защита установлена!**\n\n` +
              `🛡️ Защищено товаров: **${protectedCount}**\n` +
              `📉 Порог: **-${discount}%** от текущей цены\n\n` +
              `Sentinel будет следить за ценами 24/7.`,
            category: 'confirmation',
            model: 'none',
            toolsUsed: [operation],
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Protect specific products
        let protectedCount = 0;
        for (const item of productsToProtect) {
          const products = await getProductsByUserId(context.userId);
          const product = products.find(p => p.product_id === item.product_id);
          if (product) {
            await updateProductMinPrice(context.userId, product.product_id, item.min_price);
            protectedCount++;
          }
        }

        return {
          success: true,
          content:
            `✅ **Защита установлена!**\n\n` +
            `🛡️ Защищено товаров: **${protectedCount}/${productsToProtect.length}**`,
          category: 'confirmation',
          model: 'none',
          toolsUsed: [operation],
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        };
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
          const wbUpdates = stockChanges.map(sc => ({
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

          const ozonUpdates = stockChanges.map(sc => ({
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

        return {
          success: true,
          content: resultMessage,
          category: 'confirmation',
          model: 'none',
          toolsUsed: [operation],
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        };
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
    return {
      success: false,
      content: `❌ Ошибка выполнения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      category: 'confirmation',
      model: 'none',
      toolsUsed: [operation],
      tokensUsed: 0,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export { routeMessage, isConfirmation, isRejection };
