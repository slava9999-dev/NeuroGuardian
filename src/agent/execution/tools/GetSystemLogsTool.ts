import { defineTool } from '../ToolRegistry.js';
import { GetSystemLogsArgsSchema } from '../../../api-lib/agent/validators.js';
import { getSystemEvents, getUserById } from '../../../api-lib/services/index.js';

export const getSystemLogsTool = defineTool({
  name: 'get_system_logs',
  description: 'Просмотр системных логов и событий (только для администраторов).',
  category: 'read',
  requiresConfirmation: false,
  schema: GetSystemLogsArgsSchema,
  examples: ['Покажи последние системные логи', 'Логи за сегодня'],
  execute: async (userId, args) => {
    // Admin check
    const user = await getUserById(userId);
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const userRole = (user as unknown as Record<string, unknown>)?.role;
    const isAdmin = userRole === 'admin' || (adminId && String(userId) === String(adminId));

    if (!isAdmin)
      return { success: false, error: '⛔ Доступ запрещен. Требуются права администратора.' };

    const logs = await getSystemEvents(args.limit || 20, {
      userId: (args as { user_id?: number }).user_id,
    });

    return {
      success: true,
      data: {
        count: logs.length,
        logs: logs.map(l => ({
          time: l.created_at,
          type: l.event_type,
          entity: l.product_id || l.user_id || l.event_source,
          payload: l.payload,
        })),
      },
    };
  },
});
