// ============================================
// NeuroGUARDIAN — Agent Orchestrator V4
// Two-phase pipeline: Planner → Executor → Answerer
// Version: 4.0.0 | Date: December 2024
// ============================================

import {
  PlanSchema,
  AnswerSchema,
  PLAN_JSON_SCHEMA,
  ANSWER_JSON_SCHEMA,
  validateAnswerLinks,
  sanitizeAnswerLinks,
  type Plan,
  type Answer,
  type ToolResult,
  type ToolName,
} from './schemas-v4.js';
import { buildPlannerPrompt, buildAnswererPrompt } from './prompts/system-v4.js';
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

// ============================================
// LLM PROVIDER CONFIG
// ============================================

interface LLMProvider {
  name: string;
  url: string;
  apiKey: string;
  model: string;
  supportsStructuredOutput: boolean;
}

function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // Primary: OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      supportsStructuredOutput: true,
    });
  }

  // Fallback: Groq
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.1-70b-versatile',
      supportsStructuredOutput: false, // Groq doesn't support json_schema
    });
  }

  return providers;
}

/**
 * Call LLM with retry and fallback logic
 */
async function callLLMWithFallback(
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonSchema?: unknown;
    preferredModel?: string;
  }
): Promise<{ content: string; tokensUsed: number; provider: string }> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No LLM providers configured. Set OPENAI_API_KEY or GROQ_API_KEY.');
  }

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (const provider of providers) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 Calling ${provider.name} (attempt ${attempt}/${maxRetries})...`);

        const body: Record<string, unknown> = {
          model: options.preferredModel || provider.model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1500,
        };

        // Add structured output only if provider supports it
        if (options.jsonSchema && provider.supportsStructuredOutput) {
          body.response_format = {
            type: 'json_schema',
            json_schema: options.jsonSchema,
          };
        } else if (options.jsonSchema) {
          // Fallback: add JSON instruction to system prompt
          const systemMsg = messages.find(m => m.role === 'system');
          if (systemMsg) {
            systemMsg.content += '\n\nОТВЕТЬ СТРОГО В ФОРМАТЕ JSON.';
          }
        }

        const response = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Rate limit - wait and retry
          if (response.status === 429) {
            const waitMs = attempt * 2000; // Exponential backoff
            console.warn(`⏳ Rate limited, waiting ${waitMs}ms...`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          throw new Error(`${provider.name} API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        const tokensUsed = data.usage?.total_tokens || 0;

        if (!content) {
          throw new Error('Empty response from LLM');
        }

        console.log(`✅ ${provider.name} responded (${tokensUsed} tokens)`);
        return { content, tokensUsed, provider: provider.name };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ ${provider.name} attempt ${attempt} failed:`, lastError.message);

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    console.warn(
      `❌ ${provider.name} failed after ${maxRetries} attempts, trying next provider...`
    );
  }

  throw lastError || new Error('All LLM providers failed');
}

// ============================================
// TYPES
// ============================================

export interface UserContext {
  userId: number;
  marketplace?: 'WB' | 'Ozon' | 'all';
  wbApiKey?: string;
  ozonApiKey?: string;
}

export interface OrchestratorV4Result {
  success: boolean;
  message: string;
  links?: Array<{ title: string; url: string; source: string }>;
  actions?: Array<{
    type: string;
    summary: string;
    details: Record<string, unknown>;
    affected_count: number;
  }>;
  data?: Record<string, unknown>;
  // Metrics
  planningTimeMs: number;
  executionTimeMs: number;
  answeringTimeMs: number;
  totalTimeMs: number;
  tokensUsed: number;
  toolsCalled: string[];
  // Debug
  plan?: Plan;
  toolResults?: ToolResult[];
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

/**
 * V4 Orchestrator: Two-phase pipeline
 *
 * Phase 1: Planner - Decides which tools to call
 * Phase 2: Executor - Runs tools deterministically
 * Phase 3: Answerer - Formats response from tool results
 */
export async function orchestrateV4(
  message: string,
  context: UserContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<OrchestratorV4Result> {
  const startTime = Date.now();
  let tokensUsed = 0;

  // Check for simple intents that don't need tools
  const simpleResponse = await handleSimpleIntent(message);
  if (simpleResponse) {
    return {
      success: true,
      message: simpleResponse,
      planningTimeMs: 0,
      executionTimeMs: 0,
      answeringTimeMs: Date.now() - startTime,
      totalTimeMs: Date.now() - startTime,
      tokensUsed: 0,
      toolsCalled: [],
    };
  }

  // ========================================
  // PHASE 1: PLANNING
  // ========================================
  const planStart = Date.now();
  console.log('🎯 V4 Phase 1: Planning...');

  const planResult = await callPlanner(message, context, conversationHistory);
  const planningTimeMs = Date.now() - planStart;
  tokensUsed += planResult.tokensUsed;

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      message: planResult.error || 'Не удалось составить план выполнения',
      planningTimeMs,
      executionTimeMs: 0,
      answeringTimeMs: 0,
      totalTimeMs: Date.now() - startTime,
      tokensUsed,
      toolsCalled: [],
    };
  }

  const plan = planResult.plan;
  console.log(`📋 Plan: ${plan.tools.length} tools, confirmation: ${plan.requires_confirmation}`);

  // ========================================
  // PHASE 2: EXECUTION
  // ========================================
  const execStart = Date.now();
  console.log('⚙️ V4 Phase 2: Executing tools...');

  const toolResults: ToolResult[] = [];
  const toolsCalled: string[] = [];

  for (const plannedTool of plan.tools) {
    console.log(`  🔧 Executing: ${plannedTool.tool}`);
    const result = await executeTool(plannedTool.tool, plannedTool.args, context.userId);

    // Extract URLs from result for link validation
    const urls = extractUrlsFromResult(result);

    toolResults.push({
      tool: plannedTool.tool,
      success: result.success,
      data: result.data,
      error: result.error,
      urls,
    });
    toolsCalled.push(plannedTool.tool);
  }

  const executionTimeMs = Date.now() - execStart;
  console.log(`✅ Executed ${toolResults.length} tools in ${executionTimeMs}ms`);

  // ========================================
  // PHASE 3: ANSWERING
  // ========================================
  const answerStart = Date.now();
  console.log('💬 V4 Phase 3: Generating answer...');

  const answerResult = await callAnswerer(message, toolResults, context);
  const answeringTimeMs = Date.now() - answerStart;
  tokensUsed += answerResult.tokensUsed;

  if (!answerResult.success || !answerResult.answer) {
    return {
      success: false,
      message: answerResult.error || 'Не удалось сформировать ответ',
      planningTimeMs,
      executionTimeMs,
      answeringTimeMs,
      totalTimeMs: Date.now() - startTime,
      tokensUsed,
      toolsCalled,
      plan,
      toolResults,
    };
  }

  // ========================================
  // PHASE 4: VALIDATION
  // ========================================
  console.log('🔍 V4 Phase 4: Validating answer...');

  // Validate and sanitize links
  const sanitizedAnswer = sanitizeAnswerLinks(answerResult.answer, toolResults);
  const linkValidation = validateAnswerLinks(answerResult.answer, toolResults);

  if (!linkValidation.valid) {
    console.warn(`⚠️ Removed ${linkValidation.invalidLinks.length} hallucinated links`);
  }

  const totalTimeMs = Date.now() - startTime;
  console.log(
    `✅ V4 Complete in ${totalTimeMs}ms (plan: ${planningTimeMs}ms, exec: ${executionTimeMs}ms, answer: ${answeringTimeMs}ms)`
  );

  // Parse data_json if present
  let parsedData: Record<string, unknown> | undefined;
  if (sanitizedAnswer.data_json) {
    try {
      parsedData = JSON.parse(sanitizedAnswer.data_json);
    } catch {
      console.warn('Failed to parse data_json');
    }
  }

  // Parse details_json in actions if present
  const parsedActions = sanitizedAnswer.actions?.map(action => ({
    type: action.type,
    summary: action.summary,
    details: action.details_json ? JSON.parse(action.details_json) : {},
    affected_count: action.affected_count,
  }));

  return {
    success: true,
    message: sanitizedAnswer.message,
    links: sanitizedAnswer.links,
    actions: parsedActions,
    data: parsedData,
    planningTimeMs,
    executionTimeMs,
    answeringTimeMs,
    totalTimeMs,
    tokensUsed,
    toolsCalled,
    plan,
    toolResults,
  };
}

// ============================================
// PHASE 1: PLANNER
// ============================================

async function callPlanner(
  message: string,
  context: UserContext,
  history?: Array<{ role: string; content: string }>
): Promise<{ success: boolean; plan?: Plan; error?: string; tokensUsed: number }> {
  const systemPrompt = buildPlannerPrompt({
    marketplace: context.marketplace,
    productsCount: 0, // Could be fetched
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history?.slice(-5) || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  try {
    const result = await callLLMWithFallback(messages, {
      temperature: 0.1, // Low randomness for consistency
      maxTokens: 500,
      jsonSchema: PLAN_JSON_SCHEMA,
      preferredModel: 'gpt-4o-mini', // Fast model for planning
    });

    const parsed = JSON.parse(result.content);
    const validated = PlanSchema.safeParse(parsed);

    if (!validated.success) {
      console.error('Plan validation failed:', validated.error);
      return { success: false, error: 'Invalid plan format', tokensUsed: result.tokensUsed };
    }

    return { success: true, plan: validated.data, tokensUsed: result.tokensUsed };
  } catch (error) {
    console.error('Planner error:', error);
    return { success: false, error: String(error), tokensUsed: 0 };
  }
}

// ============================================
// PHASE 2: TOOL EXECUTOR
// ============================================

async function executeTool(
  toolName: ToolName,
  args: Record<string, unknown>,
  userId: number
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (toolName) {
      case 'get_products':
        return await executeGetProducts(userId, args);
      case 'get_sales_stats':
        return await executeGetSalesStats(userId, args);
      case 'get_orders':
        return await executeGetOrders(userId, args);
      case 'get_warehouse_stocks':
        return await executeGetWarehouseStocks(userId, args);
      case 'calculate_unit_economics':
        return await executeCalculateUnitEconomics(userId, args);
      case 'get_abc_analysis':
        return await executeGetAbcAnalysis(userId, args);
      case 'get_stock_forecast':
        return await executeGetStockForecast(userId, args);
      case 'get_marketplace_info':
        return executeGetMarketplaceInfo(args);
      case 'search_web':
        return await executeSearchWeb(userId, args);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Extract all URLs from tool result for link validation
 */
function extractUrlsFromResult(result: { success: boolean; data?: unknown }): string[] {
  const urls: string[] = [];

  if (!result.success || !result.data) {
    return urls;
  }

  const data = result.data as Record<string, unknown>;

  // Extract from search_web results
  if (data.results && Array.isArray(data.results)) {
    for (const r of data.results) {
      if (typeof r === 'object' && r !== null && 'link' in r && typeof r.link === 'string') {
        urls.push(r.link);
      }
    }
  }

  // Extract any other URL fields
  const extractUrls = (obj: unknown): void => {
    if (typeof obj === 'string' && obj.match(/^https?:\/\//)) {
      urls.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(extractUrls);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(extractUrls);
    }
  };

  extractUrls(data);

  return [...new Set(urls)]; // Deduplicate
}

// ============================================
// PHASE 3: ANSWERER
// ============================================

async function callAnswerer(
  originalMessage: string,
  toolResults: ToolResult[],
  _context: UserContext
): Promise<{ success: boolean; answer?: Answer; error?: string; tokensUsed: number }> {
  const systemPrompt = buildAnswererPrompt();

  // Build context message with tool results
  const toolResultsSummary = toolResults.map(tr => ({
    tool: tr.tool,
    success: tr.success,
    data: tr.data,
    error: tr.error,
    available_urls: tr.urls,
  }));

  const userMessage = `Пользователь спросил: "${originalMessage}"

Результаты выполнения инструментов:
${JSON.stringify(toolResultsSummary, null, 2)}

Сформируй ответ, используя ТОЛЬКО эти данные. Ссылки бери ТОЛЬКО из available_urls.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    const result = await callLLMWithFallback(messages, {
      temperature: 0.3,
      maxTokens: 1500,
      jsonSchema: ANSWER_JSON_SCHEMA,
      preferredModel: 'gpt-4o', // Better model for final answer
    });

    const parsed = JSON.parse(result.content);
    const validated = AnswerSchema.safeParse(parsed);

    if (!validated.success) {
      console.error('Answer validation failed:', validated.error);
      // Try to salvage - use message if present
      if (parsed.message) {
        return {
          success: true,
          answer: { message: parsed.message },
          tokensUsed: result.tokensUsed,
        };
      }
      return { success: false, error: 'Invalid answer format', tokensUsed: result.tokensUsed };
    }

    return { success: true, answer: validated.data, tokensUsed: result.tokensUsed };
  } catch (error) {
    console.error('Answerer error:', error);
    return { success: false, error: String(error), tokensUsed: 0 };
  }
}

// ============================================
// SIMPLE INTENT HANDLER
// ============================================

const SIMPLE_INTENTS: Record<string, string> = {
  привет: 'Привет! 👋 Я — AI-ассистент для управления ценами на маркетплейсах. Чем могу помочь?',
  здравствуй: 'Здравствуйте! 👋 Готов помочь с анализом продаж и управлением ценами.',
  спасибо: 'Пожалуйста! Если возникнут вопросы — обращайтесь. 😊',
  пока: 'До свидания! Удачных продаж! 🚀',
  помощь:
    'Я могу помочь с:\n\n📊 **Аналитика** — статистика продаж, ABC-анализ\n💰 **Цены** — изменение цен, защита от демпинга\n📦 **Остатки** — прогноз, складские остатки\n🔍 **Конкуренты** — поиск и анализ\n\nПросто напишите, что вас интересует!',
};

async function handleSimpleIntent(message: string): Promise<string | null> {
  const normalized = message.toLowerCase().trim();

  // Only match if message is short (simple greeting) - max 25 chars
  // This prevents matching "привет давай выровняем цены..." as simple intent
  if (normalized.length > 25) {
    return null;
  }

  for (const [trigger, response] of Object.entries(SIMPLE_INTENTS)) {
    if (
      normalized === trigger ||
      normalized.startsWith(trigger + '!') ||
      normalized === trigger + '.'
    ) {
      return response;
    }
  }

  return null;
}

// ============================================
// EXPORTS
// ============================================

export { PlanSchema, AnswerSchema } from './schemas-v4.js';
