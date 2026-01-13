// ============================================
// NeuroGUARDIAN — Experience Learning Manager
// Learns from user interactions to improve agent
// Version: 1.0.0 | Date: January 2026
// ============================================

import { sql } from '../../api-lib/services/database.js';
import { logger } from '../../api-lib/lib/logger.js';

/**
 * Experience categories for learning
 */
export type ExperienceType =
  | 'user_complaint' // Жалоба пользователя
  | 'agent_mistake' // Ошибка агента
  | 'successful_resolution' // Успешное решение
  | 'user_correction' // Пользователь исправил агента
  | 'feature_request' // Запрос на функцию
  | 'faq_question'; // Часто задаваемый вопрос

/**
 * Experience record for learning
 */
export interface ExperienceRecord {
  id: string;
  type: ExperienceType;
  userQuery: string;
  agentResponse: string;
  issue?: string;
  resolution?: string;
  tags: string[];
  createdAt: Date;
  frequency: number;
}

/**
 * Patterns to detect user dissatisfaction
 */
const NEGATIVE_PATTERNS = [
  /не(?:\s+)?понял/i,
  /не(?:\s+)?работает/i,
  /неправильно/i,
  /ошибка/i,
  /почему(?:\s+)?не/i,
  /это(?:\s+)?не(?:\s+)?то/i,
  /я(?:\s+)?спрашивал(?:\s+)?другое/i,
  /ты(?:\s+)?не(?:\s+)?прав/i,
  /опять/i,
  /снова/i,
  /бесполезно/i,
  /не(?:\s+)?помогает/i,
  /плохо/i,
  /отстой/i,
];

/**
 * Patterns to detect successful interactions
 */
const POSITIVE_PATTERNS = [
  /спасибо/i,
  /отлично/i,
  /супер/i,
  /круто/i,
  /помогло/i,
  /сработало/i,
  /понял/i,
  /да,(?:\s+)?верно/i,
  /именно/i,
  /то(?:\s+)?что(?:\s+)?нужно/i,
  /молодец/i,
  /класс/i,
];

/**
 * Patterns to detect correction
 */
const CORRECTION_PATTERNS = [
  /нет,(?:\s+)?я(?:\s+)?имею(?:\s+)?в(?:\s+)?виду/i,
  /не(?:\s+)?так,/i,
  /я(?:\s+)?говорил(?:\s+)?о/i,
  /я(?:\s+)?спрашивал(?:\s+)?про/i,
  /правильный(?:\s+)?ответ/i,
  /на(?:\s+)?самом(?:\s+)?деле/i,
];

/**
 * Experience Learning Manager
 * Analyzes conversations to find patterns and improve agent
 */
export class ExperienceLearningManager {
  private tablesChecked = false;

  /**
   * Ensure experience tables exist
   */
  private async ensureTablesExist(): Promise<void> {
    if (this.tablesChecked) return;

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS agent_experiences (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          user_query TEXT NOT NULL,
          agent_response TEXT NOT NULL,
          issue TEXT,
          resolution TEXT,
          tags TEXT[],
          frequency INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;

      // Index for fast searching
      try {
        await sql`
          CREATE INDEX IF NOT EXISTS idx_experiences_type 
          ON agent_experiences(type)
        `;
        await sql`
          CREATE INDEX IF NOT EXISTS idx_experiences_created 
          ON agent_experiences(created_at DESC)
        `;
      } catch {
        // Index might already exist
      }

      this.tablesChecked = true;
      logger.info('[ExperienceLearning] Tables initialized');
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to create tables:', error);
    }
  }

  /**
   * Analyze a conversation turn for learning opportunities
   */
  async analyzeInteraction(
    userId: number,
    userMessage: string,
    agentResponse: string,
    previousAgentMessage?: string
  ): Promise<void> {
    await this.ensureTablesExist();

    try {
      // Detect interaction type
      const experienceType = this.detectExperienceType(
        userMessage,
        agentResponse,
        previousAgentMessage
      );

      if (!experienceType) return; // Nothing noteworthy

      // Extract tags from the conversation
      const tags = this.extractTags(userMessage + ' ' + agentResponse);

      // Generate unique ID based on content
      const id = this.generateExperienceId(experienceType, userMessage);

      // Check if similar experience exists
      const existing = await sql`
        SELECT id, frequency FROM agent_experiences
        WHERE id = ${id}
      `;

      if (existing.rows.length > 0) {
        // Update frequency
        await sql`
          UPDATE agent_experiences
          SET frequency = frequency + 1,
              updated_at = NOW()
          WHERE id = ${id}
        `;
        logger.debug('[ExperienceLearning] Incremented frequency for existing experience', { id });
      } else {
        // Insert new experience
        await sql`
          INSERT INTO agent_experiences (id, type, user_query, agent_response, tags)
          VALUES (${id}, ${experienceType}, ${userMessage}, ${agentResponse}, ${tags})
        `;
        logger.info('[ExperienceLearning] New experience recorded', {
          type: experienceType,
          userId,
        });
      }
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to analyze interaction:', error);
    }
  }

  /**
   * Record an explicit issue with resolution
   */
  async recordIssue(
    issue: string,
    resolution: string,
    userQuery: string,
    type: ExperienceType = 'agent_mistake'
  ): Promise<void> {
    await this.ensureTablesExist();

    try {
      const id = this.generateExperienceId(type, issue);
      const tags = this.extractTags(issue + ' ' + resolution);

      await sql`
        INSERT INTO agent_experiences (id, type, user_query, agent_response, issue, resolution, tags)
        VALUES (${id}, ${type}, ${userQuery}, ${resolution}, ${issue}, ${resolution}, ${tags})
        ON CONFLICT (id) DO UPDATE SET
          resolution = EXCLUDED.resolution,
          frequency = agent_experiences.frequency + 1,
          updated_at = NOW()
      `;

      logger.info('[ExperienceLearning] Issue recorded with resolution', { type, issue });
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to record issue:', error);
    }
  }

  /**
   * Get relevant learnings for a query
   * Used by agent to avoid past mistakes
   */
  async getRelevantLearnings(query: string, limit: number = 5): Promise<ExperienceRecord[]> {
    await this.ensureTablesExist();

    try {
      const keywords = this.extractKeywords(query);
      if (keywords.length === 0) return [];

      const pattern = keywords.join('|');

      const result = await sql`
        SELECT * FROM agent_experiences
        WHERE (user_query ~* ${pattern} OR issue ~* ${pattern})
        AND (type = 'agent_mistake' OR type = 'user_correction' OR type = 'successful_resolution')
        ORDER BY frequency DESC, updated_at DESC
        LIMIT ${limit}
      `;

      return result.rows.map(this.mapRowToExperience);
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to get learnings:', error);
      return [];
    }
  }

  /**
   * Get common mistakes to avoid
   */
  async getCommonMistakes(limit: number = 10): Promise<ExperienceRecord[]> {
    await this.ensureTablesExist();

    try {
      const result = await sql`
        SELECT * FROM agent_experiences
        WHERE type IN ('agent_mistake', 'user_correction', 'user_complaint')
        ORDER BY frequency DESC
        LIMIT ${limit}
      `;

      return result.rows.map(this.mapRowToExperience);
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to get common mistakes:', error);
      return [];
    }
  }

  /**
   * Get FAQ questions (frequently asked)
   */
  async getFrequentQuestions(limit: number = 20): Promise<ExperienceRecord[]> {
    await this.ensureTablesExist();

    try {
      const result = await sql`
        SELECT * FROM agent_experiences
        WHERE type = 'faq_question' AND frequency >= 2
        ORDER BY frequency DESC
        LIMIT ${limit}
      `;

      return result.rows.map(this.mapRowToExperience);
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to get FAQ:', error);
      return [];
    }
  }

  /**
   * Generate learning context for agent prompt
   */
  async generateLearningContext(query: string): Promise<string> {
    const learnings = await this.getRelevantLearnings(query, 3);

    if (learnings.length === 0) return '';

    const lines: string[] = ['## 📚 ОБУЧЕНИЕ НА ОПЫТЕ'];
    lines.push('Из прошлых взаимодействий учти следующее:');

    for (const learning of learnings) {
      if (learning.type === 'agent_mistake' && learning.resolution) {
        lines.push(`- ⚠️ Ошибка: "${learning.issue}" → Правильно: "${learning.resolution}"`);
      } else if (learning.type === 'user_correction') {
        lines.push(`- ✏️ Пользователи уточняют: "${learning.userQuery}" → Помни это при ответе`);
      } else if (learning.type === 'successful_resolution') {
        lines.push(`- ✅ Успешное решение: "${learning.resolution}"`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get experience statistics
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    recentIssues: number;
  }> {
    await this.ensureTablesExist();

    try {
      const [totalResult, byTypeResult, recentResult] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM agent_experiences`,
        sql`
          SELECT type, COUNT(*) as count 
          FROM agent_experiences 
          GROUP BY type
        `,
        sql`
          SELECT COUNT(*) as count 
          FROM agent_experiences 
          WHERE type IN ('agent_mistake', 'user_complaint') 
          AND created_at > NOW() - INTERVAL '7 days'
        `,
      ]);

      const byType: Record<string, number> = {};
      byTypeResult.rows.forEach((row: { type: string; count: string }) => {
        byType[row.type] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0]?.count || '0'),
        byType,
        recentIssues: parseInt(recentResult.rows[0]?.count || '0'),
      };
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to get stats:', error);
      return { total: 0, byType: {}, recentIssues: 0 };
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private detectExperienceType(
    userMessage: string,
    _agentResponse: string,
    previousAgentMessage?: string
  ): ExperienceType | null {
    // Check for correction (user correcting agent after agent's response)
    if (previousAgentMessage) {
      for (const pattern of CORRECTION_PATTERNS) {
        if (pattern.test(userMessage)) {
          return 'user_correction';
        }
      }
    }

    // Check for complaint
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(userMessage)) {
        return 'user_complaint';
      }
    }

    // Check for positive feedback (successful resolution)
    for (const pattern of POSITIVE_PATTERNS) {
      if (pattern.test(userMessage)) {
        return 'successful_resolution';
      }
    }

    // Check if it's a question (potential FAQ)
    if (userMessage.includes('?') || /^(как|что|где|когда|почему|зачем|какой)/i.test(userMessage)) {
      return 'faq_question';
    }

    return null;
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];

    // Marketplace tags
    if (/ozon|озон/i.test(text)) tags.push('ozon');
    if (/wb|wildberries|вайлдберриз/i.test(text)) tags.push('wb');

    // Topic tags
    if (/цен[аыу]|price|прайс/i.test(text)) tags.push('prices');
    if (/комисс/i.test(text)) tags.push('commissions');
    if (/логистик/i.test(text)) tags.push('logistics');
    if (/остат|сток|stock/i.test(text)) tags.push('stocks');
    if (/акци[яию]|скидк/i.test(text)) tags.push('promotions');
    if (/отзыв|рейтинг/i.test(text)) tags.push('reviews');
    if (/карантин/i.test(text)) tags.push('quarantine');
    if (/min.?price|минимальн.*цен/i.test(text)) tags.push('min_price');
    if (/sentinel|сторож|защит/i.test(text)) tags.push('sentinel');

    return tags.slice(0, 5); // Max 5 tags
  }

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
      'это',
      'что',
      'как',
      'где',
      'мне',
      'мой',
      'моя',
      'моё',
      'мои',
    ];

    return query
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 5);
  }

  private generateExperienceId(type: ExperienceType, content: string): string {
    let hash = 0;
    const str = `${type}_${content}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `exp_${type}_${Math.abs(hash).toString(36)}`;
  }

  private mapRowToExperience(row: Record<string, unknown>): ExperienceRecord {
    return {
      id: row.id as string,
      type: row.type as ExperienceType,
      userQuery: row.user_query as string,
      agentResponse: row.agent_response as string,
      issue: row.issue as string | undefined,
      resolution: row.resolution as string | undefined,
      tags: (row.tags as string[]) || [],
      createdAt: new Date(row.created_at as string),
      frequency: row.frequency as number,
    };
  }
}

// Export singleton instance
export const experienceLearning = new ExperienceLearningManager();
