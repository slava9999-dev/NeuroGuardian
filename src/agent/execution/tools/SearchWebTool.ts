// ============================================
// NeuroGUARDIAN — Search Web Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { defineTool } from '../ToolRegistry.js';

import { SearchWebArgsSchema, type SearchWebArgs } from '../../../api-lib/agent/validators.js';

/**
 * Search Web Tool
 *
 * Searches the internet using Serper.dev (Google Search API)
 * Returns structured results with links
 */
export const searchWebTool = defineTool<SearchWebArgs>({
  name: 'search_web',
  description:
    'Поиск информации в интернете. Используй для общих вопросов, новостей, справки по маркетплейсам.',
  schema: SearchWebArgsSchema,
  category: 'search',
  requiresConfirmation: false,
  examples: [
    'User: "как получить API ключ WB" → search_web({ query: "wildberries API ключ получить инструкция" })',
    'User: "новости маркетплейсов" → search_web({ query: "новости wildberries ozon 2026" })',
  ],

  async execute(_userId, args) {
    try {
      const serperKey = process.env.SERPER_API_KEY;

      if (!serperKey) {
        return {
          success: false,
          error: 'Поиск временно недоступен. Попробуйте позже.',
        };
      }

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: args.query,
          gl: 'ru',
          hl: 'ru',
          num: args.num_results,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Ошибка поиска: ${response.status}`,
        };
      }

      const data = (await response.json()) as SerperResponse;

      // Extract answer box if available
      let directAnswer: string | null = null;
      if (data.answerBox) {
        directAnswer = data.answerBox.answer || data.answerBox.snippet || null;
      }

      // Extract knowledge graph if available
      let knowledgeGraph: SerperResponse['knowledgeGraph'] | null = null;
      if (data.knowledgeGraph) {
        knowledgeGraph = {
          title: data.knowledgeGraph.title,
          type: data.knowledgeGraph.type,
          description: data.knowledgeGraph.description,
        };
      }

      // Format organic results
      const results = (data.organic || []).slice(0, args.num_results).map(r => ({
        title: r.title || '',
        link: r.link || '',
        snippet: r.snippet || '',
        position: r.position,
      }));

      // Extract URLs for link validation
      const urls = results.map(r => r.link).filter(Boolean);

      return {
        success: true,
        data: {
          query: args.query,
          directAnswer,
          knowledgeGraph,
          results,
          totalResults: results.length,
        },
        urls,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка поиска: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Serper API types
interface SerperResponse {
  organic?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    position?: number;
  }>;
  answerBox?: {
    answer?: string;
    snippet?: string;
  };
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
  };
}
