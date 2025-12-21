// ============================================
// User Rules Types for Automated Actions
// "Если X, то Y" — автоматические правила защиты маржи
// ============================================

/**
 * Rule Trigger Types — ЧТО отслеживаем
 */
export type RuleTriggerType =
  | 'competitor_price_below' // Конкурент снизил цену ниже X
  | 'competitor_price_change' // Конкурент изменил цену на X%
  | 'my_price_below_cost' // Моя цена ниже себестоимости
  | 'stock_below' // Остаток ниже X
  | 'daily_check' // Ежедневная проверка
  | 'new_competitor'; // Появился новый конкурент в ТОП-10

/**
 * Rule Action Types — ЧТО делаем
 */
export type RuleActionType =
  | 'notify' // Уведомить в Telegram
  | 'lower_price_percent' // Снизить цену на X%
  | 'lower_price_absolute' // Снизить цену на X рублей
  | 'match_competitor' // Сравнять с конкурентом
  | 'undercut_competitor' // Сделать дешевле конкурента на X%
  | 'set_min_price' // Установить минимальную цену
  | 'pause_sales'; // Приостановить продажи (обнулить остаток)

/**
 * Rule Condition — условие срабатывания
 */
export interface RuleCondition {
  triggerType: RuleTriggerType;

  // Параметры в зависимости от triggerType
  targetValue?: number; // Целевое значение (цена, процент, количество)
  competitorNmId?: number; // Артикул конкурента для отслеживания
  competitorKeyword?: string; // Ключевое слово для поиска конкурентов
  productIds?: string[]; // К каким товарам применять (пусто = все)
}

/**
 * Rule Action — действие при срабатывании
 */
export interface RuleAction {
  actionType: RuleActionType;

  // Параметры в зависимости от actionType
  value?: number; // Значение (процент или рубли)
  minPrice?: number; // Не снижать ниже этой цены
  notifyMessage?: string; // Кастомное сообщение для уведомления
}

/**
 * User Rule — полное правило пользователя
 */
export interface UserRule {
  id: string; // UUID
  userId: number; // Владелец правила
  name: string; // Название правила (для UI)
  description?: string; // Описание

  // Условие и действие
  condition: RuleCondition;
  action: RuleAction;

  // Статус
  isActive: boolean; // Активно/приостановлено
  priority: number; // Приоритет (1-10, выше = важнее)

  // Ограничения
  maxTriggersPerDay?: number; // Макс срабатываний в день
  triggersToday: number; // Счётчик срабатываний сегодня
  cooldownMinutes?: number; // Пауза между срабатываниями (мин)
  lastTriggeredAt?: string; // ISO timestamp последнего срабатывания

  // Метаданные
  createdAt: string;
  updatedAt: string;
}

/**
 * Rule Execution Log — лог выполнения правила
 */
export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  userId: number;
  productId?: string;

  // Что сработало
  triggerData: {
    triggerType: RuleTriggerType;
    detectedValue: number; // Обнаруженное значение
    thresholdValue: number; // Пороговое значение
    competitorInfo?: {
      nmId: number;
      name: string;
      price: number;
    };
  };

  // Что сделано
  actionData: {
    actionType: RuleActionType;
    appliedValue?: number;
    previousPrice?: number;
    newPrice?: number;
    notificationSent?: boolean;
  };

  // Результат
  success: boolean;
  error?: string;
  executedAt: string;
}

/**
 * Create Rule Request
 */
export interface CreateRuleRequest {
  name: string;
  description?: string;
  condition: RuleCondition;
  action: RuleAction;
  priority?: number;
  maxTriggersPerDay?: number;
  cooldownMinutes?: number;
}

/**
 * Update Rule Request
 */
export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  condition?: RuleCondition;
  action?: RuleAction;
  isActive?: boolean;
  priority?: number;
  maxTriggersPerDay?: number;
  cooldownMinutes?: number;
}

/**
 * Rule Templates — готовые шаблоны для быстрого создания
 */
export const RULE_TEMPLATES: Record<string, Omit<CreateRuleRequest, 'name'>> = {
  // Защита от демпинга конкурента
  competitor_undercut: {
    description: 'Автоматически снижать цену, если конкурент стал дешевле',
    condition: {
      triggerType: 'competitor_price_below',
      targetValue: 0, // Заполняется пользователем
    },
    action: {
      actionType: 'undercut_competitor',
      value: 3, // На 3% дешевле конкурента
    },
    maxTriggersPerDay: 3,
    cooldownMinutes: 60,
  },

  // Уведомление о низком остатке
  low_stock_alert: {
    description: 'Уведомить когда остаток ниже порога',
    condition: {
      triggerType: 'stock_below',
      targetValue: 10,
    },
    action: {
      actionType: 'notify',
      notifyMessage: '⚠️ Низкий остаток! Осталось {stock} шт.',
    },
    maxTriggersPerDay: 1,
  },

  // Защита маржи
  margin_protection: {
    description: 'Не дать цене упасть ниже себестоимости',
    condition: {
      triggerType: 'my_price_below_cost',
    },
    action: {
      actionType: 'set_min_price',
    },
  },

  // Мониторинг нового конкурента
  new_competitor_alert: {
    description: 'Уведомить о появлении нового конкурента в ТОП-10',
    condition: {
      triggerType: 'new_competitor',
    },
    action: {
      actionType: 'notify',
      notifyMessage: '🆕 Новый конкурент в ТОП-10: {competitor_name} — {competitor_price}₽',
    },
    maxTriggersPerDay: 5,
  },
};
