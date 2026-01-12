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
import { buildPlannerPrompt, buildAnswererPrompt } from './prompts/system-v5.js';
import { toolRegistry, registerAllTools } from '../../agent/execution/index.js';

// Initialize tools
registerAllTools();
// ============================================
// LLM PROVIDER CONFIG
// ============================================

interface LLMProvider {
  name: string;
  url: string;
  apiKey: string;
  model: string;
  supportsStructuredOutput: boolean; // json_schema support
  supportsJsonMode: boolean; // response_format: { type: 'json_object' }
}

import { logger, getSecret } from '../lib/index.js';

async function getAvailableProviders(): Promise<LLMProvider[]> {
  const providers: LLMProvider[] = [];

  // Fetch keys via Security Agent helper OR env (critical for tests)
  const openaiKey =
    (await getSecret('openai_api_key', 'llm_inference')) || process.env.OPENAI_API_KEY;
  const groqKey = (await getSecret('groq_api_key', 'llm_inference')) || process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // PRIORITY 0: Ollama FIRST when USE_OLLAMA=true (skip cloud API delays for local testing)
  if (process.env.USE_OLLAMA === 'true' || process.env.OLLAMA_MODEL) {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'mistral-nemo:latest';

    providers.push({
      name: 'Ollama',
      url: `${ollamaUrl}/v1/chat/completions`,
      apiKey: 'ollama', // Ollama doesn't need real API key
      model: ollamaModel,
      supportsStructuredOutput: false,
      supportsJsonMode: true,
    });

    console.log(`[Orchestrator] Using Ollama FIRST: ${ollamaModel} at ${ollamaUrl}`);
  }

  // PRIORITY 1: OpenRouter (Works from Russia, no VPN needed!)
  if (openrouterKey && process.env.USE_OLLAMA !== 'true') {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free',
      supportsStructuredOutput: false,
      supportsJsonMode: true,
    });
    console.log('[Orchestrator] Using OpenRouter (works from Russia)');
  }

  // PRIORITY 1: OpenAI (More stable, better reasoning)
  if (openaiKey) {
    providers.push({
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: openaiKey,
      model: 'gpt-4o-mini',
      supportsStructuredOutput: true,
      supportsJsonMode: true,
    });
  }

  // PRIORITY 2: Groq (Fast, but sometimes 403s)
  if (groqKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      model: 'llama-3.1-70b-versatile',
      supportsStructuredOutput: false,
      supportsJsonMode: true,
    });
  }

  // Fallback to local LLM if no cloud providers configured
  if (providers.length === 0) {
    const localLLMUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1';
    console.log('[Orchestrator] No cloud LLM providers configured, using local LLM:', localLLMUrl);
    providers.push({
      name: 'LocalLLM',
      url: `${localLLMUrl}/chat/completions`,
      apiKey: 'not-needed', // vLLM doesn't require API key
      model: 'mistralai/Mistral-Nemo-Instruct-2407',
      supportsStructuredOutput: false, // Local model doesn't support json_schema
      supportsJsonMode: false, // Local model may not support json_object mode
    });
  }

  console.log(
    '[Orchestrator] Providers found:',
    providers.map(p => p.name)
  );
  return providers;
}

/**
 * Call LLM with retry and fallback logic
 */
export async function callLLMWithFallback(
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonSchema?: unknown;
    preferredModel?: string;
  }
): Promise<{ content: string; tokensUsed: number; provider: string }> {
  const providers = await getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No LLM providers configured. Set OPENAI_API_KEY or GROQ_API_KEY.');
  }

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (const provider of providers) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Calling LLM provider', { provider: provider.name, attempt, maxRetries });

        const body: Record<string, unknown> = {
          model: options.preferredModel || provider.model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1500,
        };

        // Structured output strategy
        if (options.jsonSchema && provider.supportsStructuredOutput) {
          body.response_format = {
            type: 'json_schema',
            json_schema: options.jsonSchema,
          };
        } else if (options.jsonSchema && provider.supportsJsonMode) {
          body.response_format = { type: 'json_object' };
          // Add explicit JSON instruction to system prompt for non-structured providers
          const systemMsg = messages.find(m => m.role === 'system');
          if (systemMsg) {
            systemMsg.content +=
              '\n\nIMPORTANT: You must respond with a valid JSON object matching the requested schema. Do not include any other text or explanation.';
          }
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
          console.error(`[Orchestrator] ${provider.name} error: ${response.status}`, errorText);

          // Rate limit - wait and retry
          if (response.status === 429) {
            const waitMs = attempt * 2000; // Exponential backoff
            logger.warn('Rate limited, waiting', { waitMs });
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          throw new Error(`${provider.name} API error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
          usage?: { total_tokens: number };
        };
        const content = data.choices[0]?.message?.content;
        const tokensUsed = data.usage?.total_tokens || 0;

        // DEBUG: Write to file
        try {
          const fs = await import('fs');
          const path = await import('path');
          const logMsg = `\n[${new Date().toISOString()}] ${provider.name} (${body.model})\nRequest: ${JSON.stringify(messages.slice(-1))}\nResponse: ${content}\n---\n`;
          fs.appendFileSync(path.join(process.cwd(), 'llm_debug.log'), logMsg);
        } catch {
          // Ignore debug log write errors
        }

        if (!content) {
          throw new Error('Empty response from LLM');
        }

        logger.info('LLM provider responded', { provider: provider.name, tokensUsed });
        return { content, tokensUsed, provider: provider.name };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('LLM provider attempt failed', {
          provider: provider.name,
          attempt,
          error: lastError.message,
        });

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    logger.warn('LLM provider failed after retries, trying next', {
      provider: provider.name,
      maxRetries,
    });
  }

  throw lastError || new Error('All LLM providers failed');
}

// ============================================
// TYPES
// ============================================

export interface UserContext {
  userId: number;
  userName?: string; // Имя пользователя из Telegram
  marketplace?: 'WB' | 'Ozon' | 'all';
  wbApiKey?: string;
  ozonApiKey?: string;
  onboardingMode?: boolean;
  isFirstContact?: boolean; // Первое сообщение пользователя
  productsCount?: number; // Количество синхронизированных товаров
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

  console.log('[Orchestrator V4] Starting with message:', message.substring(0, 50));

  // Check for simple intents that don't need tools
  console.log('[Orchestrator V4] Checking for simple intent...');
  const simpleResponse = await handleSimpleIntent(message, context);

  // Safely check if simpleResponse is a string (legacy) or an object (future)
  if (simpleResponse && (typeof simpleResponse === 'string' || (simpleResponse as any).success)) {
    console.log('[Orchestrator V4] Simple intent matched, returning personalized response');
    const msg =
      typeof simpleResponse === 'string'
        ? simpleResponse
        : (simpleResponse as any).message || 'Hello';
    return createSimpleResult(msg, startTime);
  }
  console.log('[Orchestrator V4] No simple intent match, proceeding to planning phase');

  // ========================================
  // PHASE 1: PLANNING
  // ========================================
  const planStart = Date.now();
  logger.info('V4 Phase 1: Planning');
  console.log('[Orchestrator V4] Phase 1: Planning started');

  const planResult = await callPlanner(message, context, conversationHistory);
  const planningTimeMs = Date.now() - planStart;
  tokensUsed += planResult.tokensUsed;

  if (!planResult.success || !planResult.plan) {
    return createErrorResult(
      planResult.error || 'Не удалось составить план выполнения',
      startTime,
      planningTimeMs,
      tokensUsed
    );
  }

  const plan = planResult.plan;
  logger.info('Plan created', {
    toolsCount: plan.tools.length,
    requiresConfirmation: plan.requires_confirmation,
  });

  // ========================================
  // PHASE 2: EXECUTION
  // ========================================
  const execStart = Date.now();
  logger.info('V4 Phase 2: Executing tools');

  const { toolResults, toolsCalled } = await executePlanSteps(plan, context);
  const executionTimeMs = Date.now() - execStart;

  // ========================================
  // PHASE 3: ANSWERING
  // ========================================
  const answerStart = Date.now();
  logger.info('V4 Phase 3: Generating answer');

  const answerResult = await callAnswerer(message, toolResults, context, conversationHistory);
  const answeringTimeMs = Date.now() - answerStart;
  tokensUsed += answerResult.tokensUsed;

  if (!answerResult.success || !answerResult.answer) {
    return createAnswerErrorResult(
      answerResult.error,
      startTime,
      planningTimeMs,
      executionTimeMs,
      answeringTimeMs,
      tokensUsed,
      toolsCalled,
      plan,
      toolResults
    );
  }

  // ========================================
  // PHASE 4: VALIDATION & FORMATTING
  // ========================================
  return processAndValidateAnswer(answerResult.answer, toolResults, {
    planningTimeMs,
    executionTimeMs,
    answeringTimeMs,
    tokensUsed,
    toolsCalled,
    plan,
    startTime,
  });
}

/**
 * Execute all steps defined in the plan
 */
async function executePlanSteps(
  plan: Plan,
  context: UserContext
): Promise<{ toolResults: ToolResult[]; toolsCalled: string[] }> {
  logger.info('V4 Phase 2: Executing tools in parallel', { count: plan.tools.length });

  const executionPromises = plan.tools.map(async plannedTool => {
    try {
      logger.debug(`Starting tool: ${plannedTool.tool}`);
      const result = await executeTool(plannedTool.tool, plannedTool.args, context.userId);

      // Extract URLs from result for link validation
      const urls = extractUrlsFromResult(result);

      return {
        tool: plannedTool.tool,
        success: result.success,
        data: result.data,
        error: result.error,
        urls,
      };
    } catch (error) {
      logger.error(`Fatal tool execution error: ${plannedTool.tool}`, error);
      return {
        tool: plannedTool.tool,
        success: false,
        error: String(error),
        urls: [],
      };
    }
  });

  const toolResults = await Promise.all(executionPromises);
  const toolsCalled = plan.tools.map(t => t.tool);

  return { toolResults, toolsCalled };
}

/**
 * Process, sanitize and validate the final answer
 */
function processAndValidateAnswer(
  answer: Answer,
  toolResults: ToolResult[],
  metrics: {
    planningTimeMs: number;
    executionTimeMs: number;
    answeringTimeMs: number;
    tokensUsed: number;
    toolsCalled: string[];
    plan: Plan;
    startTime: number;
  }
): OrchestratorV4Result {
  logger.info('V4 Phase 4: Validating answer');

  // Validate and sanitize links
  const sanitizedAnswer = sanitizeAnswerLinks(answer, toolResults);
  const linkValidation = validateAnswerLinks(answer, toolResults);

  if (!linkValidation.valid) {
    logger.warn('Removed hallucinated links', { count: linkValidation.invalidLinks.length });
  }

  const totalTimeMs = Date.now() - metrics.startTime;

  // Parse data_json if present
  let parsedData: Record<string, unknown> | undefined;
  if (sanitizedAnswer.data_json) {
    try {
      parsedData = JSON.parse(sanitizedAnswer.data_json);
    } catch {
      logger.warn('Failed to parse data_json');
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
    planningTimeMs: metrics.planningTimeMs,
    executionTimeMs: metrics.executionTimeMs,
    answeringTimeMs: metrics.answeringTimeMs,
    totalTimeMs,
    tokensUsed: metrics.tokensUsed,
    toolsCalled: metrics.toolsCalled,
    plan: metrics.plan,
    toolResults,
  };
}

// Helper functions for common result structures

function createSimpleResult(message: string, startTime: number): OrchestratorV4Result {
  const duration = Date.now() - startTime;
  return {
    success: true,
    message,
    planningTimeMs: 0,
    executionTimeMs: 0,
    answeringTimeMs: duration,
    totalTimeMs: duration,
    tokensUsed: 0,
    toolsCalled: [],
  };
}

function createErrorResult(
  error: string,
  startTime: number,
  planningTimeMs: number,
  tokensUsed: number
): OrchestratorV4Result {
  return {
    success: false,
    message: error,
    planningTimeMs,
    executionTimeMs: 0,
    answeringTimeMs: 0,
    totalTimeMs: Date.now() - startTime,
    tokensUsed,
    toolsCalled: [],
  };
}

function createAnswerErrorResult(
  error: string | undefined,
  startTime: number,
  planningTimeMs: number,
  executionTimeMs: number,
  answeringTimeMs: number,
  tokensUsed: number,
  toolsCalled: string[],
  plan: Plan,
  toolResults: ToolResult[]
): OrchestratorV4Result {
  return {
    success: false,
    message: error || 'Не удалось сформировать ответ',
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
    productsCount: context.productsCount || 0,
    onboardingMode: context.onboardingMode,
    userName: context.userName,
    isFirstContact: context.isFirstContact,
    hasSyncedProducts: (context.productsCount || 0) > 0,
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
    });

    // Safe JSON parse with fallback
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch (jsonError) {
      logger.error('Plan JSON parse error', jsonError, {
        contentPreview: result.content.substring(0, 200),
      });
      // Try to extract a direct answer if JSON is broken
      return {
        success: false,
        error: 'Не удалось разобрать ответ. Попробуйте перефразировать запрос.',
        tokensUsed: result.tokensUsed,
      };
    }

    const validated = PlanSchema.safeParse(parsed);

    if (!validated.success) {
      logger.error('Plan validation failed', validated.error);
      return { success: false, error: 'Некорректный формат плана', tokensUsed: result.tokensUsed };
    }

    return { success: true, plan: validated.data, tokensUsed: result.tokensUsed };
  } catch (error) {
    logger.error('Planner error', error);
    return { success: false, error: 'Ошибка планирования. Попробуйте ещё раз.', tokensUsed: 0 };
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
    return await toolRegistry.execute(toolName, userId, args);
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
  context: UserContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ success: boolean; answer?: Answer; error?: string; tokensUsed: number }> {
  const systemPrompt = buildAnswererPrompt(context.onboardingMode);

  // Build context message with tool results
  const toolResultsSummary = toolResults.map(tr => ({
    tool: tr.tool,
    success: tr.success,
    data: tr.data,
    error: tr.error,
    available_urls: tr.urls,
  }));

  // Include last 3 messages for context (if available)
  const recentHistory = conversationHistory?.slice(-6) || []; // Last 3 exchanges (user + assistant)
  const historyContext =
    recentHistory.length > 0
      ? `\n\nПредыдущий контекст беседы:\n${recentHistory.map(h => `${h.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${h.content}`).join('\n')}`
      : '';

  const userMessage = `Пользователь спросил: "${originalMessage}"${historyContext}

Результаты выполнения инструментов:
${JSON.stringify(toolResultsSummary, null, 2)}

Сформируй ответ, используя ТОЛЬКО эти данные. Ссылки бери ТОЛЬКО из available_urls.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    // OPTIMIZATION: Choose model based on complexity
    // Use gpt-4o-mini for simple queries (faster, cheaper)
    // Use gpt-4o for complex queries requiring synthesis
    const hasSearchWeb = toolResults.some(tr => tr.tool === 'search_web');
    const hasComplexAnalytics = toolResults.some(tr =>
      ['get_abc_analysis', 'calculate_unit_economics', 'get_stock_forecast'].includes(tr.tool)
    );

    // Detect complex scenarios for potential future model switching
    // (hasMultipleTools = toolResults.length > 2 - currently unused)
    // Use gpt-4o for:
    // - Web search results (need to synthesize external data)
    // - Complex analytics (need to explain nuanced business insights)
    // Detect complex scenarios for potential future model switching
    // const useAdvancedModel = hasSearchWeb || hasComplexAnalytics || hasMultipleTools;

    // Log model selection for debugging
    logger.info('Answerer phase starting', {
      hasSearchWeb,
      hasComplexAnalytics,
      toolsCount: toolResults.length,
    });

    // Use default provider model (OpenRouter → Groq → OpenAI fallback)
    const result = await callLLMWithFallback(messages, {
      temperature: 0.3,
      maxTokens: 1500,
      jsonSchema: ANSWER_JSON_SCHEMA,
    });

    // Safe JSON parse with fallback
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch (jsonError) {
      logger.error('Answer JSON parse error', jsonError, {
        contentPreview: result.content.substring(0, 200),
      });
      // If JSON is broken, try to use the content as-is (it might be plain text)
      const plainTextContent = result.content.replace(/^[{[].*$/gm, '').trim();
      if (plainTextContent.length > 20) {
        return {
          success: true,
          answer: { message: plainTextContent },
          tokensUsed: result.tokensUsed,
        };
      }
      return {
        success: false,
        error: 'Не удалось получить ответ. Попробуйте ещё раз.',
        tokensUsed: result.tokensUsed,
      };
    }

    const validated = AnswerSchema.safeParse(parsed);

    if (!validated.success) {
      logger.error('Answer validation failed', validated.error);
      // Try to salvage - use message if present
      if (parsed.message) {
        return {
          success: true,
          answer: { message: parsed.message },
          tokensUsed: result.tokensUsed,
        };
      }
      return { success: false, error: 'Некорректный формат ответа', tokensUsed: result.tokensUsed };
    }

    return { success: true, answer: validated.data, tokensUsed: result.tokensUsed };
  } catch (error) {
    logger.error('Answerer error', error);
    return { success: false, error: 'Ошибка генерации ответа. Попробуйте ещё раз.', tokensUsed: 0 };
  }
}

// ============================================
// SIMPLE INTENT HANDLER (with personalization)
// ============================================

import { generateWelcomeMessage } from './prompts/system-v5.js';

/**
 * Обрабатывает простые намерения с персонализацией
 * @param message - сообщение пользователя
 * @param context - контекст с именем и статусом
 */
async function handleSimpleIntent(message: string, context?: UserContext): Promise<string | null> {
  const normalized = message.toLowerCase().trim();
  const userName = context?.userName || 'друг';
  const hasKeys = !context?.onboardingMode;
  const productsCount = context?.productsCount || 0;

  // Только матчим короткие сообщения (простые приветствия) — макс 30 символов
  if (normalized.length > 30) {
    return null;
  }

  // Приветствия — персонализированный ответ с вступлением в роль
  const greetings = [
    'привет',
    'здравствуй',
    'здравствуйте',
    'хай',
    'hi',
    'hello',
    'добрый день',
    'доброе утро',
    'добрый вечер',
  ];

  for (const greeting of greetings) {
    if (
      normalized === greeting ||
      normalized.startsWith(greeting + '!') ||
      normalized.startsWith(greeting + ',') ||
      normalized.startsWith(greeting + ' ')
    ) {
      // Первый контакт или повторный — всегда вступаем в роль
      return generateWelcomeMessage(userName, hasKeys, productsCount);
    }
  }

  // Благодарность — проверяем ПЕРЕД aboutPhrases, чтобы "Спасибо за помощь" не матчилось на "помощь"
  if (normalized.includes('спасибо') || normalized.includes('благодарю')) {
    return `Всегда пожалуйста, ${userName}! 😊 Есть ещё вопросы — обращайтесь, я на связи 24/7.`;
  }

  // "Что ты умеешь" / "расскажи о себе"
  const aboutPhrases = [
    'что ты умеешь',
    'что умеешь',
    'расскажи о себе',
    'кто ты',
    'помощь',
    'помоги',
  ];

  for (const phrase of aboutPhrases) {
    if (normalized.includes(phrase)) {
      return `${userName}, я — Виктор, ваш управляющий магазином на WB и Ozon! 🎯

**Мои обязанности:**
📊 Анализирую продажи и ABC-разбивку товаров
💰 Считаю реальную прибыль с учётом ВСЕХ комиссий  
🛡️ Защищаю цены от принудительных скидок
⚠️ Предупреждаю когда товар заканчивается
🔍 Мониторю конкурентов и даю рекомендации

${hasKeys ? 'Скажите что проверить — я приступлю!' : 'Но сначала нужно подключить доступ к магазину.'}`;
    }
  }

  // Прощание
  if (normalized === 'пока' || normalized === 'до свидания' || normalized.startsWith('пока ')) {
    return `До свидания, ${userName}! Удачных продаж! 🚀 Я продолжаю следить за магазином.`;
  }

  return null;
}

// ============================================
// EXPORTS
// ============================================

export { PlanSchema, AnswerSchema } from './schemas-v4.js';
