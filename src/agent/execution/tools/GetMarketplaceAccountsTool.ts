import { defineTool } from '../ToolRegistry.js';
import { GetMarketplaceAccountsArgsSchema } from '../../../api-lib/agent/validators.js';
import { getMarketplaceAccounts } from '../../../api-lib/services/users.js';

export const getMarketplaceAccountsTool = defineTool({
  name: 'get_marketplace_accounts',
  description: 'Список подключенных аккаунтов WB и Ozon.',
  category: 'read',
  requiresConfirmation: false,
  schema: GetMarketplaceAccountsArgsSchema,
  examples: ['Какие аккаунты у меня подключены?', 'Покажи мои личные кабинеты'],
  execute: async (userId, args) => {
    const accounts = await getMarketplaceAccounts(userId);
    let filtered = accounts;
    if (args.marketplace !== 'all') {
      filtered = accounts.filter(
        a => a.marketplace.toLowerCase() === args.marketplace.toLowerCase()
      );
    }

    return {
      success: true,
      data: {
        total: accounts.length,
        accounts: filtered.map(a => ({
          id: a.id,
          name: a.name,
          marketplace: a.marketplace,
          isActive: a.is_active,
          lastSync: a.last_sync_at,
        })),
      },
    };
  },
});
