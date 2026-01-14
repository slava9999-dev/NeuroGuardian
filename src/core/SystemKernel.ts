// ============================================
// NeuroGUARDIAN — System Kernel (MCP-inspired)
// Unified orchestration layer connecting all modules
// Like organs in a body - synchronized, healthy, communicating
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';

// ============================================
// TYPES
// ============================================

/**
 * Module health status
 */
export interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  latencyMs?: number;
  error?: string;
  dependencies?: string[];
}

/**
 * Module definition - like an organ in a body
 */
export interface SystemModule {
  name: string;
  version: string;
  category: 'core' | 'execution' | 'data' | 'integration' | 'utility';
  description: string;
  dependencies: string[];
  initialize: () => Promise<void>;
  healthCheck: () => Promise<ModuleHealth>;
  shutdown?: () => Promise<void>;
}

/**
 * Event types for inter-module communication
 */
export interface SystemEvent {
  type: string;
  source: string;
  timestamp: Date;
  payload: unknown;
  correlationId?: string;
}

type EventHandler = (event: SystemEvent) => Promise<void>;

// ============================================
// SYSTEM KERNEL
// ============================================

/**
 * System Kernel - The brain that connects all organs
 *
 * Inspired by Anthropic's MCP (Model Context Protocol):
 * - Single source of truth for all modules
 * - Dependency injection
 * - Health monitoring
 * - Event-driven communication
 */
export class SystemKernel {
  private modules: Map<string, SystemModule> = new Map();
  private health: Map<string, ModuleHealth> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private initialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // ============================================
  // MODULE REGISTRATION
  // ============================================

  /**
   * Register a module with the kernel
   */
  register(module: SystemModule): void {
    if (this.modules.has(module.name)) {
      logger.warn(`[Kernel] Module ${module.name} already registered, replacing`);
    }

    this.modules.set(module.name, module);
    this.health.set(module.name, {
      status: 'unknown',
      lastCheck: new Date(),
      dependencies: module.dependencies,
    });

    logger.info(`[Kernel] Registered module: ${module.name} v${module.version}`);
  }

  /**
   * Get a registered module
   */
  getModule<T extends SystemModule>(name: string): T | undefined {
    return this.modules.get(name) as T | undefined;
  }

  /**
   * Check if a module is registered
   */
  hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize all modules in dependency order
   */
  async initialize(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const initOrder = this.getInitializationOrder();

    logger.info(`[Kernel] Initializing ${initOrder.length} modules...`);

    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);
      if (!module) continue;

      try {
        const start = Date.now();
        await module.initialize();
        const elapsed = Date.now() - start;

        this.health.set(moduleName, {
          status: 'healthy',
          lastCheck: new Date(),
          latencyMs: elapsed,
          dependencies: module.dependencies,
        });

        logger.info(`[Kernel] ✅ ${moduleName} initialized (${elapsed}ms)`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${moduleName}: ${errorMessage}`);

        this.health.set(moduleName, {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: errorMessage,
          dependencies: module.dependencies,
        });

        logger.error(`[Kernel] ❌ ${moduleName} failed to initialize`, { error });
      }
    }

    this.initialized = true;

    // Start periodic health checks
    this.startHealthMonitoring();

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Get initialization order based on dependencies (topological sort)
   */
  private getInitializationOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);
      const module = this.modules.get(name);

      if (module) {
        for (const dep of module.dependencies) {
          if (this.modules.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.modules.keys()) {
      visit(name);
    }

    return order;
  }

  // ============================================
  // HEALTH MONITORING
  // ============================================

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAllHealth().catch(err => {
        logger.error('[Kernel] Health check failed', { error: err });
      });
    }, 30000);
  }

  /**
   * Check health of all modules
   */
  async checkAllHealth(): Promise<Map<string, ModuleHealth>> {
    const results = new Map<string, ModuleHealth>();
    const newlyUnhealthy: string[] = [];

    for (const [name, module] of this.modules) {
      const previousHealth = this.health.get(name);

      try {
        const start = Date.now();
        const health = await module.healthCheck();
        health.latencyMs = Date.now() - start;
        health.lastCheck = new Date();

        results.set(name, health);
        this.health.set(name, health);

        // Track newly unhealthy modules (was healthy/unknown, now unhealthy)
        if (health.status === 'unhealthy' && previousHealth?.status !== 'unhealthy') {
          newlyUnhealthy.push(`${name}: ${health.error || 'Unknown error'}`);
        }
      } catch (error) {
        const errorHealth: ModuleHealth = {
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        results.set(name, errorHealth);
        this.health.set(name, errorHealth);

        if (previousHealth?.status !== 'unhealthy') {
          newlyUnhealthy.push(`${name}: ${errorHealth.error}`);
        }
      }
    }

    // Log any unhealthy modules
    for (const [name, health] of results) {
      if (health.status === 'unhealthy') {
        logger.warn(`[Kernel] Module ${name} is unhealthy`, { error: health.error });
      }
    }

    // Send Telegram alert for newly unhealthy modules
    if (newlyUnhealthy.length > 0) {
      this.sendUnhealthyAlert(newlyUnhealthy).catch(err => {
        logger.error('[Kernel] Failed to send unhealthy alert', { error: err });
      });
    }

    return results;
  }

  /**
   * Send Telegram alert when modules become unhealthy
   */
  private async sendUnhealthyAlert(modules: string[]): Promise<void> {
    try {
      const { notificationService } = await import('../api-lib/services/notifications.js');
      await notificationService.sendAlertToAdmin({
        type: 'system_alert',
        message: `🚨 *SYSTEM ALERT*\n\n❌ Модули в критическом состоянии:\n\n${modules.map(m => `• ${m}`).join('\n')}\n\n⏰ ${new Date().toLocaleString('ru-RU')}`,
        urgency: 'critical',
      });
      logger.info('[Kernel] Unhealthy alert sent to admin');
    } catch (error) {
      logger.error('[Kernel] Failed to send unhealthy alert', { error });
    }
  }

  /**
   * Get current health status of all modules
   */
  getHealth(): Map<string, ModuleHealth> {
    return new Map(this.health);
  }

  /**
   * Get aggregated system health
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    modules: Record<string, ModuleHealth>;
    unhealthyCount: number;
    degradedCount: number;
  } {
    const modules: Record<string, ModuleHealth> = {};
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const [name, health] of this.health) {
      modules[name] = health;
      if (health.status === 'unhealthy') unhealthyCount++;
      if (health.status === 'degraded') degradedCount++;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) status = 'unhealthy';
    else if (degradedCount > 0) status = 'degraded';

    return { status, modules, unhealthyCount, degradedCount };
  }

  // ============================================
  // EVENT BUS (Inter-module communication)
  // ============================================

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit an event to all subscribers
   */
  async emit(event: SystemEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    const wildcardHandlers = this.eventHandlers.get('*') || [];

    const allHandlers = [...handlers, ...wildcardHandlers];

    if (allHandlers.length === 0) {
      logger.debug(`[Kernel] No handlers for event: ${event.type}`);
      return;
    }

    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`[Kernel] Event handler error for ${event.type}`, { error });
      }
    }
  }

  /**
   * Create and emit an event
   */
  async notify(type: string, source: string, payload: unknown): Promise<void> {
    await this.emit({
      type,
      source,
      timestamp: new Date(),
      payload,
      correlationId: crypto.randomUUID(),
    });
  }

  // ============================================
  // SHUTDOWN
  // ============================================

  /**
   * Gracefully shutdown all modules
   */
  async shutdown(): Promise<void> {
    logger.info('[Kernel] Shutting down...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown in reverse initialization order
    const shutdownOrder = this.getInitializationOrder().reverse();

    for (const moduleName of shutdownOrder) {
      const module = this.modules.get(moduleName);
      if (module?.shutdown) {
        try {
          await module.shutdown();
          logger.info(`[Kernel] ${moduleName} shutdown complete`);
        } catch (error) {
          logger.error(`[Kernel] Error shutting down ${moduleName}`, { error });
        }
      }
    }

    this.initialized = false;
    logger.info('[Kernel] Shutdown complete');
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get manifest of all registered modules
   */
  getManifest(): {
    kernel: { version: string; initialized: boolean };
    modules: Array<{
      name: string;
      version: string;
      category: string;
      dependencies: string[];
      health: ModuleHealth;
    }>;
  } {
    const modules = Array.from(this.modules.values()).map(m => ({
      name: m.name,
      version: m.version,
      category: m.category,
      dependencies: m.dependencies,
      health: this.health.get(m.name) || { status: 'unknown' as const, lastCheck: new Date() },
    }));

    return {
      kernel: {
        version: '1.0.0',
        initialized: this.initialized,
      },
      modules,
    };
  }

  /**
   * Generate a visual diagram of module dependencies
   */
  generateDependencyGraph(): string {
    const lines: string[] = ['# System Module Dependencies', ''];

    for (const [name, module] of this.modules) {
      const health = this.health.get(name);
      const icon =
        health?.status === 'healthy'
          ? '✅'
          : health?.status === 'degraded'
            ? '⚠️'
            : health?.status === 'unhealthy'
              ? '❌'
              : '❓';

      lines.push(`${icon} **${name}** (v${module.version})`);

      if (module.dependencies.length > 0) {
        for (const dep of module.dependencies) {
          lines.push(`  └── depends on: ${dep}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const systemKernel = new SystemKernel();

// ============================================
// MODULE FACTORY HELPER
// ============================================

/**
 * Helper to create a module definition
 */
export function defineModule(config: {
  name: string;
  version: string;
  category: SystemModule['category'];
  description: string;
  dependencies?: string[];
  initialize?: () => Promise<void>;
  healthCheck?: () => Promise<ModuleHealth>;
  shutdown?: () => Promise<void>;
}): SystemModule {
  return {
    name: config.name,
    version: config.version,
    category: config.category,
    description: config.description,
    dependencies: config.dependencies || [],
    initialize: config.initialize || (async () => {}),
    healthCheck:
      config.healthCheck ||
      (async () => ({
        status: 'healthy',
        lastCheck: new Date(),
      })),
    shutdown: config.shutdown,
  };
}

// ============================================
// REGISTER CORE MODULES (on import)
// ============================================

// These will be registered when modules are loaded
// Example usage in each module:
//
// systemKernel.register(defineModule({
//   name: 'StateManager',
//   version: '5.0.0',
//   category: 'core',
//   description: 'Manages user state across sessions',
//   dependencies: ['Database'],
//   initialize: async () => { await stateManager.lazyEnsureTableExists(); },
//   healthCheck: async () => { return { status: 'healthy', lastCheck: new Date() }; },
// }));
