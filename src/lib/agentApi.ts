// ============================================
// NeuroGUARDIAN — Agent API Client
// API client for AI agent functionality
// ============================================

import { getInitData } from './telegram';

// API base - uses /api for Vercel
const API_BASE = '/api';

// ============================================
// V4 AGENT CONFIGURATION
// Set to true to use the new two-phase pipeline
// ============================================
const USE_V4_AGENT = true;

// Agent message types
export interface AgentMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// V4 Response with structured links
export interface AgentV4Response {
  success: boolean;
  message: string;
  links?: Array<{
    title: string;
    url: string;
    source: 'search_web' | 'marketplace' | 'documentation';
  }>;
  actions?: Array<{
    type: string;
    summary: string;
    details: Record<string, unknown>;
    affected_count: number;
  }>;
  data?: Record<string, unknown>;
  metadata?: {
    totalTime?: number;
    planningTime?: number;
    executionTime?: number;
    answeringTime?: number;
    tokensUsed?: number;
    toolsCalled?: string[];
  };
}

export interface AgentResponse {
  success: boolean;
  content: string;
  actionRequired?: {
    type: 'confirmation';
    operation: string;
    details: Record<string, unknown>;
    confirmationMessage: string;
  };
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsUsed?: string[];
    model?: string;
    complexity?: 'simple' | 'complex';
  };
  error?: string;
}

export interface ConfirmationResponse {
  success: boolean;
  content: string;
  operation: string;
  executed: boolean;
}

// Task complexity classification
export type TaskComplexity = 'simple' | 'complex';

const COMPLEX_PATTERNS = [
  'оптимизируй',
  'проанализируй',
  'почему',
  'стратегия',
  'рекомендации',
  'если.*то',
  'помоги',
  'как лучше',
];

// Classify task complexity for UI feedback
export function classifyComplexity(message: string): TaskComplexity {
  const lowerMessage = message.toLowerCase();

  for (const pattern of COMPLEX_PATTERNS) {
    if (new RegExp(pattern).test(lowerMessage)) {
      return 'complex';
    }
  }

  return 'simple';
}

// Helper to get auth headers for API requests
function getAuthHeaders(): HeadersInit {
  const initData = getInitData();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // DEBUG: Log auth state
  console.log('🔐 [getAuthHeaders] Debug:', {
    hasInitData: !!initData,
    initDataLength: initData?.length,
    VITE_DEV_MODE: import.meta.env.VITE_DEV_MODE,
    hasAdminKey: !!import.meta.env.VITE_ADMIN_API_KEY,
    adminKeyPrefix: import.meta.env.VITE_ADMIN_API_KEY?.substring(0, 8),
  });

  if (initData) {
    headers['X-Init-Data'] = initData;
    console.log('🔐 Using Telegram initData');
  } else if (import.meta.env.VITE_DEV_MODE === 'true' && import.meta.env.VITE_ADMIN_API_KEY) {
    // Dev mode: use admin key
    headers['X-Admin-Key'] = import.meta.env.VITE_ADMIN_API_KEY;
    console.log('🔐 Using Admin API Key');
  } else {
    console.warn('⚠️ No auth method available!');
  }

  return headers;
}

// Agent API
export const agentApi = {
  /**
   * Send a message to the AI agent
   * Uses V4 (two-phase pipeline) when USE_V4_AGENT is true
   */
  sendMessage: async (message: string, history: AgentMessage[] = []): Promise<AgentResponse> => {
    const initData = getInitData();
    const action = USE_V4_AGENT ? 'agent-v4' : 'agent';

    // Build URL with telegramId for dev mode
    let url = `${API_BASE}?action=${action}`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action,
          message,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // V4 returns 'message' field, V3 returns 'content' field
      if (USE_V4_AGENT) {
        const v4Data = data as AgentV4Response;

        // Handle error responses from server
        if (!v4Data.success && !v4Data.message) {
          return {
            success: false,
            content: '❌ Произошла ошибка при обработке запроса. Попробуйте ещё раз.',
            error: 'Empty response from server',
          };
        }

        // Build content with links formatted as markdown
        let content = v4Data.message || '❌ Не удалось получить ответ';

        // Append validated links section if present
        if (v4Data.links && v4Data.links.length > 0) {
          content += '\n\n**🔗 Ссылки:**\n';
          for (const link of v4Data.links) {
            content += `- [${link.title}](${link.url})\n`;
          }
        }

        return {
          success: v4Data.success,
          content,
          metadata: {
            tokensUsed: v4Data.metadata?.tokensUsed,
            executionTime: v4Data.metadata?.totalTime,
            toolsUsed: v4Data.metadata?.toolsCalled,
            model: 'v4-pipeline',
          },
        };
      }

      return data;
    } catch (error) {
      console.error('Agent API error:', error);

      // Handle specific error types with user-friendly messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = '❌ Не удалось связаться с агентом. Попробуйте ещё раз.';

      if (errorMessage.includes('SyntaxError') || errorMessage.includes('JSON')) {
        userMessage = '⚠️ Агент получил неполный ответ. Попробуйте уточнить запрос или повторить.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        userMessage =
          '⏰ Запрос занял слишком много времени. Попробуйте задать более простой вопрос.';
      } else if (errorMessage.includes('429')) {
        userMessage = '🔄 Слишком много запросов. Подождите минуту и попробуйте снова.';
      }

      // AUDIT-2025-12-28: Mock fallback removed for production safety
      // All environments now get explicit error messages
      return {
        success: false,
        content: userMessage,
        error: errorMessage,
      };
    }
  },

  /**
   * Confirm or cancel an operation
   */
  confirmAction: async (
    operation: string,
    confirmed: boolean,
    details: Record<string, unknown>
  ): Promise<AgentResponse> => {
    const initData = getInitData();
    let url = `${API_BASE}?action=agent-confirm`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'agent-confirm',
          operation,
          confirmed,
          details,
          initData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Confirm API error:', error);

      // AUDIT-2025-12-28: Mock fallback removed
      return {
        success: false,
        content: confirmed ? '❌ Не удалось выполнить операцию.' : '👍 Операция отменена.',
      };
    }
  },

  /**
   * Get agent capabilities and status
   */
  getStatus: async (): Promise<{
    available: boolean;
    model: string;
    capabilities: string[];
  }> => {
    const initData = getInitData();
    let url = `${API_BASE}?action=agent-status`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch {
      return {
        available: import.meta.env.DEV,
        model: 'gpt-4o-mini',
        capabilities: ['Статистика продаж', 'Управление ценами', 'Защита товаров', 'Аналитика'],
      };
    }
  },

  /**
   * Load chat history from server
   */
  loadHistory: async (): Promise<AgentMessage[]> => {
    const initData = getInitData();
    let url = `${API_BASE}?action=get-chat-history`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Load history error:', error);
      return [];
    }
  },

  /**
   * Save chat history to server
   */
  saveHistory: async (messages: AgentMessage[]): Promise<boolean> => {
    const initData = getInitData();
    let url = `${API_BASE}?action=save-chat-history`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'save-chat-history',
          messages,
          initData,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Save history error:', error);
      return false;
    }
  },

  /**
   * Clear chat history on server
   */
  clearHistory: async (): Promise<boolean> => {
    const initData = getInitData();
    let url = `${API_BASE}?action=clear-chat-history`;
    if (!initData && import.meta.env.VITE_DEV_MODE === 'true') {
      url += '&telegramId=7548070478';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'clear-chat-history',
          initData,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Clear history error:', error);
      return false;
    }
  },
};

// NOTE: Mock response function removed for production safety (AUDIT-2025-12-28)
// All agent interactions now go through the real API endpoint

export default agentApi;
