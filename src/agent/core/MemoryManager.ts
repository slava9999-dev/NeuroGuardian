// ============================================
// NeuroGUARDIAN — Memory Manager
// Professional Architecture v5
// ============================================

import { sql } from '../../api-lib/services/database.js';
import type { AgentMessage } from '../../core/types/index.js';

export type FactType =
  | 'user_preference' // "Пользователь предпочитает краткие ответы"
  | 'product_info' // "Себестоимость рейлингов = 500₽"
  | 'business_rule' // "Минимальная маржа 15%"
  | 'resolved_issue'; // "Проблема с ценой товара X решена"

export interface MemoryFact {
  id: string;
  userId: number;
  type: FactType;
  content: string;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

export interface MemorySummary {
  userId: number;
  totalFacts: number;
  lastSummaryAt: Date;
  summary: string;
}

interface DBMemoryMessage {
  id: number;
  user_id: number;
  role: string;
  content: string;
  timestamp: string;
  created_at: string;
}

interface DBMemoryFact {
  id: string;
  user_id: number;
  type: FactType;
  content: string;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
}

export class MemoryManager {
  private readonly MESSAGES_TABLE = 'agent_messages';
  private readonly FACTS_TABLE = 'memory_facts';
  private readonly SUMMARIES_TABLE = 'memory_summaries';

  constructor() {
    this.ensureTablesExist();
  }

  /**
   * Ensure all memory tables exist
   */
  private async ensureTablesExist(): Promise<void> {
    try {
      // Messages table
      await sql`
        CREATE TABLE IF NOT EXISTS ${sql(this.MESSAGES_TABLE)} (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `;

      // Facts table
      await sql`
        CREATE TABLE IF NOT EXISTS ${sql(this.FACTS_TABLE)} (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          access_count INTEGER NOT NULL DEFAULT 0
        )
      `;

      // Summaries table
      await sql`
        CREATE TABLE IF NOT EXISTS ${sql(this.SUMMARIES_TABLE)} (
          user_id INTEGER PRIMARY KEY,
          total_facts INTEGER NOT NULL DEFAULT 0,
          last_summary_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          summary TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `;
    } catch (error) {
      console.error('Failed to create memory tables:', error);
    }
  }

  /**
   * Save message to short-term memory
   */
  async saveMessage(userId: number, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      await sql`
        INSERT INTO ${sql(this.MESSAGES_TABLE)} (user_id, role, content)
        VALUES (${userId}, ${role}, ${content})
      `;
    } catch (error) {
      console.error(`Failed to save message for user ${userId}:`, error);
    }
  }

  /**
   * Get recent conversation history
   */
  async getRecentHistory(userId: number, limit: number = 5): Promise<AgentMessage[]> {
    try {
      const result = await sql`
        SELECT * FROM ${sql(this.MESSAGES_TABLE)}
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      return result.rows.map((row: DBMemoryMessage) => ({
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
        timestamp: new Date(row.timestamp),
        userId: row.user_id,
      }));
    } catch (error) {
      console.error(`Failed to get history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Save important fact to long-term memory
   */
  async saveImportantFact(
    userId: number,
    fact: string,
    type: FactType,
    overwriteExisting: boolean = false
  ): Promise<void> {
    try {
      const factId = this.generateFactId(userId, type, fact);

      if (overwriteExisting) {
        await sql`
          INSERT INTO ${sql(this.FACTS_TABLE)} (id, user_id, type, content)
          VALUES (${factId}, ${userId}, ${type}, ${fact})
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            last_accessed_at = NOW(),
            access_count = facts.access_count + 1
        `;
      } else {
        await sql`
          INSERT INTO ${sql(this.FACTS_TABLE)} (id, user_id, type, content)
          VALUES (${factId}, ${userId}, ${type}, ${fact})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    } catch (error) {
      console.error(`Failed to save fact for user ${userId}:`, error);
    }
  }

  /**
   * Search for relevant facts using simple keyword matching
   */
  async searchRelevantFacts(userId: number, query: string): Promise<string[]> {
    try {
      const keywords = this.extractKeywords(query);
      const pattern = keywords.join('|');

      const result = await sql`
        SELECT content FROM ${sql(this.FACTS_TABLE)}
        WHERE user_id = ${userId}
        AND content ~* ${pattern}
        ORDER BY last_accessed_at DESC, access_count DESC
        LIMIT 5
      `;

      return result.rows.map((row: { content: string }) => row.content);
    } catch (error) {
      console.error(`Failed to search facts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user preferences from memory
   */
  async getUserPreferences(userId: number): Promise<Record<string, string>> {
    try {
      const result = await sql`
        SELECT content FROM ${sql(this.FACTS_TABLE)}
        WHERE user_id = ${userId} AND type = 'user_preference'
        ORDER BY last_accessed_at DESC
        LIMIT 10
      `;

      const preferences: Record<string, string> = {};
      result.rows.forEach((row: { content: string }) => {
        const parts = row.content.split(':');
        const key = parts[0];
        const value = parts.slice(1).join(':').trim();

        if (key && value) {
          preferences[key.trim()] = value;
        }
      });

      return preferences;
    } catch (error) {
      console.error(`Failed to get preferences for user ${userId}:`, error);
      return {};
    }
  }

  /**
   * Update fact access statistics
   */
  async accessFact(factId: string): Promise<void> {
    try {
      await sql`
        UPDATE ${sql(this.FACTS_TABLE)}
        SET last_accessed_at = NOW(), access_count = access_count + 1
        WHERE id = ${factId}
      `;
    } catch (error) {
      console.error(`Failed to update fact access ${factId}:`, error);
    }
  }

  /**
   * Summarize and archive old memories
   */
  async summarizeAndArchive(userId: number): Promise<void> {
    try {
      // Get all facts for user
      const factsResult = await sql`
        SELECT * FROM ${sql(this.FACTS_TABLE)}
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;

      if (factsResult.rows.length === 0) return;

      // Create summary
      const summary = this.createMemorySummary(factsResult.rows);

      // Save or update summary
      await sql`
        INSERT INTO ${sql(this.SUMMARIES_TABLE)} (
          user_id, total_facts, summary
        ) VALUES (
          ${userId}, ${factsResult.rows.length}, ${summary}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          total_facts = EXCLUDED.total_facts,
          summary = EXCLUDED.summary,
          updated_at = NOW()
      `;

      // Archive old messages (keep last 50)
      await sql`
        DELETE FROM ${sql(this.MESSAGES_TABLE)}
        WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM ${sql(this.MESSAGES_TABLE)}
          WHERE user_id = ${userId}
          ORDER BY timestamp DESC
          LIMIT 50
        )
      `;
    } catch (error) {
      console.error(`Failed to summarize memory for user ${userId}:`, error);
    }
  }

  /**
   * Clear user memory (for testing or user request)
   */
  async clearMemory(userId: number): Promise<void> {
    try {
      await sql`DELETE FROM ${sql(this.MESSAGES_TABLE)} WHERE user_id = ${userId}`;
      await sql`DELETE FROM ${sql(this.FACTS_TABLE)} WHERE user_id = ${userId}`;
      await sql`DELETE FROM ${sql(this.SUMMARIES_TABLE)} WHERE user_id = ${userId}`;
    } catch (error) {
      console.error(`Failed to clear memory for user ${userId}:`, error);
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(userId: number): Promise<{
    messageCount: number;
    factCount: number;
    lastSummaryAt?: Date;
  }> {
    try {
      const [messagesResult, factsResult, summaryResult] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM ${sql(this.MESSAGES_TABLE)} WHERE user_id = ${userId}`,
        sql`SELECT COUNT(*) as count FROM ${sql(this.FACTS_TABLE)} WHERE user_id = ${userId}`,
        sql`SELECT last_summary_at FROM ${sql(this.SUMMARIES_TABLE)} WHERE user_id = ${userId}`,
      ]);

      return {
        messageCount: parseInt(messagesResult.rows[0]?.count || '0'),
        factCount: parseInt(factsResult.rows[0]?.count || '0'),
        lastSummaryAt: summaryResult.rows[0]?.last_summary_at
          ? new Date(summaryResult.rows[0].last_summary_at)
          : undefined,
      };
    } catch (error) {
      console.error(`Failed to get memory stats for user ${userId}:`, error);
      return { messageCount: 0, factCount: 0 };
    }
  }

  /**
   * Generate unique fact ID
   */
  private generateFactId(userId: number, type: FactType, content: string): string {
    const hash = this.simpleHash(content);
    return `${userId}_${type}_${hash}`;
  }

  /**
   * Simple hash function for content
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract keywords from query for search
   */
  private extractKeywords(query: string): string[] {
    const stopWords = [
      'и',
      'в',
      'на',
      'с',
      'по',
      'для',
      'от',
      'до',
      'из',
      'за',
      'под',
      'над',
      'про',
      'к',
      'у',
      'а',
      'но',
      'а',
      'же',
      'то',
      'что',
      'как',
      'где',
      'когда',
      'почему',
      'кто',
      'что',
      'какой',
      'какая',
      'какое',
      'какие',
    ];

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 5);
  }

  /**
   * Create memory summary from facts
   */
  private createMemorySummary(facts: DBMemoryFact[]): string {
    const userPrefs: string[] = [];
    const productInfo: string[] = [];
    const businessRules: string[] = [];
    const resolvedIssues: string[] = [];

    facts.forEach(fact => {
      switch (fact.type) {
        case 'user_preference':
          userPrefs.push(fact.content);
          break;
        case 'product_info':
          productInfo.push(fact.content);
          break;
        case 'business_rule':
          businessRules.push(fact.content);
          break;
        case 'resolved_issue':
          resolvedIssues.push(fact.content);
          break;
      }
    });

    const parts = [];
    if (userPrefs.length > 0) parts.push(`Предпочтения: ${userPrefs.slice(0, 3).join(', ')}`);
    if (productInfo.length > 0) parts.push(`Товары: ${productInfo.slice(0, 3).join(', ')}`);
    if (businessRules.length > 0) parts.push(`Правила: ${businessRules.slice(0, 3).join(', ')}`);
    if (resolvedIssues.length > 0) parts.push(`Решения: ${resolvedIssues.slice(0, 3).join(', ')}`);

    return parts.join(' | ');
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
