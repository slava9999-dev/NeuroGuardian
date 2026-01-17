// ============================================
// NeuroGUARDIAN — Tool Registry Exports
// Version: 5.0.0 | Date: January 2026
// ============================================

export {
  toolRegistry,
  ToolRegistry,
  defineTool,
  ToolNotFoundError,
  ToolValidationError,
} from './ToolRegistry.js';
import { logger } from '../../api-lib/lib/logger.js';

// Import all tools
import { toolRegistry } from './ToolRegistry.js';

// Read tools
import { getProductsTool } from './tools/GetProductsTool.js';
import { getOrdersTool } from './tools/GetOrdersTool.js';
import { getWarehouseStocksTool } from './tools/GetWarehouseStocksTool.js';
import { getMarketplaceAccountsTool } from './tools/GetMarketplaceAccountsTool.js';
import { getReviewsTool } from './tools/GetReviewsTool.js';

// Analyze tools
import { getSalesStatsTool } from './tools/GetSalesStatsTool.js';
import { calculateUnitEconomicsTool } from './tools/CalculateEconomicsTool.js';
import { getAbcAnalysisTool } from './tools/GetAbcAnalysisTool.js';
import { getStockForecastTool } from './tools/GetStockForecastTool.js';
import { getLowMarginProductsTool } from './tools/GetLowMarginProductsTool.js';

// Write tools
import { setStopLossTool } from './tools/SetStopLossTool.js';
import { bulkProtectProductsTool } from './tools/BulkProtectTool.js';
import { updatePricesTool } from './tools/UpdatePricesTool.js';
import { updateStocksTool } from './tools/UpdateStocksTool.js';
import { updateProductSettingsTool } from './tools/UpdateProductSettingsTool.js';
import { syncCatalogTool } from './tools/SyncCatalogTool.js';
import { generateProductImageTool } from './tools/GenerateProductImageTool.js';

// Search tools
import { searchWebTool } from './tools/SearchWebTool.js';
import { getMarketplaceInfoTool } from './tools/GetMarketplaceInfoTool.js';
import { getCompetitorPriceTool } from './tools/GetCompetitorPriceTool.js';
import { getRealPriceTool } from './tools/GetRealPriceTool.js';

// Admin
import { getSystemLogsTool } from './tools/GetSystemLogsTool.js';

/**
 * Register all available tools
 * Call this once during application startup
 */
export function registerAllTools(): void {
  // Read tools (no side effects)
  toolRegistry.register(getProductsTool);
  toolRegistry.register(getOrdersTool);
  toolRegistry.register(getWarehouseStocksTool);
  toolRegistry.register(getMarketplaceAccountsTool);
  toolRegistry.register(getReviewsTool);

  // Analyze tools (calculations, stats)
  toolRegistry.register(getSalesStatsTool);
  toolRegistry.register(calculateUnitEconomicsTool);
  toolRegistry.register(getAbcAnalysisTool);
  toolRegistry.register(getStockForecastTool);
  toolRegistry.register(getLowMarginProductsTool);
  toolRegistry.register(getRealPriceTool); // Digital Vision

  // Write tools (require confirmation)
  toolRegistry.register(setStopLossTool);
  toolRegistry.register(bulkProtectProductsTool);
  toolRegistry.register(updatePricesTool);
  toolRegistry.register(updateStocksTool);
  toolRegistry.register(updateProductSettingsTool);
  toolRegistry.register(syncCatalogTool);
  toolRegistry.register(generateProductImageTool);

  // Search tools
  toolRegistry.register(searchWebTool);
  toolRegistry.register(getMarketplaceInfoTool);
  toolRegistry.register(getCompetitorPriceTool);

  // Admin
  toolRegistry.register(getSystemLogsTool);

  logger.info(`[ToolRegistry] Registered ${toolRegistry.getStats().total} tools:`, {
    tools: toolRegistry.getNames(),
  });
}

// Re-export individual tools for direct access
export { getProductsTool } from './tools/GetProductsTool.js';
export { getSalesStatsTool } from './tools/GetSalesStatsTool.js';
export { setStopLossTool } from './tools/SetStopLossTool.js';
export { calculateUnitEconomicsTool } from './tools/CalculateEconomicsTool.js';
export { searchWebTool } from './tools/SearchWebTool.js';
export { bulkProtectProductsTool } from './tools/BulkProtectTool.js';
export { updatePricesTool } from './tools/UpdatePricesTool.js';

export { getOrdersTool } from './tools/GetOrdersTool.js';
export { getWarehouseStocksTool } from './tools/GetWarehouseStocksTool.js';
export { getAbcAnalysisTool } from './tools/GetAbcAnalysisTool.js';
export { getStockForecastTool } from './tools/GetStockForecastTool.js';
export { getMarketplaceInfoTool } from './tools/GetMarketplaceInfoTool.js';
export { getMarketplaceAccountsTool } from './tools/GetMarketplaceAccountsTool.js';
export { updateStocksTool } from './tools/UpdateStocksTool.js';
export { updateProductSettingsTool } from './tools/UpdateProductSettingsTool.js';
export { getSystemLogsTool } from './tools/GetSystemLogsTool.js';
export { getCompetitorPriceTool } from './tools/GetCompetitorPriceTool.js';
export { getReviewsTool } from './tools/GetReviewsTool.js';
export { getLowMarginProductsTool } from './tools/GetLowMarginProductsTool.js';
export { getRealPriceTool } from './tools/GetRealPriceTool.js';
export { syncCatalogTool } from './tools/SyncCatalogTool.js';
export { generateProductImageTool } from './tools/GenerateProductImageTool.js';
