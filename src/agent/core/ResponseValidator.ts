// ============================================
// NeuroGUARDIAN — Response Validator (Guardrails)
// Validates agent responses before sending to user
// Version: 1.2.0 | Date: January 2026
// ============================================

import { logger } from '../../api-lib/lib/logger.js';
import { validationLogService } from '../../api-lib/services/validation-log.service.js';
import { llmRouter } from '../../infrastructure/llm/LLMRouter.js';

/**
 * Validation result with detailed feedback
 */
export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
  correctedResponse?: string;
  metrics?: ValidationMetrics;
}

export interface ValidationIssue {
  type:
    | 'hallucination'
    | 'irrelevant'
    | 'unsafe'
    | 'quality'
    | 'factual'
    | 'tone'
    | 'link'
    | 'confidentiality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: string;
}

/**
 * Validation metrics for monitoring
 */
export interface ValidationMetrics {
  totalValidations: number;
  passed: number;
  failed: number;
  criticalRejections: number;
  avgScore: number;
}

/**
 * Validation context for checking
 */
export interface ValidationContext {
  userQuery: string;
  toolResults?: Array<{ tool: string; success: boolean; data?: unknown }>;
  userHistory?: string[];
  marketplace?: 'wb' | 'ozon';
  userId?: string; // For DB logging
}

/**
 * Patterns for detecting issues
 */
const HALLUCINATION_PATTERNS = [
  // Links that shouldn't exist
  /(?<!docs\.|api\.|support\.)example\.com/i,
  /http:\/\/localhost/i,
  // Made up statistics without source
  /по данным (?!нашей|системы|NeuroGUARDIAN|результат)/i,
  // Fake percentages
  /\d{3,}%/i, // No 1000% etc
];

const UNSAFE_PATTERNS = [
  // Financial manipulation
  /гарантир[а-яё]* прибыль/i,
  /100%\s*(?:гарантия|результат|успех)/i,
  // Legal issues
  /обход[а-яё]*\s*(?:закон|налог|правил)/i,
  /обой(?:ти|дет|дём)[а-яё]*\s*(?:закон|налог|правил)/i,
  // Competitor bashing
  /(?:конкурент|другие сервисы)\s*(?:обман|мошенн|плох)/i,
];

const OFF_TOPIC_TRIGGERS = [
  // Completely off-topic
  /расскаж[а-яё]*\s*(?:анекдот|шутк|историю не по теме)/i,
  /(?:погода|новости|политика)\s*(?:сегодня|сейчас)/i,
];

const QUALITY_ISSUES = [
  // Too short for complex questions
  { pattern: /^.{1,20}$/s, issue: 'Слишком короткий ответ' },
  // Repetitive text
  { pattern: /(.{20,})\1{2,}/s, issue: 'Повторяющийся текст' },
  // Incomplete sentences
  { pattern: /\.\.\.$/m, issue: 'Незаконченное предложение' },
];

/**
 * Known facts for fact-checking
 */
const KNOWN_FACTS = {
  ozon_card_fee: 5, // 5% always from seller (not 10%!)
  wb_spp_max: 30, // Max 30% SPP
  max_commission: 50, // No commission above 50%
  min_commission: 0, // No negative commission
};

/**
 * Critical fallback message when response is too dangerous
 */
const CRITICAL_FALLBACK =
  'Не удалось сформировать корректный ответ. Пожалуйста, переформулируйте вопрос или обратитесь в поддержку.';

/**
 * Response Validator
 * Checks agent responses before sending
 */
export class ResponseValidator {
  // In-memory metrics (reset on restart)
  private metrics: ValidationMetrics = {
    totalValidations: 0,
    passed: 0,
    failed: 0,
    criticalRejections: 0,
    avgScore: 100,
  };
  /**
   * Main validation entry point
   */
  async validate(response: string, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Track validation
    this.metrics.totalValidations++;

    // 1. Check for hallucinations
    const hallucinationIssues = this.checkHallucinations(response);
    issues.push(...hallucinationIssues);

    // 2. Check relevance
    const relevanceIssues = this.checkRelevance(response, context);
    issues.push(...relevanceIssues);

    // 3. Check safety
    const safetyIssues = this.checkSafety(response);
    issues.push(...safetyIssues);

    // 4. Check quality
    const qualityIssues = this.checkQuality(response, context);
    issues.push(...qualityIssues);

    // 5. Check factual accuracy
    const factualIssues = this.checkFacts(response, context);
    issues.push(...factualIssues);

    // 6. Check tone
    const toneIssues = this.checkTone(response);
    issues.push(...toneIssues);

    // 7. Check links
    const linkIssues = this.checkLinks(response);
    issues.push(...linkIssues);

    // 8. Critical Check: LLM-based Self-Audit (Internal Critic)
    const heuristicsScore = this.calculateScore(issues);
    const isRiskyTopic = /гарантир|выгод|прибыль|обход|налог/i.test(response);
    const isLongResponse = response.length > 500;
    const heuristicsFlagged =
      issues.some(i => i.severity === 'high' || i.severity === 'critical') || heuristicsScore < 85;

    const needsAudit = heuristicsFlagged || (isRiskyTopic && isLongResponse);

    if (needsAudit) {
      const auditIssues = await this.selfAudit(response, context);
      issues.push(...auditIssues);
    }

    // Calculate final score
    const score = this.calculateScore(issues);

    // Update running average
    this.metrics.avgScore =
      (this.metrics.avgScore * (this.metrics.totalValidations - 1) + score) /
      this.metrics.totalValidations;

    // Generate suggestions
    if (issues.length > 0) {
      suggestions.push(...this.generateSuggestions(issues));
    }

    // Determine if valid
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasMultipleHigh = issues.filter(i => i.severity === 'high').length >= 2;
    const isValid = !hasCritical && !hasMultipleHigh && score >= 60;

    // Update metrics
    if (isValid) {
      this.metrics.passed++;
    } else {
      this.metrics.failed++;
      if (hasCritical) {
        this.metrics.criticalRejections++;
      }
    }

    // Log validation with context
    if (!isValid) {
      logger.warn('[ResponseValidator] Response failed validation', {
        score,
        issueCount: issues.length,
        critical: hasCritical,
        issueTypes: issues.map(i => i.type),
        query: context.userQuery.substring(0, 50),
      });
    }

    // Determine corrected response
    let correctedResponse: string | undefined;
    if (!isValid) {
      if (hasCritical) {
        // Critical issues = use safe fallback
        correctedResponse = CRITICAL_FALLBACK;
        logger.error('[ResponseValidator] CRITICAL: Using fallback response', {
          issues: issues.filter(i => i.severity === 'critical'),
        });
      } else {
        // Non-critical = attempt correction
        correctedResponse = this.attemptCorrection(response, issues);
      }
    }

    const result: ValidationResult = {
      isValid,
      score,
      issues,
      suggestions,
      correctedResponse,
      metrics: { ...this.metrics },
    };

    // Log to database (non-blocking)
    validationLogService
      .logValidation({
        userId: context.userId,
        score,
        passed: isValid,
        issues,
        queryPreview: context.userQuery.substring(0, 100),
        responseLength: response.length,
        processingTimeMs: Date.now() - startTime,
      })
      .catch(() => {
        /* Ignore logging errors */
      });

    return result;
  }

  /**
   * Quick check - use for fast validation
   */
  quickCheck(response: string): boolean {
    // Check critical issues only
    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.test(response)) return false;
    }

    for (const pattern of HALLUCINATION_PATTERNS) {
      if (pattern.test(response)) return false;
    }

    // Check minimum length
    if (response.length < 10) return false;

    return true;
  }

  // ============================================
  // VALIDATION CHECKS
  // ============================================

  private checkHallucinations(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const pattern of HALLUCINATION_PATTERNS) {
      if (pattern.test(response)) {
        issues.push({
          type: 'hallucination',
          severity: 'high',
          message: 'Обнаружена возможная галлюцинация (придуманные данные)',
          location: response.match(pattern)?.[0],
        });
      }
    }

    // Check for invented percentages without tool results
    const percentages = response.match(/\d+(?:\.\d+)?%/g) || [];
    if (percentages.length > 5) {
      issues.push({
        type: 'hallucination',
        severity: 'medium',
        message: 'Много процентов в ответе — проверьте источники данных',
      });
    }

    // Check for invented prices
    const prices = response.match(/\d+[\s\u00A0]?(?:₽|руб|рублей)/gi) || [];
    if (prices.length > 10) {
      issues.push({
        type: 'hallucination',
        severity: 'low',
        message: 'Много ценовых данных — убедитесь что все из результатов tools',
      });
    }

    return issues;
  }

  private checkRelevance(response: string, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if response is off-topic
    for (const trigger of OFF_TOPIC_TRIGGERS) {
      if (trigger.test(context.userQuery)) {
        // User asked off-topic question, check if agent stayed on topic
        const staysOnTopic = /маркетплейс|товар|цен|продаж|wb|ozon|wildberries|озон/i.test(
          response
        );
        if (!staysOnTopic) {
          issues.push({
            type: 'irrelevant',
            severity: 'medium',
            message: 'Ответ отклонился от темы маркетплейсов',
          });
        }
      }
    }

    // Check if response addresses the question
    const queryKeywords = this.extractKeywords(context.userQuery);
    const responseKeywords = this.extractKeywords(response);
    const overlap = queryKeywords.filter(k => responseKeywords.includes(k)).length;

    if (overlap < queryKeywords.length * 0.3 && queryKeywords.length > 2) {
      issues.push({
        type: 'irrelevant',
        severity: 'medium',
        message: 'Ответ может не соответствовать запросу пользователя',
      });
    }

    return issues;
  }

  private checkSafety(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.test(response)) {
        issues.push({
          type: 'unsafe',
          severity: 'critical',
          message: 'Обнаружен небезопасный контент',
          location: response.match(pattern)?.[0],
        });
      }
    }

    // Check for personal data leakage
    const hasPhone = /\+7\d{10}|\d{3}[-\s]\d{3}[-\s]\d{4}/g.test(response);
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(response);

    if (hasPhone || hasEmail) {
      issues.push({
        type: 'unsafe',
        severity: 'high',
        message: 'Возможная утечка персональных данных',
      });
    }

    return issues;
  }

  private checkQuality(response: string, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const { pattern, issue } of QUALITY_ISSUES) {
      if (pattern.test(response)) {
        issues.push({
          type: 'quality',
          severity: 'low',
          message: issue,
        });
      }
    }

    // Check response length vs query complexity
    const queryWords = context.userQuery.split(/\s+/).length;
    const responseWords = response.split(/\s+/).length;

    if (queryWords > 10 && responseWords < 20) {
      issues.push({
        type: 'quality',
        severity: 'medium',
        message: 'Ответ слишком краток для сложного вопроса',
      });
    }

    // Check for empty tool acknowledgment
    if (/не смог найти|не нашёл данных|нет информации/i.test(response) && !context.toolResults) {
      issues.push({
        type: 'quality',
        severity: 'medium',
        message: 'Отсутствие данных без попытки использовать инструменты',
      });
    }

    return issues;
  }

  private checkFacts(response: string, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check Ozon Card fee
    const ozonCardMatch = response.match(/ozon\s*(?:карт|card)[а-яёa-z]*\s*[:=]?\s*(\d+)%/i);
    if (ozonCardMatch && parseInt(ozonCardMatch[1]) !== KNOWN_FACTS.ozon_card_fee) {
      issues.push({
        type: 'factual',
        severity: 'high',
        message: `Неверно: Ozon Карта всегда ${KNOWN_FACTS.ozon_card_fee}% за счёт продавца`,
      });
    }

    // Check commission ranges
    // Allow text between 'commission' and value (e.g. "Комиссия маркетплейса: 75%")
    const commissionMatch = response.match(/комисси[а-яё]*[\s\S]{0,50}?[:=]?\s*(\d+)%/i);
    if (commissionMatch) {
      const commission = parseInt(commissionMatch[1]);
      if (commission > KNOWN_FACTS.max_commission || commission < KNOWN_FACTS.min_commission) {
        issues.push({
          type: 'factual',
          severity: 'medium',
          message: `Подозрительная комиссия: ${commission}%`,
        });
      }
    }

    // Check if prices mentioned but no tool provided them
    if (context.toolResults) {
      const hasGetProductsTool = context.toolResults.some(
        t => t.tool === 'get_products' && t.success
      );
      const mentionsPrices = /\d+[\s\u00A0]?₽/.test(response);

      if (mentionsPrices && !hasGetProductsTool) {
        issues.push({
          type: 'factual',
          severity: 'low',
          message: 'Цены упоминаются без получения данных через tool',
        });
      }
    }

    return issues;
  }

  private checkTone(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Too formal
    if (/уважаемый\s*(?:пользователь|клиент)/i.test(response)) {
      issues.push({
        type: 'tone',
        severity: 'low',
        message: 'Слишком формальный тон — Виктор общается по-дружески',
      });
    }

    // Bot phrases
    if (/я\s*(?:бот|искусственный интеллект|ии|ai)\b/i.test(response)) {
      issues.push({
        type: 'tone',
        severity: 'medium',
        message: 'Виктор — управляющий, а не бот',
      });
    }

    // Negative without solution
    if (/к сожалению|извините|не могу/i.test(response)) {
      if (!/но можно|попробуй|альтернатив/i.test(response)) {
        issues.push({
          type: 'tone',
          severity: 'low',
          message: 'Негатив без предложения решения',
        });
      }
    }

    return issues;
  }

  /**
   * Check links for validity
   * Ensures WB/Ozon links have valid format and IDs
   */
  private checkLinks(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Extract all URLs from response
    const urlPattern = /https?:\/\/[^\s<>)"']+/gi;
    const urls = response.match(urlPattern) || [];

    for (const url of urls) {
      // Check WB links
      if (url.includes('wildberries.ru')) {
        // Extract nmId from WB URL
        const nmIdMatch = url.match(/catalog\/(\d+)/);
        if (nmIdMatch) {
          const nmId = parseInt(nmIdMatch[1]);
          // Sanity check: WB nmIds are typically 6-10 digits
          if (nmId < 100000 || nmId > 9999999999) {
            issues.push({
              type: 'link',
              severity: 'high',
              message: `Подозрительный WB артикул в ссылке: ${nmId}`,
              location: url,
            });
          }
        } else if (!url.includes('/catalog/') && !url.includes('/seller/')) {
          // WB link without valid path
          issues.push({
            type: 'link',
            severity: 'medium',
            message: 'WB ссылка без артикула товара',
            location: url,
          });
        }
      }

      // Check Ozon links
      if (url.includes('ozon.ru')) {
        // Extract product ID from Ozon URL (matches /product/slug-ID/ or /product/ID/)
        const productMatch = url.match(/product\/(?:[^/]*?|-)?(\d+)/);
        if (productMatch) {
          const productId = parseInt(productMatch[1]);
          // Sanity check: Ozon IDs are typically 6-12 digits
          if (productId < 100000 || productId > 999999999999) {
            issues.push({
              type: 'link',
              severity: 'high',
              message: `Подозрительный Ozon ID в ссылке: ${productId}`,
              location: url,
            });
          }
        }
      }

      // Check for obviously fake domains
      if (/fake|test|example|localhost/i.test(url)) {
        issues.push({
          type: 'link',
          severity: 'critical',
          message: 'Фейковая ссылка в ответе',
          location: url,
        });
      }
    }

    return issues;
  }

  // ============================================
  // HELPERS
  // ============================================

  private calculateScore(issues: ValidationIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 40;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  private generateSuggestions(issues: ValidationIssue[]): string[] {
    const suggestions: string[] = [];

    const hasHallucination = issues.some(i => i.type === 'hallucination');
    const hasIrrelevant = issues.some(i => i.type === 'irrelevant');
    const hasUnsafe = issues.some(i => i.type === 'unsafe');
    const hasFactual = issues.some(i => i.type === 'factual');
    const hasTone = issues.some(i => i.type === 'tone');

    if (hasHallucination) {
      suggestions.push('Используй только данные из результатов инструментов');
    }

    if (hasIrrelevant) {
      suggestions.push('Сфокусируй ответ на запросе пользователя');
    }

    if (hasUnsafe) {
      suggestions.push('КРИТИЧНО: Убери небезопасный контент');
    }

    if (hasFactual) {
      suggestions.push('Проверь факты — используй базу знаний');
    }

    if (hasTone) {
      suggestions.push('Помни: ты Виктор — управляющий, не бот');
    }

    return suggestions;
  }

  /**
   * LLM-based Self-Audit (The "Internal Critic" phase)
   * Uses Gemini Flash to scrutinize the response for subtle issues
   */
  private async selfAudit(
    response: string,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      const prompt = `System: Ты — Критик качества ответов AI-агента Виктора. Твоя задача — проверить ответ на ошибки, галлюцинации и неуместный тон.
      
Контекст запроса: "${context.userQuery}"
Инструменты (JSON): ${JSON.stringify(context.toolResults || [])}

Анализируемый ответ:
"${response}"

Найди в ответе:
1. Фактические ошибки (цены не совпадают с результатами инструментов).
2. Выдуманные ссылки или функции.
3. Упоминание того, что он "ИИ" или "бот" (он должен быть Виктором, управляющим).
4. Утечку внутренних логов, ключей или программного кода.

Верни только JSON массив объектов вида:
[{"type": "hallucination" | "factual" | "tone" | "confidentiality", "severity": "high" | "medium", "message": "почему это ошибка"}]
Если ошибок нет, верни []`;

      const auditResult = await llmRouter.complete([{ role: 'system', content: prompt }], {
        temperature: 0,
        jsonMode: true,
      });

      const parsedAudit = JSON.parse(auditResult.content);
      if (Array.isArray(parsedAudit)) {
        issues.push(...parsedAudit);
      }
    } catch (error) {
      logger.warn('[ResponseValidator] Self-audit failed, skipping...', { error });
    }

    return issues;
  }

  private attemptCorrection(response: string, _issues: ValidationIssue[]): string {
    let corrected = response;

    // Remove bot phrases
    corrected = corrected.replace(/я\s*(?:бот|искусственный интеллект|ии|ai)\b/gi, 'я, Виктор,');

    // Remove overly formal phrases
    corrected = corrected.replace(/уважаемый\s*(?:пользователь|клиент)/gi, '');

    // Add solution prompt if negative
    if (
      /к сожалению|извините|не могу/i.test(corrected) &&
      !/но можно|попробуй|альтернатив/i.test(corrected)
    ) {
      corrected += '\n\nНо есть альтернативы — расскажите подробнее что нужно.';
    }

    return corrected;
  }

  private extractKeywords(text: string): string[] {
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
      'а',
      'но',
      'что',
      'как',
      'это',
      'мне',
      'мой',
    ];

    return text
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  // ============================================
  // METRICS API
  // ============================================

  /**
   * Get current validation metrics
   */
  getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for periodic reporting)
   */
  resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      passed: 0,
      failed: 0,
      criticalRejections: 0,
      avgScore: 100,
    };
  }

  /**
   * Get pass rate as percentage
   */
  getPassRate(): number {
    if (this.metrics.totalValidations === 0) return 100;
    return Math.round((this.metrics.passed / this.metrics.totalValidations) * 100);
  }
}

// Export singleton instance
export const responseValidator = new ResponseValidator();
