// ============================================
// NeuroGUARDIAN — Hybrid MoE Router
// Production-ready intent classification with fallback
// Version: 2.0.0 | Date: December 2024
// ============================================

import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { logger } from '../lib/logger.js';

// ============================================
// CONFIGURATION
// ============================================

const MOE_CONFIG = {
  // Таймауты
  LOCAL_LLM_TIMEOUT: 30000, // 30s для холодного старта
  CLOUD_LLM_TIMEOUT: 60000, // 60s для облака

  // Retries
  MAX_RETRIES: 2,

  // Модели
  LOCAL_MODEL: 'Qwen/Qwen2.5-1.5B-Instruct',
  CLOUD_MODEL: 'gemini-1.5-flash',
} as const;

// ============================================
// TYPES
// ============================================

export type IntentType = 'STATS' | 'CHAT' | 'COMPLEX' | 'UNKNOWN';
export type RouteTarget = 'local_stats' | 'local_chat' | 'cloud_complex';

export interface ClassificationResult {
  intent: IntentType;
  confidence: number;
  reasoning?: string;
}

export interface MoERouterResult {
  messages: BaseMessage[];
  intent: IntentType;
  confidence: number;
  routeTo: RouteTarget;
  classifiedBy: 'local' | 'cloud' | 'fallback_rules';
  latencyMs: number;
}

// ============================================
// STATE DEFINITION
// ============================================

export const MoEState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  intent: Annotation<IntentType>(),
  confidence: Annotation<number>(),
  routeTo: Annotation<RouteTarget>(),
  classifiedBy: Annotation<'local' | 'cloud' | 'fallback_rules'>(),
  latencyMs: Annotation<number>(),
});

// ============================================
// LLM CLIENTS
// ============================================

let localLLMClient: ChatOpenAI | null = null;
let cloudLLMClient: ChatOpenAI | null = null;

function getLocalLLMClient(): ChatOpenAI {
  if (!localLLMClient) {
    const baseURL = process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1';
    localLLMClient = new ChatOpenAI({
      modelName: MOE_CONFIG.LOCAL_MODEL,
      temperature: 0,
      timeout: MOE_CONFIG.LOCAL_LLM_TIMEOUT,
      maxRetries: 1,
      configuration: {
        baseURL,
        apiKey: 'not-needed',
      },
    });
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[MoE] Local LLM client initialized', { baseURL });
    }
  }
  return localLLMClient;
}

function getCloudLLMClient(): ChatOpenAI {
  if (!cloudLLMClient) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('[MoE] No cloud LLM API key configured');
    }

    // Use OpenAI-compatible endpoint (AgentRouter / OpenRouter / direct)
    const baseURL =
      process.env.AGENTROUTER_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';

    cloudLLMClient = new ChatOpenAI({
      modelName: MOE_CONFIG.CLOUD_MODEL,
      temperature: 0,
      timeout: MOE_CONFIG.CLOUD_LLM_TIMEOUT,
      maxRetries: 2,
      configuration: {
        baseURL,
        apiKey,
      },
    });
    logger.info('[MoE] Cloud LLM client initialized');
  }
  return cloudLLMClient;
}

// ============================================
// CLASSIFICATION PROMPT
// ============================================

const CLASSIFICATION_PROMPT = `You are an intent classifier for NeuroGUARDIAN marketplace management system.
Analyze the user query and classify it into ONE of these categories:

CATEGORIES:
- STATS: Price checks, stock queries, specific product lookups, simple data retrieval
  Examples: "какая цена на артикул 123", "check WB prices", "сколько на складе", "покажи остатки"
  
- CHAT: Greetings, help requests, simple questions about system capabilities
  Examples: "привет", "что ты умеешь", "hello", "help", "кто ты"
  
- COMPLEX: Market analysis, strategy advice, bulk operations, ABC analysis, profitability reports
  Examples: "сделай анализ прибыльности", "какую стратегию выбрать", "проанализируй конкурентов"

RULES:
1. If the query mentions specific SKU/article numbers with price/stock → STATS
2. If the query asks for analysis or recommendations → COMPLEX
3. If the query is a greeting or capability question → CHAT
4. When in doubt, prefer COMPLEX (safer to use more powerful model)

OUTPUT: Valid JSON only, no markdown:
{"intent": "STATS|CHAT|COMPLEX", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

// ============================================
// RULE-BASED FALLBACK CLASSIFIER
// ============================================

function classifyByRules(query: string): ClassificationResult {
  const lowerQuery = query.toLowerCase();

  // CHAT patterns (greetings, help)
  const chatPatterns = [
    /^(привет|здравствуй|хай|hello|hi|hey|добрый|доброе|доброй)/,
    /^(кто ты|что ты|что умеешь|help|помощь|помоги)/,
    /^(как дела|как ты)/,
  ];

  for (const pattern of chatPatterns) {
    if (pattern.test(lowerQuery)) {
      return { intent: 'CHAT', confidence: 0.9, reasoning: 'Rule: greeting pattern matched' };
    }
  }

  // STATS patterns (specific product queries)
  const statsPatterns = [
    /(цен[аыу]|price|прайс).*(артикул|sku|товар|\d{5,})/i,
    /(артикул|sku|товар|\d{5,}).*(цен[аыу]|price)/i,
    /(проверь|check|чекни|покажи).*(цен|price|остат|stock)/i,
    /(остат|stock|склад).*(артикул|sku|\d{5,})/i,
    /^(wb|вб|ozon|озон)\s+(цен|price|остат|stock)/i,
  ];

  for (const pattern of statsPatterns) {
    if (pattern.test(lowerQuery)) {
      return { intent: 'STATS', confidence: 0.85, reasoning: 'Rule: stats pattern matched' };
    }
  }

  // COMPLEX patterns (analysis, strategy)
  const complexPatterns = [
    /(анализ|analysis|аналитик)/i,
    /(стратеги|strategy|рекоменда|recommend)/i,
    /(прибыль|profit|рентабельн|margin)/i,
    /(abc|абс).*(анализ|analysis)/i,
    /(массов|bulk|пакетн|все товары|all products)/i,
    /(конкурент|competitor|рынок|market)/i,
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(lowerQuery)) {
      return { intent: 'COMPLEX', confidence: 0.8, reasoning: 'Rule: complex pattern matched' };
    }
  }

  // Default: COMPLEX (safer fallback)
  return {
    intent: 'COMPLEX',
    confidence: 0.5,
    reasoning: 'Rule: no pattern matched, defaulting to COMPLEX',
  };
}

// ============================================
// LLM-BASED CLASSIFICATION
// ============================================

async function classifyWithLLM(
  query: string,
  useLocal: boolean
): Promise<ClassificationResult | null> {
  const startTime = Date.now();

  try {
    const client = useLocal ? getLocalLLMClient() : getCloudLLMClient();
    const source = useLocal ? 'local' : 'cloud';

    logger.debug(`[MoE] Attempting ${source} classification`, { query: query.substring(0, 50) });

    const response = await client.invoke([
      new HumanMessage({ content: `${CLASSIFICATION_PROMPT}\n\nUser query: "${query}"` }),
    ]);

    const content = (response.content as string).replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(content) as ClassificationResult;

    const latency = Date.now() - startTime;
    logger.info(`[MoE] ${source} classification success`, {
      intent: parsed.intent,
      confidence: parsed.confidence,
      latencyMs: latency,
    });

    // Validate intent
    if (!['STATS', 'CHAT', 'COMPLEX'].includes(parsed.intent)) {
      throw new Error(`Invalid intent: ${parsed.intent}`);
    }

    return {
      intent: parsed.intent as IntentType,
      confidence: parsed.confidence || 0.7,
      reasoning: parsed.reasoning,
    };
  } catch (error: unknown) {
    const latency = Date.now() - startTime;
    const source = useLocal ? 'local' : 'cloud';

    logger.warn(`[MoE] ${source} classification failed`, {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: latency,
    });

    return null;
  }
}

// ============================================
// MAIN CLASSIFICATION NODE
// ============================================

const classifyIntent = async (
  state: typeof MoEState.State
): Promise<Partial<typeof MoEState.State>> => {
  const lastMessage = state.messages[state.messages.length - 1];
  const query =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const startTime = Date.now();
  let classification: ClassificationResult | null = null;
  let classifiedBy: 'local' | 'cloud' | 'fallback_rules' = 'fallback_rules';

  // Strategy: Local → Cloud → Rules
  const moeEnabled = process.env.MOE_ROUTING_ENABLED !== 'false';
  const forceLocal = process.env.FORCE_LOCAL_INFERENCE === 'true';

  if (moeEnabled) {
    // Step 1: Try local LLM
    classification = await classifyWithLLM(query, true);
    if (classification) {
      classifiedBy = 'local';
    }

    // Step 2: If local failed and not forcing local, try cloud
    if (!classification && !forceLocal) {
      classification = await classifyWithLLM(query, false);
      if (classification) {
        classifiedBy = 'cloud';
      }
    }
  }

  // Step 3: Fallback to rule-based classification
  if (!classification) {
    classification = classifyByRules(query);
    classifiedBy = 'fallback_rules';
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[MoE] Using rule-based classification', {
        intent: classification.intent,
        confidence: classification.confidence,
      });
    }
  }

  // Map intent to route
  let routeTo: RouteTarget = 'cloud_complex';
  if (classification.intent === 'STATS') routeTo = 'local_stats';
  else if (classification.intent === 'CHAT') routeTo = 'local_chat';

  const latencyMs = Date.now() - startTime;

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    routeTo,
    classifiedBy,
    latencyMs,
  };
};

// ============================================
// EXPERT NODES (Stubs - will be connected to real services)
// ============================================

const handleLocalStats = async (
  state: typeof MoEState.State
): Promise<Partial<typeof MoEState.State>> => {
  // This node is a routing checkpoint.
  // Actual execution happens in Inngest functions which call real services.
  return {
    messages: [
      new AIMessage({
        content: JSON.stringify({
          action: 'ROUTE_TO_STATS_EXPERT',
          intent: state.intent,
          confidence: state.confidence,
        }),
      }),
    ],
  };
};

const handleLocalChat = async (
  state: typeof MoEState.State
): Promise<Partial<typeof MoEState.State>> => {
  // Simple chat can be handled immediately or routed
  return {
    messages: [
      new AIMessage({
        content: JSON.stringify({
          action: 'ROUTE_TO_CHAT_EXPERT',
          intent: state.intent,
          confidence: state.confidence,
        }),
      }),
    ],
  };
};

const handleCloudComplex = async (
  state: typeof MoEState.State
): Promise<Partial<typeof MoEState.State>> => {
  // Complex queries go to cloud LLM (Gemini/GPT)
  return {
    messages: [
      new AIMessage({
        content: JSON.stringify({
          action: 'ROUTE_TO_CLOUD_EXPERT',
          intent: state.intent,
          confidence: state.confidence,
        }),
      }),
    ],
  };
};

// ============================================
// ROUTING FUNCTION
// ============================================

const routeByIntent = (state: typeof MoEState.State): RouteTarget => {
  return state.routeTo || 'cloud_complex';
};

// ============================================
// BUILD GRAPH
// ============================================

const workflow = new StateGraph(MoEState)
  .addNode('classify', classifyIntent)
  .addNode('local_stats', handleLocalStats)
  .addNode('local_chat', handleLocalChat)
  .addNode('cloud_complex', handleCloudComplex)
  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', routeByIntent);

export const moeRouter = workflow.compile();

// ============================================
// UTILITY: Check Local LLM Health
// ============================================

export async function checkLocalLLMHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = getLocalLLMClient();
    await client.invoke([new HumanMessage({ content: 'ping' })]);

    return {
      healthy: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// UTILITY: Direct Classification (for testing/API)
// ============================================

export async function classifyQuery(query: string): Promise<{
  intent: IntentType;
  confidence: number;
  routeTo: RouteTarget;
  classifiedBy: 'local' | 'cloud' | 'fallback_rules';
  latencyMs: number;
}> {
  const result = await moeRouter.invoke({
    messages: [new HumanMessage(query)],
  });

  return {
    intent: result.intent,
    confidence: result.confidence,
    routeTo: result.routeTo,
    classifiedBy: result.classifiedBy,
    latencyMs: result.latencyMs,
  };
}
