import { serve } from 'inngest/next';
import { inngest } from '../lib/inngest.js';
import {
  processMoEQuery,
  backgroundPriceCheck,
  scheduledSentinelCycle,
} from '../services/inngest-functions.js';

// Регистрируем все Inngest функции для Vercel
export const handleInngest = serve({
  client: inngest,
  functions: [
    processMoEQuery, // MoE query routing
    backgroundPriceCheck, // On-demand price checks
    scheduledSentinelCycle, // 30-min automated monitoring
  ],
});
