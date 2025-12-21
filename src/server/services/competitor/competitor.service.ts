// ============================================
// CompetitorService — Сканирование конкурентов WB
// ============================================

import { logger } from '../../utils/logger';

export interface Competitor {
  nmId: number;
  name: string;
  brand: string;
  price: number;
  salePrice: number;
  rating: number;
  feedbackCount: number;
  totalSales: number; // estimate
  position: number;
  priceHistory?: { date: string; price: number }[];
}

export interface ScanResult {
  success: boolean;
  query: string;
  competitors: Competitor[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  yourPosition?: number;
  recommendation?: string;
}

/**
 * CompetitorService
 * Использует публичный API Wildberries для сканирования конкурентов
 */
export class CompetitorService {
  private readonly WB_SEARCH_URL = 'https://search.wb.ru/exactmatch/ru/common/v5/search';
  private readonly WB_CARD_URL = 'https://card.wb.ru/cards/v2/detail';
  private readonly WB_PRICE_HISTORY_URL = 'https://wbx-content-v2.wbstatic.net/price-history';

  /**
   * Сканировать конкурентов по артикулу или ключевому слову
   */
  async scanCompetitors(params: {
    nmId?: number;
    keyword?: string;
    limit?: number;
  }): Promise<ScanResult> {
    const limit = Math.min(params.limit || 10, 50);

    try {
      let searchQuery = params.keyword || '';

      // Если есть артикул — получаем его данные для формирования запроса
      if (params.nmId) {
        const productInfo = await this.getProductInfo(params.nmId);
        if (productInfo) {
          // Используем название товара как поисковый запрос
          searchQuery = productInfo.name.split(' ').slice(0, 3).join(' ');
        }
      }

      if (!searchQuery) {
        return {
          success: false,
          query: '',
          competitors: [],
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          recommendation: 'Укажите артикул или ключевое слово для поиска',
        };
      }

      // Выполняем поиск
      const competitors = await this.searchProducts(searchQuery, limit);

      if (competitors.length === 0) {
        return {
          success: true,
          query: searchQuery,
          competitors: [],
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          recommendation: 'Конкуренты не найдены по данному запросу',
        };
      }

      // Статистика
      const prices = competitors.map(c => c.salePrice);
      const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Позиция нашего товара среди конкурентов
      let yourPosition: number | undefined;
      if (params.nmId) {
        const idx = competitors.findIndex(c => c.nmId === params.nmId);
        if (idx >= 0) yourPosition = idx + 1;
      }

      // Генерируем рекомендацию
      const recommendation = this.generateRecommendation(
        competitors,
        avgPrice,
        minPrice,
        yourPosition
      );

      return {
        success: true,
        query: searchQuery,
        competitors,
        avgPrice,
        minPrice,
        maxPrice,
        yourPosition,
        recommendation,
      };
    } catch (error) {
      logger.error('CompetitorService.scanCompetitors error', error);
      return {
        success: false,
        query: params.keyword || String(params.nmId || ''),
        competitors: [],
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        recommendation: 'Ошибка при сканировании конкурентов',
      };
    }
  }

  /**
   * Получить историю цен конкурента (последние 30 дней)
   */
  async getCompetitorPriceHistory(nmId: number): Promise<{
    success: boolean;
    nmId: number;
    history: { date: string; price: number }[];
    trend: 'up' | 'down' | 'stable';
    priceChange: number;
  }> {
    try {
      // WB хранит историю цен в статических файлах
      // Формат: https://wbx-content-v2.wbstatic.net/price-history/{vol}/{part}/{nmId}.json
      const vol = Math.floor(nmId / 100000);
      const part = Math.floor(nmId / 1000);

      const url = `${this.WB_PRICE_HISTORY_URL}/${vol}/${part}/${nmId}.json`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) {
        // Нет истории цен — вернём пустую
        return {
          success: true,
          nmId,
          history: [],
          trend: 'stable',
          priceChange: 0,
        };
      }

      const data = (await response.json()) as Array<{ dt: number; price: { RUB: number } }>;

      const history = data.map(item => ({
        date: new Date(item.dt * 1000).toISOString().split('T')[0],
        price: Math.round(item.price.RUB / 100), // WB хранит в копейках
      }));

      // Определяем тренд
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let priceChange = 0;

      if (history.length >= 2) {
        const firstPrice = history[0].price;
        const lastPrice = history[history.length - 1].price;
        priceChange = lastPrice - firstPrice;

        if (priceChange > firstPrice * 0.05) {
          trend = 'up';
        } else if (priceChange < -firstPrice * 0.05) {
          trend = 'down';
        }
      }

      return {
        success: true,
        nmId,
        history: history.slice(-30), // Последние 30 дней
        trend,
        priceChange,
      };
    } catch (error) {
      logger.error('CompetitorService.getCompetitorPriceHistory error', error, { nmId });
      return {
        success: false,
        nmId,
        history: [],
        trend: 'stable',
        priceChange: 0,
      };
    }
  }

  /**
   * Получить информацию о товаре по артикулу
   */
  private async getProductInfo(nmId: number): Promise<{
    name: string;
    brand: string;
    price: number;
  } | null> {
    try {
      // WB Card API doesn't need vol/part for direct nmId lookup
      const url = `${this.WB_CARD_URL}?appType=1&curr=rub&dest=-1257786&nm=${nmId}`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as any;
      const product = data.data?.products?.[0];

      if (!product) return null;

      return {
        name: product.name || '',
        brand: product.brand || '',
        price: product.salePriceU ? Math.round(product.salePriceU / 100) : 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Поиск товаров на WB
   */
  private async searchProducts(query: string, limit: number): Promise<Competitor[]> {
    try {
      const url = `${this.WB_SEARCH_URL}?ab_testing=false&appType=1&curr=rub&dest=-1257786&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular&spp=30&suppressSpellcheck=false`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) {
        logger.warn('WB Search API returned non-OK status', { status: response.status });
        return [];
      }

      const data = (await response.json()) as any;
      const products = data.data?.products || [];

      return products.slice(0, limit).map((p: any, idx: number) => ({
        nmId: p.id,
        name: p.name || 'Unknown',
        brand: p.brand || 'Unknown',
        price: p.priceU ? Math.round(p.priceU / 100) : 0,
        salePrice: p.salePriceU ? Math.round(p.salePriceU / 100) : 0,
        rating: p.rating || 0,
        feedbackCount: p.feedbacks || 0,
        totalSales: p.sale || 0, // WB иногда отдаёт приблизительные продажи
        position: idx + 1,
      }));
    } catch (error) {
      logger.error('CompetitorService.searchProducts error', error);
      return [];
    }
  }

  /**
   * Генерация рекомендации на основе анализа конкурентов
   */
  private generateRecommendation(
    competitors: Competitor[],
    avgPrice: number,
    _minPrice: number, // Reserved for future use in recommendations
    yourPosition?: number
  ): string {
    const recommendations: string[] = [];

    // Анализ позиции
    if (yourPosition !== undefined) {
      if (yourPosition <= 3) {
        recommendations.push(`🏆 Вы в ТОП-3! Позиция: ${yourPosition}`);
      } else if (yourPosition <= 10) {
        recommendations.push(
          `📊 Позиция ${yourPosition} из ${competitors.length}. Есть потенциал для роста!`
        );
      } else {
        recommendations.push(
          `⚠️ Позиция ${yourPosition}. Рекомендуем улучшить карточку или скорректировать цену.`
        );
      }
    }

    // Анализ цен
    const cheapCount = competitors.filter(c => c.salePrice < avgPrice * 0.8).length;
    if (cheapCount > competitors.length * 0.3) {
      recommendations.push(`💰 ${cheapCount} конкурентов демпингуют (цена ниже -20% от средней).`);
    }

    // Топ конкурент
    const topCompetitor = competitors[0];
    if (topCompetitor) {
      recommendations.push(
        `🥇 Лидер: ${topCompetitor.brand} — ${topCompetitor.salePrice}₽, рейтинг ${topCompetitor.rating}★, ${topCompetitor.feedbackCount} отзывов`
      );
    }

    return recommendations.join('\n') || 'Данных для рекомендации недостаточно.';
  }
}

export const competitorService = new CompetitorService();
