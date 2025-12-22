// ============================================
// NeuroGUARDIAN — Agent Module Index
// Re-export all agent-related components
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
} from './tool-executors.js';
