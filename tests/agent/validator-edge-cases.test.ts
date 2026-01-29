// ============================================
// ResponseValidator Edge Case Tests
// Tests validation guardrails with tricky inputs
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResponseValidator,
  type ValidationContext,
  type ValidationIssue,
} from '../../src/agent/core/ResponseValidator.js';

// Mock the validation log service to avoid DB calls in tests
vi.mock('../../src/api-lib/services/validation-log.service.js', () => ({
  validationLogService: {
    logValidation: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger to suppress noise
vi.mock('../../src/api-lib/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock llmRouter to avoid real API calls during tests
vi.mock('../../src/infrastructure/llm/LLMRouter.js', () => ({
  llmRouter: {
    complete: vi.fn().mockResolvedValue({
      content: '[]', // Default empty JSON for self-audit
      usage: { totalTokens: 0 },
    }),
  },
}));

describe('ResponseValidator Edge Cases', () => {
  let validator: ResponseValidator;
  let baseContext: ValidationContext;

  beforeEach(() => {
    validator = new ResponseValidator();
    baseContext = {
      userQuery: 'Как установить стоп-лосс?',
      marketplace: 'wb',
    };
  });

  describe('Hallucination Detection', () => {
    it('should detect fake localhost URLs', async () => {
      const response = 'Перейдите по ссылке http://localhost:3000/admin';
      const result = await validator.validate(response, baseContext);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i: ValidationIssue) => i.type === 'hallucination')).toBe(true);
    });

    it('should detect excessive percentages', async () => {
      const response = 'У вас будет 1500% прибыли!';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'hallucination')).toBe(true);
    });

    it('should allow legitimate marketplace links', async () => {
      const response = 'Ваш товар: https://www.wildberries.ru/catalog/123456789/detail.aspx';
      const result = await validator.validate(response, baseContext);

      const linkIssues = result.issues.filter((i: ValidationIssue) => i.type === 'link');
      expect(linkIssues.length).toBe(0);
    });
  });

  describe('Link Validation', () => {
    it('should detect WB links with invalid nmId (too short)', async () => {
      const response = 'Товар: https://www.wildberries.ru/catalog/123/detail.aspx';
      const result = await validator.validate(response, baseContext);

      expect(
        result.issues.some((i: ValidationIssue) => i.type === 'link' && i.severity === 'high')
      ).toBe(true);
    });

    it('should detect WB links with invalid nmId (too long)', async () => {
      const response = 'Товар: https://www.wildberries.ru/catalog/99999999999999/detail.aspx';
      const result = await validator.validate(response, baseContext);

      expect(
        result.issues.some((i: ValidationIssue) => i.type === 'link' && i.severity === 'high')
      ).toBe(true);
    });

    it('should allow valid WB nmId', async () => {
      const response = 'Товар: https://www.wildberries.ru/catalog/12345678/detail.aspx стоит 1500₽';
      const result = await validator.validate(response, baseContext);

      const linkIssues = result.issues.filter((i: ValidationIssue) => i.type === 'link');
      expect(linkIssues.length).toBe(0);
    });

    it('should detect Ozon links with invalid product ID', async () => {
      const response = 'Товар: https://www.ozon.ru/product/test-123/';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'link')).toBe(true);
    });

    it('should detect fake domain links', async () => {
      const response = 'Перейдите на https://fake-wildberries.ru/catalog/123/';
      const result = await validator.validate(response, baseContext);

      expect(
        result.issues.some((i: ValidationIssue) => i.type === 'link' && i.severity === 'critical')
      ).toBe(true);
    });

    it('should detect test/example domains', async () => {
      const response = 'Проверьте https://example.com/product';
      const result = await validator.validate(response, baseContext);

      expect(
        result.issues.some((i: ValidationIssue) => i.type === 'link' || i.type === 'hallucination')
      ).toBe(true);
    });
  });

  describe('Safety Checks', () => {
    it('should flag guaranteed profit claims', async () => {
      const response = 'Мы гарантируем прибыль 100% на всех товарах!';
      const result = await validator.validate(response, baseContext);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((i: ValidationIssue) => i.type === 'unsafe' && i.severity === 'critical')
      ).toBe(true);
    });

    it('should flag tax/law bypass suggestions', async () => {
      const response = 'Вы можете обойти налоговые правила используя...';
      const result = await validator.validate(response, baseContext);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i: ValidationIssue) => i.type === 'unsafe')).toBe(true);
    });

    it('should detect personal data leakage (phone)', async () => {
      const response = 'Свяжитесь с нами: +79991234567';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'unsafe')).toBe(true);
    });

    it('should detect personal data leakage (email)', async () => {
      const response = 'Напишите на user@example.com';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'unsafe')).toBe(true);
    });
  });

  describe('Quality Checks', () => {
    it('should flag too short responses for complex questions', async () => {
      const context: ValidationContext = {
        userQuery: 'Объясни принципы работы юнит-экономики для товара с маржой 15% и комиссией 20%',
        marketplace: 'wb',
      };
      const response = 'Посчитайте сами.';
      const result = await validator.validate(response, context);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'quality')).toBe(true);
    });

    it('should detect repetitive text', async () => {
      const response = 'Отличный товар! '.repeat(10);
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'quality')).toBe(true);
    });
  });

  describe('Factual Accuracy', () => {
    it('should detect incorrect Ozon Card fee', async () => {
      const response = 'Скидка по Ozon Карте: 10% за счёт продавца.';
      const result = await validator.validate(response, { ...baseContext, marketplace: 'ozon' });

      expect(result.issues.some((i: ValidationIssue) => i.type === 'factual')).toBe(true);
    });

    it('should detect unrealistic commission values', async () => {
      const response = 'Комиссия маркетплейса: 75%';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'factual')).toBe(true);
    });
  });

  describe('Tone Checks', () => {
    it('should flag bot self-identification', async () => {
      const response = 'Я бот и не могу помочь с этим вопросом.';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'tone')).toBe(true);
    });

    it('should flag overly formal language', async () => {
      const response = 'Уважаемый клиент, ваш запрос обрабатывается.';
      const result = await validator.validate(response, baseContext);

      expect(result.issues.some((i: ValidationIssue) => i.type === 'tone')).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    it('should give high score for clean response', async () => {
      const response =
        'Стоп-лосс — это минимальная цена, ниже которой товар не продаётся. ' +
        'Установите его в настройках товара, чтобы Sentinel автоматически защищал ваши цены.';
      const result = await validator.validate(response, baseContext);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.isValid).toBe(true);
    });

    it('should give low score for dangerous response', async () => {
      const response = 'Гарантируем 100% успех! Обход налогов через http://localhost:3000';
      const result = await validator.validate(response, baseContext);

      expect(result.score).toBeLessThan(40);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Critical Fallback', () => {
    it('should use critical fallback for dangerous content', async () => {
      const response = '100% гарантия результата! Обход законов возможен!';
      const result = await validator.validate(response, baseContext);

      expect(result.correctedResponse).toBeDefined();
      expect(result.correctedResponse).toContain('переформулируйте');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track validation metrics', async () => {
      const testValidator = new ResponseValidator();

      // Run a few validations
      await testValidator.validate('Хороший ответ про стоп-лосс на Wildberries', baseContext);
      await testValidator.validate('Плохой ответ 100% гарантия успеха!', baseContext);
      await testValidator.validate('Ещё хороший ответ про товары', baseContext);

      const metrics = testValidator.getMetrics();

      expect(metrics.totalValidations).toBe(3);
      expect(metrics.passed + metrics.failed).toBe(3);
      expect(testValidator.getPassRate()).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', () => {
      validator.resetMetrics();
      const metrics = validator.getMetrics();

      expect(metrics.totalValidations).toBe(0);
      expect(metrics.avgScore).toBe(100);
    });
  });

  describe('Quick Check', () => {
    it('should pass quick check for safe content', () => {
      const response = 'Товар успешно добавлен в мониторинг.';
      expect(validator.quickCheck(response)).toBe(true);
    });

    it('should fail quick check for unsafe patterns', () => {
      const response = 'Гарантируем прибыль 100%!';
      expect(validator.quickCheck(response)).toBe(false);
    });

    it('should fail quick check for too short response', () => {
      const response = 'Ок';
      expect(validator.quickCheck(response)).toBe(false);
    });
  });
});
