// ============================================
// NeuroGUARDIAN — Specialist Knowledge Base
// Context retrieval for each specialist agent
// Version: 1.0.0 | Date: January 2026
// ============================================

import { vectorStore, type SearchResult, type EmbeddingNamespace } from './VectorStore.js';
import { logger } from '../../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export type SpecialistType =
  | 'ProductsSpecialist'
  | 'PricingSpecialist'
  | 'SentinelSpecialist'
  | 'AnalyticsSpecialist'
  | 'ChatSpecialist';

export interface RetrievedContext {
  documents: SearchResult[];
  formattedContext: string;
  tokensEstimate: number;
}

// ============================================
// Specialist to Namespace Mapping
// ============================================

const SPECIALIST_NAMESPACES: Record<SpecialistType, EmbeddingNamespace[]> = {
  ProductsSpecialist: ['wb_api', 'ozon_api', 'faq'],
  PricingSpecialist: ['wb_api', 'ozon_api', 'pricing', 'sentinel'],
  SentinelSpecialist: ['sentinel', 'pricing', 'wb_api', 'ozon_api'],
  AnalyticsSpecialist: ['analytics', 'pricing', 'faq'],
  ChatSpecialist: ['faq', 'onboarding'],
};

// ============================================
// Specialist Knowledge Base
// ============================================

export class SpecialistKnowledgeBase {
  private maxTokens: number;
  private maxDocuments: number;

  constructor(options?: { maxTokens?: number; maxDocuments?: number }) {
    this.maxTokens = options?.maxTokens || 2000;
    this.maxDocuments = options?.maxDocuments || 5;
  }

  /**
   * Retrieve context for a specific specialist
   */
  async retrieveForSpecialist(
    query: string,
    specialist: SpecialistType
  ): Promise<RetrievedContext> {
    const namespaces = SPECIALIST_NAMESPACES[specialist];

    try {
      const results = await vectorStore.search(query, {
        namespace: namespaces,
        limit: this.maxDocuments,
        threshold: 0.5,
      });

      return this.formatContext(results, specialist);
    } catch (error) {
      logger.error(`[SpecialistKB] Error retrieving for ${specialist}:`, error);
      return {
        documents: [],
        formattedContext: '',
        tokensEstimate: 0,
      };
    }
  }

  /**
   * Retrieve context with hybrid search (better for Russian)
   */
  async retrieveHybrid(query: string, specialist: SpecialistType): Promise<RetrievedContext> {
    const namespaces = SPECIALIST_NAMESPACES[specialist];

    try {
      const results = await vectorStore.hybridSearch(query, {
        namespace: namespaces,
        limit: this.maxDocuments,
        vectorWeight: 0.6, // Slightly favor text for Russian
      });

      return this.formatContext(results, specialist);
    } catch (error) {
      logger.error(`[SpecialistKB] Hybrid search error:`, error);
      return {
        documents: [],
        formattedContext: '',
        tokensEstimate: 0,
      };
    }
  }

  /**
   * Format results into context string
   */
  private formatContext(results: SearchResult[], specialist: SpecialistType): RetrievedContext {
    if (results.length === 0) {
      return {
        documents: [],
        formattedContext: '',
        tokensEstimate: 0,
      };
    }

    // Build formatted context
    const contextParts: string[] = [`## Релевантная информация для ${specialist}:`, ''];

    let totalChars = 0;
    const maxChars = this.maxTokens * 4; // Rough token-to-char ratio

    for (const doc of results) {
      // Check if we're exceeding token limit
      if (totalChars + doc.content.length > maxChars) {
        // Truncate if needed
        const remaining = maxChars - totalChars;
        if (remaining > 200) {
          contextParts.push(
            `### ${doc.title || 'Документ'} (similarity: ${(doc.similarity * 100).toFixed(0)}%)`
          );
          contextParts.push(doc.content.slice(0, remaining) + '...');
          totalChars = maxChars;
        }
        break;
      }

      contextParts.push(
        `### ${doc.title || 'Документ'} (similarity: ${(doc.similarity * 100).toFixed(0)}%)`
      );
      contextParts.push(doc.content);
      contextParts.push('');
      totalChars += doc.content.length;
    }

    const formattedContext = contextParts.join('\n');

    return {
      documents: results,
      formattedContext,
      tokensEstimate: Math.ceil(totalChars / 4),
    };
  }

  /**
   * Get available namespaces for a specialist
   */
  getNamespacesForSpecialist(specialist: SpecialistType): EmbeddingNamespace[] {
    return SPECIALIST_NAMESPACES[specialist];
  }

  /**
   * Check if vector store is ready
   */
  async isReady(): Promise<boolean> {
    try {
      const stats = await vectorStore.getStats();
      return stats.totalDocuments > 0;
    } catch {
      return false;
    }
  }
}

// Singleton
export const specialistKnowledgeBase = new SpecialistKnowledgeBase();
