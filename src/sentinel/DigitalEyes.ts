import { logger } from '../api-lib/lib/logger.js';
import { llmRouter } from '../infrastructure/llm/LLMRouter.js';
import * as cheerio from 'cheerio';

interface EyesResult {
  buyerPrice: number;
  originalPrice: number;
  cardPrice?: number;
  promoType?: string; // 'WB Wallet', 'Ozon Card'
  stockStatus: 'in_stock' | 'out_of_stock';
  screenshotUrl?: string; // Future implementation
  [key: string]: unknown; // Index signature for logger compatibility
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

    // STRATEGY: Extract structured data first (JSON-LD, script data), then fallback to text
    const structuredData: string[] = [];

    // 1. Extract JSON-LD (common for product data)
    $('script[type="application/ld+json"]').each((_, elem) => {
      const jsonText = $(elem).html();
      if (jsonText && (jsonText.includes('price') || jsonText.includes('Price'))) {
        structuredData.push(`JSON-LD: ${jsonText}`);
      }
    });

    // 2. Extract WB-specific data objects from scripts
    if (marketplace === 'WB') {
      $('script').each((_, elem) => {
        const scriptContent = $(elem).html() || '';
        // Look for common WB data patterns
        if (
          scriptContent.includes('"price"') ||
          scriptContent.includes('"salePriceU"') ||
          scriptContent.includes('"priceU"') ||
          scriptContent.includes('nmId')
        ) {
          // Extract just the relevant JSON object (limit to 2000 chars per script)
          const relevantPart = scriptContent.substring(0, 2000);
          structuredData.push(`WB-Script-Data: ${relevantPart}`);
        }
      });
    }

    // 3. Clean up DOM and extract visible text
    $('style').remove();
    $('svg').remove();
    $('noscript').remove();
    $('footer').remove();
    $('header').remove();
    $('script').remove(); // Remove after extraction
    $('.cookie-banner').remove();

    // Extract visible text
    const visibleText = $('body').text().replace(/\s+/g, ' ').trim();

    // 4. Combine structured data + visible text (prioritize structured)
    const combined = [...structuredData, `Visible-Text: ${visibleText.substring(0, 10000)}`].join(
      '\n\n'
    );

    // Limit total context
    return combined.substring(0, 25000);
  }

  private async askIntelligence(marketplace: 'WB' | 'Ozon', content: string): Promise<EyesResult> {
    const prompt = `
Ты — ИИ-агент Sentinel Digital Eyes. Извлеки РЕАЛЬНУЮ цену покупателя из данных страницы ${marketplace}.

**ПРИОРИТЕТ ИСТОЧНИКОВ ДАННЫХ:**
1. JSON-LD (application/ld+json) - ищи поля "price", "offers.price"
2. WB-Script-Data - ищи "salePriceU" (цена в копейках, раздели на 100), "priceU", "price"
3. Visible-Text - ищи числа с символом ₽, особенно рядом со словами "кошелек", "карта", "скидка"

**ПРАВИЛА ИЗВЛЕЧЕНИЯ ДЛЯ WB:**
- "salePriceU": 123456 означает 1234.56 ₽ (делим на 100)
- "priceU": 234567 означает 2345.67 ₽ (старая цена)
- Ищи МИНИМАЛЬНУЮ цену (обычно зеленая/фиолетовая с иконкой кошелька)
- Если товар "Нет в наличии" / "out of stock" → stockStatus: "out_of_stock"

**ДАННЫЕ СТРАНИЦЫ:**
"""
${content}
"""

**ВЕРНИ ТОЛЬКО JSON (без markdown, без комментариев):**
{
  "buyerPrice": <число или null>,
  "originalPrice": <число или null>,
  "cardPrice": <число или null>,
  "stockStatus": "in_stock" | "out_of_stock"
}

**ВАЖНО:** Если нашел "salePriceU" или "priceU" в JSON - используй их в первую очередь!
    `;

    const response = await llmRouter.complete([{ role: 'user', content: prompt }]);

    try {
      // Clean up markdown block if present
      const jsonStr = response.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.warn('[DigitalEyes] Failed to parse LLM response', {
        response: response.content,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('LLM JSON parse error');
    }
  }
}

export const digitalEyes = new DigitalEyes();
