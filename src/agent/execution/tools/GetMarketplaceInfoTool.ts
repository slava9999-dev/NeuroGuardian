import { defineTool } from '../ToolRegistry.js';
import { GetMarketplaceInfoArgsSchema } from '../../../api-lib/agent/validators.js';
import { MARKETPLACE_KNOWLEDGE } from '../../../api-lib/data/marketplace-knowledge.js';

export const getMarketplaceInfoTool = defineTool({
  name: 'get_marketplace_info',
  description: 'Справочная информация о правилах маркетплейсов, комиссиях и логистике.',
  category: 'search',
  requiresConfirmation: false,
  schema: GetMarketplaceInfoArgsSchema,
  examples: ['Расскажи про комиссии WB', 'Как работает логистика на Ozon?', 'Сравнение комиссий'],
  execute: async (_userId, args) => {
    const info = MARKETPLACE_KNOWLEDGE as Record<string, Record<string, string>>;
    const topicInfo = info[args.topic];

    if (!topicInfo) {
      return { success: false, error: `Тема "${args.topic}" не надена.` };
    }

    const mpKey = args.marketplace || 'both';
    let content = '';

    if (mpKey === 'both') {
      content = topicInfo.both || `[WB]\n${topicInfo.WB}\n\n[Ozon]\n${topicInfo.Ozon}`;
    } else {
      content = topicInfo[mpKey] || topicInfo.both || 'Нет информации для этого маркетплейса.';
    }

    return {
      success: true,
      data: { topic: args.topic, content },
    };
  },
});
