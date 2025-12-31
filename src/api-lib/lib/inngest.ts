import { Inngest } from 'inngest';

// Создаем клиент Inngest для управления очередями и MoE-событиями
export const inngest = new Inngest({
  id: 'neuro-guardian',
  // В продакшене используем INNGEST_EVENT_KEY из Secrets Guard
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Определяем основные типы событий для гибридной архитектуры
export type NeuroEvents = {
  'ai/query.received': {
    data: {
      userId: number;
      query: string;
      sessionId: string;
      marketplace?: 'WB' | 'Ozon' | 'all';
      wbApiKey?: string;
      ozonClientId?: string;
      ozonApiKey?: string;
    };
  };
  'marketplace/price.check': {
    data: {
      userId: number;
      accountId?: number;
      items?: string[];
    };
  };
  'sentinel/threat.detected': {
    data: {
      userId: number;
      productId: string;
      threatType: string;
      severity: 'warning' | 'critical';
      currentPrice: number;
      minPrice: number;
    };
  };
};
