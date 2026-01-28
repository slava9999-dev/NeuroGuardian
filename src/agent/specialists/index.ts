// ============================================
// NeuroGUARDIAN — Specialists Index
// Exports all specialist agents
// Version: 1.0.0 | Date: January 2026
// ============================================

export { BaseSpecialist, type SpecialistResult, type SpecialistContext } from './BaseSpecialist.js';
export { ProductsSpecialist, productsSpecialist } from './ProductsSpecialist.js';
export { PricingSpecialist, pricingSpecialist } from './PricingSpecialist.js';
export { SentinelSpecialist, sentinelSpecialist } from './SentinelSpecialist.js';
export { AnalyticsSpecialist, analyticsSpecialist } from './AnalyticsSpecialist.js';
export { ChatSpecialist, chatSpecialist } from './ChatSpecialist.js';
export {
  classifyIntent,
  classifyIntentSync,
  type ClassificationResult,
} from './IntentClassifier.js';
export {
  MultiAgentOrchestrator,
  multiAgentOrchestrator,
  orchestrateMultiAgent,
  type MultiAgentResult,
} from './MultiAgentOrchestrator.js';

import type { BaseSpecialist } from './BaseSpecialist.js';
import { productsSpecialist } from './ProductsSpecialist.js';
import { pricingSpecialist } from './PricingSpecialist.js';
import { sentinelSpecialist } from './SentinelSpecialist.js';
import { analyticsSpecialist } from './AnalyticsSpecialist.js';
import { chatSpecialist } from './ChatSpecialist.js';

/**
 * Intent categories for routing
 */
export type IntentCategory = 'PRODUCTS' | 'PRICING' | 'SENTINEL' | 'ANALYTICS' | 'CHAT';

/**
 * Get specialist by intent category
 */
export function getSpecialist(intent: IntentCategory): BaseSpecialist {
  switch (intent) {
    case 'PRODUCTS':
      return productsSpecialist;
    case 'PRICING':
      return pricingSpecialist;
    case 'SENTINEL':
      return sentinelSpecialist;
    case 'ANALYTICS':
      return analyticsSpecialist;
    case 'CHAT':
    default:
      return chatSpecialist;
  }
}

/**
 * All available specialists
 */
export const specialists: Record<IntentCategory, BaseSpecialist> = {
  PRODUCTS: productsSpecialist,
  PRICING: pricingSpecialist,
  SENTINEL: sentinelSpecialist,
  ANALYTICS: analyticsSpecialist,
  CHAT: chatSpecialist,
};
