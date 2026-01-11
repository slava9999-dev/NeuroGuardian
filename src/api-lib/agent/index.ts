// ============================================
// NeuroGUARDIAN — Agent Module Index
// Re-export all agent-related components
// Version: 5.0.0 | Refactored to Modular Tools
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

// Bridge to V5 Modular Tools
import {
  getProductsTool,
  getSalesStatsTool,
  getOrdersTool,
  getWarehouseStocksTool,
  calculateUnitEconomicsTool,
  getAbcAnalysisTool,
  getStockForecastTool,
  getMarketplaceInfoTool,
  searchWebTool,
  getCompetitorPriceTool,
  getReviewsTool,
  getLowMarginProductsTool,
  updatePricesTool,
  updateStocksTool,
  updateProductSettingsTool,
  setStopLossTool,
  bulkProtectProductsTool,
  getSystemLogsTool,
  getMarketplaceAccountsTool,
} from '../../agent/execution/index.js';

// Tool Executors (Wrappers for V4 compatibility)
export const executeGetProducts = (userId: number, args: any) =>
  getProductsTool.execute(userId, args);
export const executeGetSalesStats = (userId: number, args: any) =>
  getSalesStatsTool.execute(userId, args);
export const executeGetOrders = (userId: number, args: any) => getOrdersTool.execute(userId, args);
export const executeGetWarehouseStocks = (userId: number, args: any) =>
  getWarehouseStocksTool.execute(userId, args);
export const executeCalculateUnitEconomics = (userId: number, args: any) =>
  calculateUnitEconomicsTool.execute(userId, args);
export const executeGetAbcAnalysis = (userId: number, args: any) =>
  getAbcAnalysisTool.execute(userId, args);
export const executeGetStockForecast = (userId: number, args: any) =>
  getStockForecastTool.execute(userId, args);
export const executeGetMarketplaceInfo = (args: any) => getMarketplaceInfoTool.execute(0, args); // userId 0 for info tools
export const executeSearchWeb = (userId: number, args: any) => searchWebTool.execute(userId, args);
export const executeGetCompetitorPrice = (userId: number, args: any) =>
  getCompetitorPriceTool.execute(userId, args);
export const executeGetReviews = (userId: number, args: any) =>
  getReviewsTool.execute(userId, args);
export const executeGetLowMarginProducts = (userId: number, args: any) =>
  getLowMarginProductsTool.execute(userId, args);
export const executeUpdatePrices = (userId: number, args: any) =>
  updatePricesTool.execute(userId, args);
export const executeUpdateStocks = (userId: number, args: any) =>
  updateStocksTool.execute(userId, args);
export const executeUpdateProductSettings = (userId: number, args: any) =>
  updateProductSettingsTool.execute(userId, args);
export const executeSetStopLoss = (userId: number, args: any) =>
  setStopLossTool.execute(userId, args);
export const executeBulkProtectProducts = (userId: number, args: any) =>
  bulkProtectProductsTool.execute(userId, args);
export const executeGetSystemLogs = (userId: number, args: any) =>
  getSystemLogsTool.execute(userId, args);
export const executeGetMarketplaceAccounts = (userId: number, args: any) =>
  getMarketplaceAccountsTool.execute(userId, args);

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
