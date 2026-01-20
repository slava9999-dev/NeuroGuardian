import { logger } from '../api-lib/lib/logger';
import { geminiFlash } from '../infrastructure/llm/GeminiProvider';
import * as cheerio from 'cheerio';

interface EyesResult {
  buyerPrice: number;
  originalPrice: number;
  cardPrice?: number;
  promoType?: string; // 'WB Wallet', 'Ozon Card'
  stockStatus: 'in_stock' | 'out_of_stock';
  screenshotUrl?: string; // Future implementation
}

export class DigitalEyes {
  /**
   * "Looks" at a product page to find the true buyer price
   */
  async gazeAtProduct(marketplace: 'WB' | 'Ozon', url: string): Promise<EyesResult | null> {
    const startTime = Date.now();
    logger.info(`[DigitalEyes] Gazing at ${marketplace} product: ${url}`);

    try {
      // 1. Fetch Page Content ( mimicking a real browser user agent )
      const html = await this.fetchPageContent(url);

      if (!html) {
        throw new Error('Failed to load page content');
      }

      // 2. Reduce noise (Keep only relevant text/structure)
      const cleanContent = this.distillContent(html, marketplace);

      // 3. Ask Intelligence (LLM) to extract the price
      const extraction = await this.askIntelligence(marketplace, cleanContent);

      logger.info(`[DigitalEyes] Analysis complete in ${Date.now() - startTime}ms`, extraction);
      return extraction;
    } catch (error) {
      logger.error('[DigitalEyes] Failed to see product', {
        marketplace,
        url,
        error: error instanceof Error ? error.message : String(error),
        // Note: 'error' object logged might be large, sanitized in logger usually
      });
      return null;
    }
  }

  private async fetchPageContent(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout for mobile emulation

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        signal: controller.signal,
      });

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private distillContent(html: string, marketplace: 'WB' | 'Ozon'): string {
    const $ = cheerio.load(html);

    // Remove scripts (unless needed), styles, svgs to reduce token count
    // NOTE: Some WB prices are in JSON inside <script> tags.
    // For now, we keep text, but if we parsed JSON-LD it would be better.
    // Let's strip style/svg but keep script content if it looks like JSON?
    // No, standard text "vision" is safer for generic LLM.

    $('style').remove();
    $('svg').remove();
    $('noscript').remove();
    $('footer').remove();
    $('header').remove();

    // Specific cleanup
    $('.cookie-banner').remove();

    // Extract text and condense whitespace
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Limit context window
    return text.substring(0, 20000);
  }

  private async askIntelligence(marketplace: 'WB' | 'Ozon', content: string): Promise<EyesResult> {
    const prompt = `
    Ты — ИИ-агент Sentinel Digital Eyes. Твоя задача — извлечь РЕАЛЬНУЮ цену для покупателя из текста страницы маркетплейса ${marketplace}.
    
    МАРКЕТПЛЕЙСЫ СКРЫВАЮТ ЦЕНЫ ДЛЯ ПОКУПАТЕЛЕЙ (WB Кошелек, Ozon Карта).
    Твоя цель — найти именно эту, САМУЮ НИЗКУЮ цену, выделенную цветом (зеленым/фиолетовым).

    Контент страницы (шумный текст):
    """
    ${content}
    """

    Верни JSON (без markdown):
    {
      "buyerPrice": number (цена С картой/кошельком, самая низкая),
      "originalPrice": number (зачеркнутая цена),
      "cardPrice": number (цена по карте, если есть, иначе null),
      "stockStatus": "in_stock" | "out_of_stock"
    }

    Если не можешь найти цену, верни null в значениях, но попытайся угадать по контексту (числа рядом с символом ₽).
    `;

    const response = await geminiFlash.complete([{ role: 'user', content: prompt }]);

    try {
      // Clean up markdown block if present
      const jsonStr = response.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      logger.warn('[DigitalEyes] Failed to parse LLM response', { response: response.content });
      throw new Error('LLM JSON parse error');
    }
  }
}

export const digitalEyes = new DigitalEyes();
