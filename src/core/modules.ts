// ============================================
// NeuroGUARDIAN — Module Registration
// Registers all system modules with the Kernel
// This file is imported once at startup
// Version: 1.0.0 | Date: January 2026
// ============================================

import { systemKernel, defineModule, type ModuleHealth } from './SystemKernel.js';
import { sql } from '../api-lib/services/database.js';
import { logger } from '../api-lib/lib/logger.js';

// ============================================
// DATABASE MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'Database',
    version: '1.0.0',
    category: 'data',
    description: 'PostgreSQL database connection via Neon',
    dependencies: [],
    initialize: async () => {
      // Database is initialized on first query
      logger.info('[Module:Database] Ready (lazy init)');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        const start = Date.now();
        await sql`SELECT 1 as ping`;
        return {
          status: 'healthy',
          lastCheck: new Date(),
          latencyMs: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// STATE MANAGER MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'StateManager',
    version: '5.0.0',
    category: 'core',
    description: 'Manages user state across sessions',
    dependencies: ['Database'],
    initialize: async () => {
      // StateManager has lazy init built-in
      logger.info('[Module:StateManager] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        // Check if user_state table exists
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'user_state'
          ) as exists
        `;
        const exists = result.rows[0]?.exists;
        return {
          status: exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// TOOL REGISTRY MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'ToolRegistry',
    version: '5.0.0',
    category: 'execution',
    description: 'Extensible tool registration system for agent',
    dependencies: [],
    initialize: async () => {
      // Tools are registered on import
      logger.info('[Module:ToolRegistry] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      // Import dynamically to check
      const { toolRegistry } = await import('../agent/execution/ToolRegistry.js');
      const stats = toolRegistry.getStats();
      return {
        status: stats.total > 0 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
      };
    },
  })
);

// ============================================
// KNOWLEDGE BASE MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'KnowledgeBase',
    version: '2.0.0',
    category: 'data',
    description: 'RAG-powered knowledge retrieval system',
    dependencies: [],
    initialize: async () => {
      // KnowledgeBase is lazy-loaded on first search
      logger.info('[Module:KnowledgeBase] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        const { knowledgeBase } = await import('../agent/core/KnowledgeBase.js');
        await knowledgeBase.search('test', 1);
        return {
          status: 'healthy',
          lastCheck: new Date(),
        };
      } catch {
        return {
          status: 'degraded',
          lastCheck: new Date(),
        };
      }
    },
  })
);

// ============================================
// MEMORY MANAGER MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'MemoryManager',
    version: '1.0.0',
    category: 'data',
    description: 'Long-term memory for user facts and preferences',
    dependencies: ['Database'],
    initialize: async () => {
      logger.info('[Module:MemoryManager] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'user_memory'
          ) as exists
        `;
        return {
          status: result.rows[0]?.exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch (error) {
        return {
          status: 'degraded',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// AGENT ORCHESTRATOR MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'AgentOrchestrator',
    version: '5.2.0',
    category: 'core',
    description: 'Main AI agent orchestration engine',
    dependencies: ['StateManager', 'ToolRegistry', 'KnowledgeBase', 'MemoryManager'],
    initialize: async () => {
      logger.info('[Module:AgentOrchestrator] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      // Check LLM provider availability
      try {
        await import('../infrastructure/llm/LLMProvider.js');
        return {
          status: 'healthy',
          lastCheck: new Date(),
        };
      } catch {
        return {
          status: 'degraded',
          lastCheck: new Date(),
          error: 'LLM provider not available',
        };
      }
    },
  })
);

// ============================================
// MARKETPLACE SERVICE MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'MarketplaceService',
    version: '2.0.0',
    category: 'integration',
    description: 'Unified interface for WB and Ozon APIs',
    dependencies: ['Database'],
    initialize: async () => {
      logger.info('[Module:MarketplaceService] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      // Check if marketplace_accounts table exists
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'marketplace_accounts'
          ) as exists
        `;
        return {
          status: result.rows[0]?.exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// SENTINEL SERVICE MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'Sentinel',
    version: '2.0.0',
    category: 'core',
    description: 'Price monitoring and defense system',
    dependencies: ['Database', 'MarketplaceService'],
    initialize: async () => {
      logger.info('[Module:Sentinel] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        // Check sentinel_events table
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'sentinel_events'
          ) as exists
        `;
        return {
          status: result.rows[0]?.exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch (error) {
        return {
          status: 'degraded',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// SUBSCRIPTION SERVICE MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'SubscriptionService',
    version: '1.0.0',
    category: 'core',
    description: 'Manages user subscriptions and trials',
    dependencies: ['Database'],
    initialize: async () => {
      logger.info('[Module:SubscriptionService] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'subscriptions'
          ) as exists
        `;
        return {
          status: result.rows[0]?.exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  })
);

// ============================================
// TELEGRAM BOT MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'TelegramBot',
    version: '1.0.0',
    category: 'integration',
    description: 'Telegram bot webhook handler',
    dependencies: ['AgentOrchestrator', 'SubscriptionService'],
    initialize: async () => {
      logger.info('[Module:TelegramBot] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      // Check if TELEGRAM_BOT_TOKEN is set
      const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
      return {
        status: hasToken ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        error: hasToken ? undefined : 'TELEGRAM_BOT_TOKEN not set',
      };
    },
  })
);

// ============================================
// RESPONSE VALIDATOR MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'ResponseValidator',
    version: '1.0.0',
    category: 'utility',
    description: 'Validates agent responses (guardrails)',
    dependencies: [],
    initialize: async () => {
      logger.info('[Module:ResponseValidator] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      return {
        status: 'healthy',
        lastCheck: new Date(),
      };
    },
  })
);

// ============================================
// EXPERIENCE LEARNING MODULE
// ============================================

systemKernel.register(
  defineModule({
    name: 'ExperienceLearning',
    version: '1.0.0',
    category: 'core',
    description: 'Learns from past agent interactions',
    dependencies: ['Database'],
    initialize: async () => {
      logger.info('[Module:ExperienceLearning] Ready');
    },
    healthCheck: async (): Promise<ModuleHealth> => {
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'agent_experiences'
          ) as exists
        `;
        return {
          status: result.rows[0]?.exists ? 'healthy' : 'degraded',
          lastCheck: new Date(),
        };
      } catch {
        return {
          status: 'degraded',
          lastCheck: new Date(),
        };
      }
    },
  })
);

// ============================================
// EXPORT INITIALIZATION FUNCTION
// ============================================

/**
 * Initialize all registered modules
 * Call this at application startup
 */
export async function initializeKernel(): Promise<{
  success: boolean;
  errors: string[];
  manifest: ReturnType<typeof systemKernel.getManifest>;
}> {
  logger.info('[Kernel] Starting system initialization...');

  const result = await systemKernel.initialize();
  const manifest = systemKernel.getManifest();

  if (result.success) {
    logger.info('[Kernel] ✅ All modules initialized successfully');
  } else {
    logger.warn('[Kernel] ⚠️ Some modules failed to initialize', { errors: result.errors });
  }

  // Log dependency graph
  logger.debug('[Kernel] Dependency graph:\n' + systemKernel.generateDependencyGraph());

  return {
    ...result,
    manifest,
  };
}

/**
 * Get kernel health status
 * Use this for health checks
 */
export function getKernelHealth() {
  return systemKernel.getSystemHealth();
}

/**
 * Get full kernel manifest
 */
export function getKernelManifest() {
  return systemKernel.getManifest();
}

// Re-export kernel for direct access
export { systemKernel };
