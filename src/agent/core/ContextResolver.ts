// ============================================
// NeuroGUARDIAN — Context Resolver
// Resolves contextual responses (e.g., "2500" → cost_price)
// Version: 5.0.0 | Date: January 2026
// ============================================

import type { UserState } from '../../core/types/agent.types.js';
import { stateManager } from './StateManager.js';

/**
 * Resolved context result
 */
export interface ResolvedContext {
  /** The original message */
  originalMessage: string;

  /** Whether this message is a contextual response */
  isContextualResponse: boolean;

  /** If contextual, what type of response */
  responseType?: 'cost_price' | 'period' | 'product_name' | 'min_price' | 'confirmation';

  /** Extracted value from the response */
  extractedValue?: string | number | boolean;

  /** Product ID this response relates to */
  forProductId?: string;

  /** Enriched message with context (for the LLM) */
  enrichedMessage: string;

  /** Should skip planning and execute directly? */
  directExecution?: {
    tool: string;
    args: Record<string, unknown>;
  };
}

/**
 * Context Resolver - Understands contextual responses
 *
 * Example flow:
 * 1. Agent: "Какая себестоимость у рейлингов?"
 * 2. User: "2500"
 * 3. ContextResolver detects awaitingInput.type === 'cost_price'
 * 4. Returns: { isContextualResponse: true, extractedValue: 2500, forProductId: '...' }
 */
export class ContextResolver {
  /**
   * Resolve context for the given message
   */
  async resolve(userId: number, message: string): Promise<ResolvedContext> {
    const state = await stateManager.getState(userId);

    // Clean up expired state
    await stateManager.cleanupExpiredState(userId);

    // Check for contextual responses
    if (state.awaitingInput) {
      const contextual = this.resolveAwaitingInput(message, state);
      if (contextual) return contextual;
    }

    // Check for pending action confirmations
    if (state.pendingAction) {
      const confirmation = this.resolvePendingAction(message, state);
      if (confirmation) return confirmation;
    }

    // Check for implicit context (last mentioned products)
    const implicit = this.resolveImplicitContext(message, state);
    if (implicit) return implicit;

    // No special context
    return {
      originalMessage: message,
      isContextualResponse: false,
      enrichedMessage: message,
    };
  }

  /**
   * Handle awaiting input response
   */
  private resolveAwaitingInput(message: string, state: UserState): ResolvedContext | null {
    const awaiting = state.awaitingInput;
    if (!awaiting) return null;

    const trimmed = message.trim();

    switch (awaiting.type) {
      case 'cost_price': {
        // Extract number from message
        const number = this.extractNumber(trimmed);
        if (number !== null) {
          return {
            originalMessage: message,
            isContextualResponse: true,
            responseType: 'cost_price',
            extractedValue: number,
            forProductId: awaiting.forProductId,
            enrichedMessage: `Себестоимость товара = ${number}₽. Рассчитай прибыль.`,
            directExecution: awaiting.forProductId
              ? {
                  tool: 'calculate_unit_economics',
                  args: {
                    product_id: awaiting.forProductId,
                    cost_price: number,
                  },
                }
              : undefined,
          };
        }
        break;
      }

      case 'period': {
        const period = this.extractPeriod(trimmed);
        if (period) {
          return {
            originalMessage: message,
            isContextualResponse: true,
            responseType: 'period',
            extractedValue: period,
            enrichedMessage: `Покажи статистику продаж за ${period}.`,
            directExecution: {
              tool: 'get_sales_stats',
              args: { period },
            },
          };
        }
        break;
      }

      case 'min_price': {
        const number = this.extractNumber(trimmed);
        if (number !== null) {
          return {
            originalMessage: message,
            isContextualResponse: true,
            responseType: 'min_price',
            extractedValue: number,
            forProductId: awaiting.forProductId,
            enrichedMessage: `Минимальная цена = ${number}₽. Установи защиту.`,
            directExecution: awaiting.forProductId
              ? {
                  tool: 'set_stop_loss',
                  args: {
                    product_id: awaiting.forProductId,
                    min_price: number,
                  },
                }
              : undefined,
          };
        }
        break;
      }

      case 'product_name': {
        return {
          originalMessage: message,
          isContextualResponse: true,
          responseType: 'product_name',
          extractedValue: trimmed,
          enrichedMessage: `Найди товар "${trimmed}" и покажи информацию.`,
          directExecution: {
            tool: 'get_products',
            args: { search: trimmed },
          },
        };
      }

      case 'confirmation': {
        const confirmed = this.isConfirmation(trimmed);
        if (confirmed !== null) {
          return {
            originalMessage: message,
            isContextualResponse: true,
            responseType: 'confirmation',
            extractedValue: confirmed,
            enrichedMessage: confirmed ? 'Подтверждаю действие.' : 'Отменяю действие.',
          };
        }
        break;
      }
    }

    return null;
  }

  /**
   * Handle pending action confirmation
   */
  private resolvePendingAction(message: string, state: UserState): ResolvedContext | null {
    const pending = state.pendingAction;
    if (!pending) return null;

    const confirmed = this.isConfirmation(message.trim());
    if (confirmed === null) return null;

    if (confirmed) {
      return {
        originalMessage: message,
        isContextualResponse: true,
        responseType: 'confirmation',
        extractedValue: true,
        enrichedMessage: `Пользователь подтвердил действие: ${pending.type}`,
        directExecution: {
          tool:
            pending.type === 'update_price'
              ? 'update_prices'
              : pending.type === 'set_stop_loss'
                ? 'set_stop_loss'
                : pending.type === 'bulk_protect'
                  ? 'bulk_protect_products'
                  : 'update_stocks',
          args: pending.params,
        },
      };
    } else {
      return {
        originalMessage: message,
        isContextualResponse: true,
        responseType: 'confirmation',
        extractedValue: false,
        enrichedMessage: `Пользователь отменил действие: ${pending.type}`,
      };
    }
  }

  /**
   * Handle implicit context (e.g., pronouns referring to last mentioned product)
   */
  private resolveImplicitContext(message: string, state: UserState): ResolvedContext | null {
    const lower = message.toLowerCase();

    // Check for pronouns referring to last mentioned products
    const hasPronouns = /\b(его|её|этот|этого|этому|на него|на неё|к нему)\b/.test(lower);

    if (hasPronouns && state.lastMentionedProducts.length > 0) {
      const productId = state.lastMentionedProducts[0];
      return {
        originalMessage: message,
        isContextualResponse: false, // Still needs planning
        enrichedMessage: `${message}\n[Контекст: речь о товаре ID=${productId}]`,
      };
    }

    return null;
  }

  /**
   * Extract a number from text
   */
  private extractNumber(text: string): number | null {
    // Remove common currency/unit suffixes
    const cleaned = text
      .replace(/[₽рублей руб.\s]/gi, '')
      .replace(/,/g, '.')
      .trim();

    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }

  /**
   * Extract period from text
   */
  private extractPeriod(text: string): string | null {
    const lower = text.toLowerCase();

    if (/сегодня|today/i.test(lower)) return 'today';
    if (/неделя|недел|week/i.test(lower)) return 'week';
    if (/месяц|month/i.test(lower)) return 'month';
    if (/вчера|yesterday/i.test(lower)) return 'yesterday';
    if (/год|year/i.test(lower)) return 'year';

    return null;
  }

  /**
   * Check if message is a confirmation (yes/no)
   */
  private isConfirmation(text: string): boolean | null {
    const lower = text.toLowerCase();

    // Positive confirmations
    if (
      /^(да|yes|ок|ok|подтвердить|подтверждаю|согласен|давай|го|хорошо|ага|угу|конечно|верно|точно)$/i.test(
        lower
      )
    ) {
      return true;
    }

    // Negative confirmations
    if (/^(нет|no|отмена|отменить|не надо|не нужно|стоп|cancel)$/i.test(lower)) {
      return false;
    }

    // Check for confirmation in longer text
    if (/\b(подтверждаю|согласен|давай)\b/i.test(lower)) return true;
    if (/\b(отмена|не надо|отменить)\b/i.test(lower)) return false;

    return null;
  }
}

// Singleton instance
export const contextResolver = new ContextResolver();
