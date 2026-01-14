// ============================================
// NeuroGUARDIAN — Sentinel Specialist
// Handles threats, competitors, protection status
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';

export class SentinelSpecialist extends BaseSpecialist {
  readonly name = 'SentinelSpecialist';
  readonly description = 'Handles price protection threats, competitors, and Sentinel status';

  readonly tools = ['get_competitor_price', 'get_system_logs'];

  readonly systemPrompt = `# Виктор — Специалист по защите (Sentinel)

Ты отвечаешь за систему защиты цен Sentinel:
- Статус защиты товаров
- Обнаруженные угрозы
- Анализ конкурентов
- История срабатываний

## ПРАВИЛА:
1. Для анализа конкурентов — используй get_competitor_price
2. Для логов системы — используй get_system_logs
3. Предоставляй информацию о текущих угрозах и защите

## ФОРМАТ ОТВЕТА:
- Используй 🛡️ для защищённых товаров
- Используй ⚠️ для угроз
- Используй 📉 для падений цен
- Будь информативным о статусе защиты`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## SENTINEL КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);

    // Fetch Sentinel stats
    if (context.userState.hasApiKeys) {
      try {
        const result = await sql`
          SELECT 
            COUNT(*) FILTER (WHERE min_price IS NOT NULL) as protected,
            COUNT(*) as total
          FROM products 
          WHERE user_id = ${context.userId}
        `;

        if (result.rows[0]) {
          const { protected: prot, total } = result.rows[0];
          lines.push(`\n## СТАТУС ЗАЩИТЫ`);
          lines.push(`- Защищено: ${prot}/${total} товаров`);
          lines.push(`- Покрытие: ${total > 0 ? Math.round((prot / total) * 100) : 0}%`);
        }

        // Recent threats
        const threats = await sql`
          SELECT COUNT(*) as count
          FROM system_logs
          WHERE user_id = ${context.userId}
            AND action LIKE '%threat%'
            AND created_at > NOW() - INTERVAL '24 hours'
        `;

        if (threats.rows[0]?.count > 0) {
          lines.push(`\n⚠️ Угроз за 24ч: ${threats.rows[0].count}`);
        }
      } catch (e) {
        // Ignore DB errors
      }
    }

    return lines.join('\n');
  }
}

export const sentinelSpecialist = new SentinelSpecialist();
