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
      userId: string;
      query: string;
      context?: any;
    };
  };
  'marketplace/price.check': {
    data: {
      items: string[];
      forceLocal?: boolean;
    };
  };
};
