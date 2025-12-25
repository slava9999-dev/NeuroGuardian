// ============================================
// NeuroGUARDIAN — Agent Module Index
// Re-export all agent-related components
// ============================================

// ============================================
// V3 Architecture: Router + Specialists + Structured Output
// ============================================

// Orchestrator (main entry point for V3)
export {
  orchestrateAgentRequest,
  routeMessage,
  isConfirmation,
  isRejection,
  type UserContext,
  type OrchestratorResult,
} from './orchestrator.js';

// Router
export { getSpecialistConfig, SPECIALIST_CONFIG } from './router.js';

// Schemas (Zod validation)
export {
  RouterResultSchema,
  AgentResponseSchema,
  AgentLinkSchema,
  AgentActionSchema,
  parseRouterResult,
  parseAgentResponse,
  validateLLMResponse,
  type RouterResult,
  type AgentResponse,
  type AgentLink,
  type AgentAction,
} from './schemas.js';

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

// ============================================
// V2 Legacy (for backwards compatibility)
// ============================================

// V1 System Prompt (legacy)
export { AGENT_SYSTEM_PROMPT } from './system-prompt.js';

// V2 MEGA-BRAIN System Prompt (Expert Persona + CoT + Few-Shot)
export {
  AGENT_SYSTEM_PROMPT_V2,
  AGENT_SYSTEM_PROMPT_V2_SHORT,
  getEnhancedSystemPrompt,
} from './system-prompt-v2.js';

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
