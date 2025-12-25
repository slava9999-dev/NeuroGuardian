// ============================================
// NeuroGUARDIAN — Agent Module Index
// Re-export all agent-related components
// Version: 4.0.0 | V3 Legacy removed
// ============================================

// ============================================
// V4 Architecture: Two-Phase Pipeline
// ============================================

// V4 Orchestrator (main entry point)
export { orchestrateV4, type UserContext } from './orchestrator-v4.js';

// V4 Schemas (Zod validation)
export {
  PlanSchema,
  AnswerSchema,
  ToolNameEnum,
  ResponseLinkSchema,
  ResponseActionSchema,
  validateAnswerLinks,
  sanitizeAnswerLinks,
  ANSWER_JSON_SCHEMA,
  PLAN_JSON_SCHEMA,
  type Plan,
  type Answer,
  type ToolName,
  type ToolResult,
} from './schemas-v4.js';

// Router
export { getSpecialistConfig, SPECIALIST_CONFIG } from './router.js';

// URL Validator
export {
  validateUrl,
  validateLinks,
  sanitizeTextUrls,
  generateSearchUrl,
  ALLOWED_HOSTS,
} from './url-validator.js';

// Specialists
export {
  buildAnalyticsPrompt,
  buildPricingPrompt,
  buildCompetitorsPrompt,
  buildGeneralPrompt,
  ANALYTICS_TOOLS,
  PRICING_TOOLS,
  COMPETITORS_TOOLS,
  GENERAL_TOOLS,
} from './specialists/index.js';

// Prompts
export {
  BASE_PERSONA,
  CRITICAL_RULES,
  TOOL_USAGE_RULES,
  buildSpecialistPrompt,
} from './prompts/index.js';

// Tools
export { AGENT_TOOLS, CONFIRMATION_REQUIRED_TOOLS, requiresConfirmation } from './tools.js';

// Metrics & Analytics
export {
  type AgentMetrics,
  type AgentAnalytics,
  logAgentMetrics,
  getDailyAnalytics,
  createAgentMetrics,
  formatMetricsForLog,
  classifyComplexity,
  estimateTokenCost,
} from './metrics.js';

// Tool Executors (Real WB/Ozon API implementations)
export {
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

// Validators (Zod schemas for tool arguments)
export {
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
