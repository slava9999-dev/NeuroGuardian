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
export const executeGetProducts = (userId: number, args: GetProductsArgs) =>
  getProductsTool.execute(userId, args);
export const executeGetSalesStats = (userId: number, args: GetSalesStatsArgs) =>
  getSalesStatsTool.execute(userId, args);
export const executeGetOrders = (userId: number, args: GetOrdersArgs) =>
  getOrdersTool.execute(userId, args);
export const executeGetWarehouseStocks = (userId: number, args: GetWarehouseStocksArgs) =>
  getWarehouseStocksTool.execute(userId, args);
export const executeCalculateUnitEconomics = (userId: number, args: CalculateUnitEconomicsArgs) =>
  calculateUnitEconomicsTool.execute(userId, args);
export const executeGetAbcAnalysis = (userId: number, args: GetAbcAnalysisArgs) =>
  getAbcAnalysisTool.execute(userId, args);
export const executeGetStockForecast = (userId: number, args: GetStockForecastArgs) =>
  getStockForecastTool.execute(userId, args);
export const executeGetMarketplaceInfo = (args: GetMarketplaceInfoArgs) =>
  getMarketplaceInfoTool.execute(0, args); // userId 0 for info tools
export const executeSearchWeb = (userId: number, args: SearchWebArgs) =>
  searchWebTool.execute(userId, args);
export const executeGetCompetitorPrice = (userId: number, args: GetCompetitorPriceArgs) =>
  getCompetitorPriceTool.execute(userId, args);
export const executeGetReviews = (userId: number, args: GetReviewsArgs) =>
  getReviewsTool.execute(userId, args);
export const executeGetLowMarginProducts = (userId: number, args: GetLowMarginProductsArgs) =>
  getLowMarginProductsTool.execute(userId, args);
export const executeUpdatePrices = (userId: number, args: UpdatePricesArgs) =>
  updatePricesTool.execute(userId, args);
export const executeUpdateStocks = (userId: number, args: UpdateStocksArgs) =>
  updateStocksTool.execute(userId, args);
export const executeUpdateProductSettings = (userId: number, args: UpdateProductSettingsArgs) =>
  updateProductSettingsTool.execute(userId, args);
export const executeSetStopLoss = (userId: number, args: SetStopLossArgs) =>
  setStopLossTool.execute(userId, args);
export const executeBulkProtectProducts = (userId: number, args: BulkProtectProductsArgs) =>
  bulkProtectProductsTool.execute(userId, args);
export const executeGetSystemLogs = (userId: number, args: GetSystemLogsArgs) =>
  getSystemLogsTool.execute(userId, args);
export const executeGetMarketplaceAccounts = (userId: number, args: GetMarketplaceAccountsArgs) =>
  getMarketplaceAccountsTool.execute(userId, args);

// Validators (Zod schemas for tool arguments)
export {
  GetStockForecastArgsSchema,
  GetMarketplaceInfoArgsSchema,
  SearchWebArgsSchema,
} from './validators.js';

import type {
  GetProductsArgs,
  GetSalesStatsArgs,
  GetOrdersArgs,
  GetWarehouseStocksArgs,
  CalculateUnitEconomicsArgs,
  GetAbcAnalysisArgs,
  GetStockForecastArgs,
  GetMarketplaceInfoArgs,
  SearchWebArgs,
  GetCompetitorPriceArgs,
  GetReviewsArgs,
  GetLowMarginProductsArgs,
  UpdatePricesArgs,
  UpdateStocksArgs,
  UpdateProductSettingsArgs,
  SetStopLossArgs,
  BulkProtectProductsArgs,
  GetSystemLogsArgs,
  GetMarketplaceAccountsArgs,
} from './validators.js';

export type {
  GetProductsArgs,
  GetSalesStatsArgs,
  GetOrdersArgs,
  GetWarehouseStocksArgs,
  CalculateUnitEconomicsArgs,
  GetAbcAnalysisArgs,
  GetStockForecastArgs,
  GetMarketplaceInfoArgs,
  SearchWebArgs,
  GetCompetitorPriceArgs,
  GetReviewsArgs,
  GetLowMarginProductsArgs,
  UpdatePricesArgs,
  UpdateStocksArgs,
  UpdateProductSettingsArgs,
  SetStopLossArgs,
  BulkProtectProductsArgs,
  GetSystemLogsArgs,
  GetMarketplaceAccountsArgs,
};
