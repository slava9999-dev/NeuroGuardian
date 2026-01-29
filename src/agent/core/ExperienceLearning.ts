// ============================================
// NeuroGUARDIAN — Experience Learning Manager
// Learns from user interactions to improve agent
// Version: 1.1.0 | Date: January 2026
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
 * Simple in-memory cache for leaning records
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class LearningCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

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
 * Statistics for experiences
 */
export interface ExperienceStats {
  total: number;
  byType: Record<string, number>;
  recentIssues: number;
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
  /не(?:\s+)?то/i,
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
  /ты(?:\s+)?ошибся/i,
  /ошибаешься/i,
  /неверно/i,
  /не(?:\s+)?правда/i,
  /на(?:\s+)?самом(?:\s+)?деле/i,
  /цифры(?:\s+)?другие/i,
];

/**
 * Experience Learning Manager
 * Analyzes conversations to find patterns and improve agent
 */
export class ExperienceLearningManager {
  private tablesChecked = false;
  private learningsCache = new LearningCache<ExperienceRecord[]>();
  private statsCache = new LearningCache<ExperienceStats>();

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

      // Migration: Add issue and resolution columns if they don't exist
      await sql`
        ALTER TABLE agent_experiences 
        ADD COLUMN IF NOT EXISTS issue TEXT,
        ADD COLUMN IF NOT EXISTS resolution TEXT
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
    previousAgentMessage?: string,
    validationIssues?: string[]
  ): Promise<void> {
    await this.ensureTablesExist();

    try {
      // 1. Detect experience type
      let experienceType = this.detectExperienceType(
        userMessage,
        agentResponse,
        previousAgentMessage
      );

      let issue: string | undefined;
      let resolution: string | undefined;

      // 2. Override with validation issues if any
      if (validationIssues && validationIssues.length > 0) {
        experienceType = 'agent_mistake';
        issue = `Ответ не прошел валидацию: ${validationIssues.join('; ')}`;
        resolution = 'Соблюдай правила форматирования, проверяй ссылки и не галлюцинируй.';
      }

      if (!experienceType) return;

      // Extract tags from the conversation
      const tags = this.extractTags(userMessage + ' ' + agentResponse);

      // Generate unique ID based on content (with space to avoid word merging)
      const id = this.generateExperienceId(experienceType, userMessage + ' ' + (issue || ''));

      // Clear related cache
      this.learningsCache.clear();

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
          INSERT INTO agent_experiences (id, type, user_query, agent_response, issue, resolution, tags)
          VALUES (${id}, ${experienceType}, ${userMessage}, ${agentResponse}, ${issue}, ${resolution}, ${tags})
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

      this.learningsCache.clear();
      logger.info('[ExperienceLearning] Issue recorded with resolution', { type, issue });
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to record issue:', error);
    }
  }

  /**
   * Get relevant learnings for a query
   */
  async getRelevantLearnings(query: string, limit: number = 5): Promise<ExperienceRecord[]> {
    await this.ensureTablesExist();

    try {
      const keywords = this.extractKeywords(query);
      if (keywords.length === 0) return [];

      const cacheKey = `learnings_${keywords.join('_')}`;
      const cached = this.learningsCache.get(cacheKey);
      if (cached) return cached;

      const pattern = keywords.join('|');

      const result = await sql`
        SELECT * FROM agent_experiences
        WHERE (user_query ~* ${pattern} OR issue ~* ${pattern})
        AND (type = 'agent_mistake' OR type = 'user_correction' OR type = 'successful_resolution')
        ORDER BY frequency DESC, updated_at DESC
        LIMIT ${limit}
      `;

      const learnings = result.rows.map(row => this.mapRowToExperience(row));
      this.learningsCache.set(cacheKey, learnings);
      return learnings;
    } catch (error) {
      logger.error('[ExperienceLearning] Failed to get learnings:', error);
      return [];
    }
  }

  /**
   * Generate learning context for agent prompt
   */
  async generateLearningContext(query: string): Promise<string> {
    const learnings = await this.getRelevantLearnings(query, 3);
    if (learnings.length === 0) return '';

    // Sort by frequency to prioritize most critical/common ones
    learnings.sort((a, b) => b.frequency - a.frequency);

    const lines: string[] = ['## 🧠 ОПЫТ (УЧТИ ЭТО)'];
    lines.push('Твои прошлые ошибки и удачные решения для аналогичных запросов:');

    for (const learning of learnings) {
      if (learning.type === 'agent_mistake' && learning.issue) {
        lines.push(`- ❌ ИЗОЛИРУЙ ОШИБКУ: ${learning.issue}`);
        if (learning.resolution) lines.push(`  КАК НАДО: ${learning.resolution}`);
      } else if (learning.type === 'user_correction') {
        lines.push(`- 💡 ПРАВИЛО ОТ ЮЗЕРА: "${learning.userQuery}"`);
      } else if (learning.type === 'successful_resolution') {
        const resolution = learning.resolution || learning.agentResponse.substring(0, 100);
        lines.push(`- ✅ ЛУЧШАЯ ПРАКТИКА: ${resolution}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get experience statistics
   */
  async getStats(): Promise<ExperienceStats> {
    await this.ensureTablesExist();

    try {
      const cacheKey = 'stats';
      const cached = this.statsCache.get(cacheKey);
      if (cached) return cached;

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

      const stats = {
        total: parseInt(totalResult.rows[0]?.count || '0'),
        byType,
        recentIssues: parseInt(recentResult.rows[0]?.count || '0'),
      };

      this.statsCache.set(cacheKey, stats);
      return stats;
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
    // 1. Check for correction
    if (previousAgentMessage) {
      for (const pattern of CORRECTION_PATTERNS) {
        if (pattern.test(userMessage)) return 'user_correction';
      }
    }

    // 2. Check for complaint/negative feedback
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(userMessage)) return 'user_complaint';
    }

    // 3. Check for positive feedback
    for (const pattern of POSITIVE_PATTERNS) {
      if (pattern.test(userMessage)) return 'successful_resolution';
    }

    // 4. Check if it's a potential FAQ
    if (userMessage.includes('?') || /^(как|что|где|когда|почему|зачем|какой)/i.test(userMessage)) {
      return 'faq_question';
    }

    return null;
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    if (/ozon|озон/i.test(text)) tags.push('ozon');
    if (/wb|wildberries|вайлдберриз/i.test(text)) tags.push('wb');
    if (/цен[аыу]|price|прайс/i.test(text)) tags.push('prices');
    if (/остат|сток|stock/i.test(text)) tags.push('stocks');
    if (/акци[яию]|скидк/i.test(text)) tags.push('promotions');
    if (/sentinel|сторож|защит/i.test(text)) tags.push('sentinel');
    return tags.slice(0, 5);
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
      'тебе',
      'тебя',
      'вам',
      'вас',
      'есть',
      'было',
      'будет',
      'нужно',
      'хочу',
      'сделай',
      'покажи',
      'расскажи',
      'дай',
      'плиз',
      'пожалуйста',
      'если',
      'или',
      'но',
      'да',
      'нет',
      'под',
      'над',
    ];

    return query
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2 && !stopWords.includes(word))
      .sort()
      .slice(0, 7);
  }

  private generateExperienceId(type: ExperienceType, content: string): string {
    // 1. Extract and sort keywords for perfect deduplication
    const keywords = this.extractKeywords(content);
    const normalized = keywords.length > 0 ? keywords.join('_') : 'fallback';

    // 2. Generate hash from type + stable keywords
    let hash = 0;
    const str = `${type}_${normalized}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `exp_${type}_${Math.abs(hash).toString(36)}`;
  }

  private mapRowToExperience(row: {
    id: string;
    type: string;
    user_query: string;
    agent_response: string;
    issue: string | null;
    resolution: string | null;
    tags: string[] | null;
    created_at: Date | string;
    frequency: number;
  }): ExperienceRecord {
    return {
      id: row.id,
      type: row.type as ExperienceType,
      userQuery: row.user_query,
      agentResponse: row.agent_response,
      issue: row.issue || undefined,
      resolution: row.resolution || undefined,
      tags: row.tags || [],
      createdAt: new Date(row.created_at),
      frequency: row.frequency,
    };
  }
}

export const experienceLearning = new ExperienceLearningManager();
