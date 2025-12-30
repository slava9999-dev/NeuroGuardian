import { serve } from 'inngest/next';
import { inngest } from '../lib/inngest.js';
import { processMoEQuery, backgroundPriceCheck } from '../services/inngest-functions.js';

// Экспортируем обработчик для Vercel
export const handleInngest = serve({
  client: inngest,
  functions: [processMoEQuery, backgroundPriceCheck],
});
