// ============================================
// NeuroGUARDIAN — Tool Registry
// Extensible tool registration system
// One class = one responsibility: manage tools
// Version: 5.0.0 | Date: January 2026
// ============================================

import type { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../../core/types/agent.types.js';

/**
 * Error thrown when a tool is not found
 */
export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Error thrown when tool arguments are invalid
 */
export class ToolValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(toolName: string, issues: z.ZodIssue[]) {
    super(`Invalid arguments for tool ${toolName}: ${issues.map(i => i.message).join(', ')}`);
    this.name = 'ToolValidationError';
    this.issues = issues;
  }
}

/**
 * Tool Registry - Central registry for all agent tools
 *
 * Design principles:
 * - Easy to add new tools (just register)
 * - Automatic validation via Zod schemas
 * - Dynamic prompt generation
 * - Categorization for filtering
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a new tool
   */
  register<TArgs>(tool: ToolDefinition<TArgs>): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: 'read' | 'write' | 'analyze' | 'search'): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  /**
   * Execute a tool with validation
   */
  async execute(
    toolName: string,
    userId: number,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    // Validate arguments
    const validation = tool.schema.safeParse(args);
    if (!validation.success) {
      throw new ToolValidationError(toolName, validation.error.issues);
    }

    // Execute
    try {
      const result = await tool.execute(userId, validation.data);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate tool descriptions for the prompt
   *
   * @param categories - Optional filter by categories
   * @param includeExamples - Include usage examples
   */
  generatePrompt(options?: {
    categories?: ('read' | 'write' | 'analyze' | 'search')[];
    includeExamples?: boolean;
  }): string {
    const { categories, includeExamples = false } = options || {};

    let tools = Array.from(this.tools.values());

    if (categories && categories.length > 0) {
      tools = tools.filter(t => categories.includes(t.category));
    }

    const lines: string[] = ['## ДОСТУПНЫЕ ИНСТРУМЕНТЫ:\n'];

    // Group by category
    const byCategory = new Map<string, ToolDefinition[]>();
    for (const tool of tools) {
      const cat = tool.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(tool);
    }

    const categoryNames: Record<string, string> = {
      read: '📖 Чтение данных',
      write: '✏️ Изменение данных',
      analyze: '📊 Аналитика',
      search: '🔍 Поиск',
    };

    for (const [category, categoryTools] of byCategory) {
      lines.push(`### ${categoryNames[category] || category}\n`);

      for (const tool of categoryTools) {
        lines.push(`- **${tool.name}**: ${tool.description}`);

        if (tool.requiresConfirmation) {
          lines.push(`  ⚠️ Требует подтверждения пользователя`);
        }

        if (includeExamples && tool.examples && tool.examples.length > 0) {
          lines.push(`  Примеры:`);
          for (const example of tool.examples.slice(0, 2)) {
            lines.push(`    • ${example}`);
          }
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON schema for structured output
   */
  generateToolNamesEnum(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools that require confirmation
   */
  getConfirmationTools(): string[] {
    return Array.from(this.tools.values())
      .filter(t => t.requiresConfirmation)
      .map(t => t.name);
  }

  /**
   * Get statistics about registered tools
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const stats = {
      total: this.tools.size,
      byCategory: {} as Record<string, number>,
    };

    for (const tool of this.tools.values()) {
      stats.byCategory[tool.category] = (stats.byCategory[tool.category] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();

// ============================================
// Helper function to create a tool definition
// ============================================

/**
 * Helper to create strongly-typed tool definitions
 */
export function defineTool<TArgs>(
  definition: Omit<ToolDefinition<TArgs>, 'execute'> & {
    execute: (userId: number, args: TArgs) => Promise<ToolResult>;
  }
): ToolDefinition<TArgs> {
  return definition as ToolDefinition<TArgs>;
}
