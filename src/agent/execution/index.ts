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

// Import all tools
import { toolRegistry } from './ToolRegistry.js';
import { getProductsTool } from './tools/GetProductsTool.js';
import { getSalesStatsTool } from './tools/GetSalesStatsTool.js';
import { setStopLossTool } from './tools/SetStopLossTool.js';
import { calculateUnitEconomicsTool } from './tools/CalculateEconomicsTool.js';
import { searchWebTool } from './tools/SearchWebTool.js';
import { bulkProtectProductsTool } from './tools/BulkProtectTool.js';
import { updatePricesTool } from './tools/UpdatePricesTool.js';

/**
 * Register all available tools
 * Call this once during application startup
 */
export function registerAllTools(): void {
  // Read tools (no side effects)
  toolRegistry.register(getProductsTool);

  // Analyze tools (calculations, stats)
  toolRegistry.register(getSalesStatsTool);
  toolRegistry.register(calculateUnitEconomicsTool);

  // Write tools (require confirmation)
  toolRegistry.register(setStopLossTool);
  toolRegistry.register(bulkProtectProductsTool);
  toolRegistry.register(updatePricesTool);

  // Search tools
  toolRegistry.register(searchWebTool);

  console.log(
    `[ToolRegistry] Registered ${toolRegistry.getStats().total} tools:`,
    toolRegistry.getNames().join(', ')
  );
}

// Re-export individual tools for direct access
export { getProductsTool } from './tools/GetProductsTool.js';
export { getSalesStatsTool } from './tools/GetSalesStatsTool.js';
export { setStopLossTool } from './tools/SetStopLossTool.js';
export { calculateUnitEconomicsTool } from './tools/CalculateEconomicsTool.js';
export { searchWebTool } from './tools/SearchWebTool.js';
export { bulkProtectProductsTool } from './tools/BulkProtectTool.js';
export { updatePricesTool } from './tools/UpdatePricesTool.js';
