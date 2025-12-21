// ============================================
// RulesService — Управление пользовательскими правилами
// ============================================

import { sql } from '@vercel/postgres';
import { logger } from '../../utils/logger';
import { competitorService } from '../competitor/competitor.service';
import type {
  UserRule,
  RuleExecutionLog,
  CreateRuleRequest,
  UpdateRuleRequest,
} from './rules.types';
import { v4 as uuidv4 } from 'uuid';

export class RulesService {
  /**
   * Инициализация таблицы правил (вызвать при init-db)
   */
  async initTable(): Promise<void> {
    await sql`
      CREATE TABLE IF NOT EXISTS user_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        
        -- Condition (JSON)
        condition JSONB NOT NULL,
        
        -- Action (JSON)  
        action JSONB NOT NULL,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 5,
        
        -- Limits
        max_triggers_per_day INTEGER DEFAULT 10,
        triggers_today INTEGER DEFAULT 0,
        cooldown_minutes INTEGER DEFAULT 30,
        last_triggered_at TIMESTAMP,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rule_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID REFERENCES user_rules(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL,
        product_id VARCHAR(255),
        
        trigger_data JSONB NOT NULL,
        action_data JSONB NOT NULL,
        
        success BOOLEAN DEFAULT true,
        error TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Индексы
    await sql`CREATE INDEX IF NOT EXISTS idx_user_rules_user ON user_rules(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_rules_active ON user_rules(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rule_logs_rule ON rule_execution_logs(rule_id)`;

    logger.info('Rules tables initialized');
  }

  /**
   * Получить все правила пользователя
   */
  async getUserRules(userId: number): Promise<UserRule[]> {
    const result = await sql`
      SELECT * FROM user_rules 
      WHERE user_id = ${userId}
      ORDER BY priority DESC, created_at DESC
    `;

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Получить активные правила пользователя
   */
  async getActiveRules(userId: number): Promise<UserRule[]> {
    const result = await sql`
      SELECT * FROM user_rules 
      WHERE user_id = ${userId} 
      AND is_active = true
      ORDER BY priority DESC
    `;

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Создать новое правило
   */
  async createRule(userId: number, request: CreateRuleRequest): Promise<UserRule> {
    const id = uuidv4();

    const result = await sql`
      INSERT INTO user_rules (
        id, user_id, name, description, 
        condition, action, 
        priority, max_triggers_per_day, cooldown_minutes
      ) VALUES (
        ${id}, ${userId}, ${request.name}, ${request.description || null},
        ${JSON.stringify(request.condition)}, ${JSON.stringify(request.action)},
        ${request.priority || 5}, ${request.maxTriggersPerDay || 10}, ${request.cooldownMinutes || 30}
      )
      RETURNING *
    `;

    logger.info('Rule created', { userId, ruleId: id, name: request.name });
    return this.mapRowToRule(result.rows[0]);
  }

  /**
   * Обновить правило
   */
  async updateRule(
    userId: number,
    ruleId: string,
    request: UpdateRuleRequest
  ): Promise<UserRule | null> {
    // Проверяем владельца
    const existing =
      await sql`SELECT * FROM user_rules WHERE id = ${ruleId} AND user_id = ${userId}`;
    if (existing.rows.length === 0) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (request.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(request.name);
    }
    if (request.description !== undefined) {
      updates.push(`description = $${values.length + 1}`);
      values.push(request.description);
    }
    if (request.condition !== undefined) {
      updates.push(`condition = $${values.length + 1}`);
      values.push(JSON.stringify(request.condition));
    }
    if (request.action !== undefined) {
      updates.push(`action = $${values.length + 1}`);
      values.push(JSON.stringify(request.action));
    }
    if (request.isActive !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(request.isActive);
    }
    if (request.priority !== undefined) {
      updates.push(`priority = $${values.length + 1}`);
      values.push(request.priority);
    }
    if (request.maxTriggersPerDay !== undefined) {
      updates.push(`max_triggers_per_day = $${values.length + 1}`);
      values.push(request.maxTriggersPerDay);
    }
    if (request.cooldownMinutes !== undefined) {
      updates.push(`cooldown_minutes = $${values.length + 1}`);
      values.push(request.cooldownMinutes);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Dynamic update with parameterized query
    const result = await sql`
      UPDATE user_rules SET 
        name = COALESCE(${request.name}, name),
        description = COALESCE(${request.description}, description),
        condition = COALESCE(${request.condition ? JSON.stringify(request.condition) : null}::jsonb, condition),
        action = COALESCE(${request.action ? JSON.stringify(request.action) : null}::jsonb, action),
        is_active = COALESCE(${request.isActive}, is_active),
        priority = COALESCE(${request.priority}, priority),
        max_triggers_per_day = COALESCE(${request.maxTriggersPerDay}, max_triggers_per_day),
        cooldown_minutes = COALESCE(${request.cooldownMinutes}, cooldown_minutes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId}
      RETURNING *
    `;

    logger.info('Rule updated', { userId, ruleId });
    return result.rows.length > 0 ? this.mapRowToRule(result.rows[0]) : null;
  }

  /**
   * Удалить правило
   */
  async deleteRule(userId: number, ruleId: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM user_rules 
      WHERE id = ${ruleId} AND user_id = ${userId}
    `;

    return (result.rowCount || 0) > 0;
  }

  /**
   * Переключить активность правила
   */
  async toggleRule(userId: number, ruleId: string): Promise<UserRule | null> {
    const result = await sql`
      UPDATE user_rules SET 
        is_active = NOT is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId}
      RETURNING *
    `;

    return result.rows.length > 0 ? this.mapRowToRule(result.rows[0]) : null;
  }

  /**
   * Проверить и выполнить правила для пользователя
   * Вызывается из Sentinel/check-prices
   */
  async evaluateRules(
    userId: number,
    context: {
      products: Array<{
        productId: string;
        currentPrice: number;
        minPrice: number;
        stock: number;
        costPrice?: number;
      }>;
      competitors?: Map<string, { nmId: number; name: string; price: number }[]>;
    }
  ): Promise<RuleExecutionLog[]> {
    const rules = await this.getActiveRules(userId);
    const logs: RuleExecutionLog[] = [];

    for (const rule of rules) {
      // Проверяем лимиты
      if (!this.canTrigger(rule)) continue;

      try {
        const triggered = await this.evaluateCondition(rule, context);

        if (triggered.shouldTrigger) {
          const actionResult = await this.executeAction(rule, triggered.data, userId);

          // Записываем лог
          const log = await this.logExecution(rule, triggered.data, actionResult);
          logs.push(log);

          // Обновляем счётчики
          await this.updateTriggerCount(rule.id);
        }
      } catch (error) {
        logger.error('Rule evaluation error', error, { ruleId: rule.id, userId });
      }
    }

    return logs;
  }

  /**
   * Проверить можно ли сработать правилу (лимиты, cooldown)
   */
  private canTrigger(rule: UserRule): boolean {
    // Проверка дневного лимита
    if (rule.maxTriggersPerDay && rule.triggersToday >= rule.maxTriggersPerDay) {
      return false;
    }

    // Проверка cooldown
    if (rule.lastTriggeredAt && rule.cooldownMinutes) {
      const lastTrigger = new Date(rule.lastTriggeredAt);
      const cooldownEnd = new Date(lastTrigger.getTime() + rule.cooldownMinutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        return false;
      }
    }

    return true;
  }

  /**
   * Проверить условие правила
   */
  private async evaluateCondition(
    rule: UserRule,
    context: any
  ): Promise<{ shouldTrigger: boolean; data: any }> {
    const { condition } = rule;
    const { products, competitors: _competitors } = context; // _competitors reserved for future use

    switch (condition.triggerType) {
      case 'competitor_price_below': {
        // Проверяем, есть ли конкурент с ценой ниже targetValue
        if (condition.competitorNmId) {
          const scanResult = await competitorService.scanCompetitors({
            nmId: condition.competitorNmId,
            limit: 10,
          });

          const competitor = scanResult.competitors.find(c => c.nmId === condition.competitorNmId);

          if (competitor && competitor.salePrice < (condition.targetValue || 0)) {
            return {
              shouldTrigger: true,
              data: {
                triggerType: 'competitor_price_below',
                detectedValue: competitor.salePrice,
                thresholdValue: condition.targetValue,
                competitorInfo: {
                  nmId: competitor.nmId,
                  name: competitor.name,
                  price: competitor.salePrice,
                },
              },
            };
          }
        }
        break;
      }

      case 'stock_below': {
        // Проверяем остатки
        for (const product of products) {
          if (
            condition.productIds?.length === 0 ||
            condition.productIds?.includes(product.productId) ||
            !condition.productIds
          ) {
            if (product.stock < (condition.targetValue || 10)) {
              return {
                shouldTrigger: true,
                data: {
                  triggerType: 'stock_below',
                  detectedValue: product.stock,
                  thresholdValue: condition.targetValue,
                  productId: product.productId,
                },
              };
            }
          }
        }
        break;
      }

      case 'my_price_below_cost': {
        // Проверяем цену ниже себестоимости
        for (const product of products) {
          if (product.costPrice && product.currentPrice < product.costPrice) {
            return {
              shouldTrigger: true,
              data: {
                triggerType: 'my_price_below_cost',
                detectedValue: product.currentPrice,
                thresholdValue: product.costPrice,
                productId: product.productId,
              },
            };
          }
        }
        break;
      }

      // Другие типы триггеров можно добавить по аналогии
    }

    return { shouldTrigger: false, data: null };
  }

  /**
   * Выполнить действие правила
   */
  private async executeAction(
    rule: UserRule,
    triggerData: any,
    userId: number
  ): Promise<{ success: boolean; actionData: any; error?: string }> {
    const { action } = rule;

    try {
      switch (action.actionType) {
        case 'notify': {
          // Отправить уведомление в Telegram
          let message = action.notifyMessage || `⚡ Правило "${rule.name}" сработало!`;

          // Подставляем переменные
          message = message
            .replace('{stock}', triggerData.detectedValue?.toString() || '')
            .replace('{competitor_name}', triggerData.competitorInfo?.name || '')
            .replace('{competitor_price}', triggerData.competitorInfo?.price?.toString() || '');

          if (process.env.TELEGRAM_BOT_TOKEN) {
            await fetch(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: userId,
                  text: message,
                  parse_mode: 'HTML',
                }),
              }
            );
          }

          return {
            success: true,
            actionData: { actionType: 'notify', notificationSent: true, message },
          };
        }

        case 'undercut_competitor': {
          // Сделать цену ниже конкурента на X%
          if (triggerData.competitorInfo) {
            const undercut = action.value || 3; // 3% по умолчанию
            const newPrice = Math.floor(triggerData.competitorInfo.price * (1 - undercut / 100));

            // Проверяем минимальную цену
            const finalPrice = action.minPrice ? Math.max(newPrice, action.minPrice) : newPrice;

            // TODO: Вызвать API обновления цены
            logger.info('Would set price', {
              newPrice: finalPrice,
              productId: triggerData.productId,
            });

            return {
              success: true,
              actionData: {
                actionType: 'undercut_competitor',
                appliedValue: undercut,
                previousPrice: triggerData.detectedValue,
                newPrice: finalPrice,
              },
            };
          }
          break;
        }

        // Другие действия...
      }

      return { success: false, actionData: {}, error: 'Action not implemented' };
    } catch (error) {
      return {
        success: false,
        actionData: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Записать лог выполнения
   */
  private async logExecution(
    rule: UserRule,
    triggerData: any,
    actionResult: any
  ): Promise<RuleExecutionLog> {
    const id = uuidv4();

    await sql`
      INSERT INTO rule_execution_logs (
        id, rule_id, user_id, product_id,
        trigger_data, action_data,
        success, error
      ) VALUES (
        ${id}, ${rule.id}, ${rule.userId}, ${triggerData.productId || null},
        ${JSON.stringify(triggerData)}, ${JSON.stringify(actionResult.actionData)},
        ${actionResult.success}, ${actionResult.error || null}
      )
    `;

    return {
      id,
      ruleId: rule.id,
      userId: rule.userId,
      productId: triggerData.productId,
      triggerData,
      actionData: actionResult.actionData,
      success: actionResult.success,
      error: actionResult.error,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Обновить счётчик срабатываний
   */
  private async updateTriggerCount(ruleId: string): Promise<void> {
    await sql`
      UPDATE user_rules SET 
        triggers_today = triggers_today + 1,
        last_triggered_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId}
    `;
  }

  /**
   * Сбросить дневные счётчики (вызывать из cron в полночь)
   */
  async resetDailyCounters(): Promise<void> {
    await sql`UPDATE user_rules SET triggers_today = 0`;
    logger.info('Daily rule counters reset');
  }

  /**
   * Получить логи выполнения правил
   */
  async getRuleLogs(userId: number, ruleId?: string, limit = 50): Promise<RuleExecutionLog[]> {
    let result;

    if (ruleId) {
      result = await sql`
        SELECT * FROM rule_execution_logs 
        WHERE user_id = ${userId} AND rule_id = ${ruleId}
        ORDER BY executed_at DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT * FROM rule_execution_logs 
        WHERE user_id = ${userId}
        ORDER BY executed_at DESC
        LIMIT ${limit}
      `;
    }

    return result.rows.map((row: any) => ({
      id: row.id,
      ruleId: row.rule_id,
      userId: row.user_id,
      productId: row.product_id,
      triggerData: row.trigger_data,
      actionData: row.action_data,
      success: row.success,
      error: row.error,
      executedAt: row.executed_at,
    }));
  }

  /**
   * Преобразовать строку БД в UserRule
   */
  private mapRowToRule(row: any): UserRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      condition: row.condition,
      action: row.action,
      isActive: row.is_active,
      priority: row.priority,
      maxTriggersPerDay: row.max_triggers_per_day,
      triggersToday: row.triggers_today,
      cooldownMinutes: row.cooldown_minutes,
      lastTriggeredAt: row.last_triggered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const rulesService = new RulesService();
