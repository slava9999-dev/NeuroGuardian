// ============================================
// NeuroGUARDIAN — Products Specialist
// Handles product queries, sync, and settings
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';

export class ProductsSpecialist extends BaseSpecialist {
  readonly name = 'ProductsSpecialist';
  readonly description = 'Handles product queries, search, sync, and settings';

  readonly tools = [
    'get_products',
    'update_product_settings',
    'get_low_margin_products',
    'get_real_price',
  ];

  readonly systemPrompt = `# Виктор — Специалист по товарам

Ты отвечаешь за работу с товарами пользователя:
- Показ списка товаров
- Поиск товаров по названию или артикулу
- Настройки товаров (минимальная цена, себестоимость)
- Получение реальной цены с маркетплейса

## ПРАВИЛА:
1. Используй get_products для получения списка товаров
2. Если пользователь спрашивает про конкретный товар — используй search параметр
3. Для низкомаржинальных товаров — используй get_low_margin_products
4. Для реальной цены на WB — используй get_real_price

## ФОРМАТ ОТВЕТА:
- Используй эмодзи для акцентов
- Форматируй цены с ₽
- Будь кратким но информативным`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- Товаров: ${context.userState.productsCount}`);
    lines.push(`- API ключи: ${context.userState.hasApiKeys ? '✅ есть' : '❌ нет'}`);

    // Fetch recent products summary if available
    if (context.userState.hasApiKeys && context.userState.productsCount > 0) {
      try {
        const result = await sql`
          SELECT marketplace, COUNT(*) as count, 
                 COUNT(*) FILTER (WHERE min_price IS NOT NULL) as protected
          FROM products 
          WHERE user_id = ${context.userId}
          GROUP BY marketplace
        `;

        if (result.rows.length > 0) {
          lines.push('\n## СТАТИСТИКА ТОВАРОВ');
          for (const row of result.rows) {
            lines.push(`- ${row.marketplace}: ${row.count} шт (защищено: ${row.protected})`);
          }
        }
      } catch (e) {
        // Ignore DB errors, continue with minimal context
      }
    }

    return lines.join('\n');
  }
}

export const productsSpecialist = new ProductsSpecialist();
