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

// Import and register all tools
import { toolRegistry } from './ToolRegistry.js';
import { getProductsTool } from './tools/GetProductsTool.js';

/**
 * Register all available tools
 * Call this once during application startup
 */
export function registerAllTools(): void {
  toolRegistry.register(getProductsTool);

  // TODO: Migrate remaining tools from tool-executors.ts
  // toolRegistry.register(getSalesStatsTool);
  // toolRegistry.register(calculateEconomicsTool);
  // toolRegistry.register(setStopLossTool);
  // etc.

  console.log(`[ToolRegistry] Registered ${toolRegistry.getStats().total} tools`);
}
