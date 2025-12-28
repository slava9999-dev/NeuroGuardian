// ============================================
// NeuroGUARDIAN — AI Agent Metrics & Logging
// Quality tracking for continuous improvement
// Version: 1.0.0 | Date: December 2024
// ============================================

import { createClient } from '@vercel/kv';

/**
 * Agent response metrics interface
 */
export interface AgentMetrics {
  // Identification
  userId: number;
  sessionId: string;
  timestamp: Date;

  // Request info
  userMessage: string;
  messageLength: number;
  messageComplexity: 'simple' | 'medium' | 'complex';

  // Model info
  model: string;
  tokensUsed: number;
  tokensCost: number; // estimated cost in USD

  // Response metrics
  responseLength: number;
  responseTime: number; // ms
  toolsUsed: string[];
  toolsCount: number;

  // Quality indicators
  hadActionRequired: boolean;
  actionType?: string;
  actionConfirmed?: boolean;

  // Error tracking
  hadError: boolean;
  errorType?: string;
}

/**
 * Aggregated metrics for analytics
 */
export interface AgentAnalytics {
  period: 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;

  // Usage stats
  totalRequests: number;
  uniqueUsers: number;

  // Token usage
  totalTokens: number;
  avgTokensPerRequest: number;
  estimatedCost: number;

  // Performance
  avgResponseTime: number;
  p95ResponseTime: number;

  // Quality
  toolUsageRate: number; // % of requests that used tools
  actionConfirmationRate: number; // % of actions confirmed
  errorRate: number;

  // Popular tools
  topTools: { name: string; count: number }[];

  // Complexity distribution
  complexityDistribution: {
    simple: number;
    medium: number;
    complex: number;
  };
}

/**
 * Token pricing (approximate, Dec 2024)
 */
const TOKEN_PRICING = {
  'gpt-4o': {
    input: 0.0025 / 1000, // $2.50 per 1M input tokens
    output: 0.01 / 1000, // $10 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.00015 / 1000, // $0.15 per 1M input tokens
    output: 0.0006 / 1000, // $0.60 per 1M output tokens
  },
};

/**
 * Estimate token cost based on model and usage
 */
export function estimateTokenCost(model: string, tokens: number): number {
  const pricing =
    TOKEN_PRICING[model as keyof typeof TOKEN_PRICING] || TOKEN_PRICING['gpt-4o-mini'];
  // Assume 50/50 split between input/output for simplicity
  const avgPrice = (pricing.input + pricing.output) / 2;
  return tokens * avgPrice;
}

/**
 * Classify message complexity
 */
export function classifyComplexity(message: string): 'simple' | 'medium' | 'complex' {
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
    'сравни',
    'объясни',
  ];

  const mediumPatterns = [
    'покажи',
    'какой',
    'какая',
    'сколько',
    'список',
    'статистика',
    'продажи',
    'заказы',
    'товары',
    'остатки',
  ];

  if (complexPatterns.some(p => lowerMessage.includes(p))) return 'complex';
  if (mediumPatterns.some(p => lowerMessage.includes(p))) return 'medium';
  return 'simple';
}

/**
 * Generate session ID for tracking conversations
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

import { getSecretSync } from '../lib/secrets-helper.js';

/**
 * Get KV client for metrics storage
 * Uses Security Agent secrets with fallback to process.env
 */
function getKVClient() {
  const kvUrl = getSecretSync('kv_rest_api_url') || process.env.KV_REST_API_URL;
  const kvToken = getSecretSync('kv_rest_api_token') || process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    return createClient({
      url: kvUrl,
      token: kvToken,
    });
  }
  return null;
}

/**
 * Log agent metrics to KV store
 */
export async function logAgentMetrics(metrics: AgentMetrics): Promise<void> {
  const kv = getKVClient();
  if (!kv) {
    console.log('[Agent Metrics] KV not available, logging to console:', {
      userId: metrics.userId,
      model: metrics.model,
      tokens: metrics.tokensUsed,
      responseTime: metrics.responseTime,
      tools: metrics.toolsUsed,
    });
    return;
  }

  try {
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const metricsKey = `agent:metrics:${dateKey}`;

    // Get existing metrics for today
    const existing = (await kv.get<AgentMetrics[]>(metricsKey)) || [];

    // Add new metrics
    existing.push(metrics);

    // Keep only last 1000 requests per day to avoid memory issues
    const trimmed = existing.slice(-1000);

    // Save with 7-day expiry
    await kv.set(metricsKey, trimmed, { ex: 604800 });

    // Update daily summary
    await updateDailySummary(kv, dateKey, metrics);

    console.log(
      `[Agent Metrics] Logged: user=${metrics.userId}, tokens=${metrics.tokensUsed}, time=${metrics.responseTime}ms`
    );
  } catch (e) {
    console.warn('[Agent Metrics] Failed to log:', e);
  }
}

/**
 * Update daily summary for quick analytics
 */
async function updateDailySummary(
  kv: ReturnType<typeof createClient>,
  dateKey: string,
  metrics: AgentMetrics
): Promise<void> {
  const summaryKey = `agent:summary:${dateKey}`;

  interface DailySummary {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    totalResponseTime: number;
    uniqueUsers: Set<number> | number[];
    toolUsage: Record<string, number>;
    errors: number;
    actions: number;
    actionsConfirmed: number;
    complexityCount: { simple: number; medium: number; complex: number };
  }

  const existing = (await kv.get<DailySummary>(summaryKey)) || {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    totalResponseTime: 0,
    uniqueUsers: [],
    toolUsage: {},
    errors: 0,
    actions: 0,
    actionsConfirmed: 0,
    complexityCount: { simple: 0, medium: 0, complex: 0 },
  };

  // Update counts
  existing.totalRequests += 1;
  existing.totalTokens += metrics.tokensUsed;
  existing.totalCost += metrics.tokensCost;
  existing.totalResponseTime += metrics.responseTime;

  // Track unique users
  const users = new Set(Array.isArray(existing.uniqueUsers) ? existing.uniqueUsers : []);
  users.add(metrics.userId);
  existing.uniqueUsers = Array.from(users);

  // Track tool usage
  for (const tool of metrics.toolsUsed) {
    existing.toolUsage[tool] = (existing.toolUsage[tool] || 0) + 1;
  }

  // Track errors
  if (metrics.hadError) existing.errors += 1;

  // Track actions
  if (metrics.hadActionRequired) {
    existing.actions += 1;
    if (metrics.actionConfirmed) existing.actionsConfirmed += 1;
  }

  // Track complexity
  existing.complexityCount[metrics.messageComplexity] += 1;

  // Save with 30-day expiry
  await kv.set(summaryKey, existing, { ex: 2592000 });
}

/**
 * Get daily analytics
 */
export async function getDailyAnalytics(date?: string): Promise<AgentAnalytics | null> {
  const kv = getKVClient();
  if (!kv) return null;

  const dateKey = date || new Date().toISOString().split('T')[0];
  const summaryKey = `agent:summary:${dateKey}`;

  interface DailySummary {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    totalResponseTime: number;
    uniqueUsers: number[];
    toolUsage: Record<string, number>;
    errors: number;
    actions: number;
    actionsConfirmed: number;
    complexityCount: { simple: number; medium: number; complex: number };
  }

  const summary = await kv.get<DailySummary>(summaryKey);
  if (!summary) return null;

  const topTools = Object.entries(summary.toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    period: 'day',
    startDate: new Date(dateKey),
    endDate: new Date(dateKey),

    totalRequests: summary.totalRequests,
    uniqueUsers: summary.uniqueUsers.length,

    totalTokens: summary.totalTokens,
    avgTokensPerRequest: summary.totalTokens / summary.totalRequests,
    estimatedCost: summary.totalCost,

    avgResponseTime: summary.totalResponseTime / summary.totalRequests,
    p95ResponseTime: 0, // Would need full data for p95

    toolUsageRate:
      (summary.totalRequests -
        Object.values(summary.toolUsage).reduce((a, b) => Math.max(a, b), 0)) /
      summary.totalRequests,
    actionConfirmationRate: summary.actions > 0 ? summary.actionsConfirmed / summary.actions : 0,
    errorRate: summary.errors / summary.totalRequests,

    topTools,
    complexityDistribution: summary.complexityCount,
  };
}

/**
 * Create metrics object from agent response
 */
export function createAgentMetrics(params: {
  userId: number;
  userMessage: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
  toolsUsed: string[];
  hadError: boolean;
  errorType?: string;
  actionRequired?: { type: string; confirmed?: boolean };
}): AgentMetrics {
  const sessionId = generateSessionId();
  const complexity = classifyComplexity(params.userMessage);
  const tokensCost = estimateTokenCost(params.model, params.tokensUsed);

  return {
    userId: params.userId,
    sessionId,
    timestamp: new Date(),

    userMessage: params.userMessage.substring(0, 500), // Truncate for storage
    messageLength: params.userMessage.length,
    messageComplexity: complexity,

    model: params.model,
    tokensUsed: params.tokensUsed,
    tokensCost,

    responseLength: 0, // Set later if needed
    responseTime: params.responseTime,
    toolsUsed: params.toolsUsed,
    toolsCount: params.toolsUsed.length,

    hadActionRequired: !!params.actionRequired,
    actionType: params.actionRequired?.type,
    actionConfirmed: params.actionRequired?.confirmed,

    hadError: params.hadError,
    errorType: params.errorType,
  };
}

/**
 * Log and return formatted metrics for debugging
 */
export function formatMetricsForLog(metrics: AgentMetrics): string {
  return [
    `📊 Agent Metrics:`,
    `  User: ${metrics.userId}`,
    `  Model: ${metrics.model}`,
    `  Complexity: ${metrics.messageComplexity}`,
    `  Tokens: ${metrics.tokensUsed} (~$${metrics.tokensCost.toFixed(4)})`,
    `  Response time: ${metrics.responseTime}ms`,
    `  Tools: ${metrics.toolsUsed.length > 0 ? metrics.toolsUsed.join(', ') : 'none'}`,
    metrics.hadActionRequired ? `  Action: ${metrics.actionType}` : '',
    metrics.hadError ? `  ⚠️ Error: ${metrics.errorType}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
