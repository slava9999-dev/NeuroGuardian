// ============================================
// NeuroGUARDIAN — Browser-Based Digital Eyes
// Real browser automation for accurate price extraction
// Version: 2.1.0 | Date: January 2026
// Anti-Bot Protection: Stealth Mode Enabled
// ============================================

import { chromium } from 'playwright-extra';
import type { Browser, Page, BrowserContext } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '../api-lib/lib/logger.js';
import { proxyService } from '../api-lib/services/proxy-service.js';
import { anonymizeProxy, closeAnonymizedProxy } from 'proxy-chain';

interface BrowserEyesResult {
  buyerPrice: number | null;
  originalPrice: number | null;
  cardPrice: number | null;
  promoType?: string; // 'WB Wallet', 'Ozon Card'
  stockStatus: 'in_stock' | 'out_of_stock';
  screenshotUrl?: string;
  extractionMethod: 'dom' | 'vision' | 'hybrid';
  confidence: number; // 0-1
}

// Performance metrics for monitoring
interface BrowserEyesMetrics {
  totalRequests: number;
  successfulExtractions: number;
  failedExtractions: number;
  avgDurationMs: number;
  peakDurationMs: number;
  lastError: string | null;
  lastErrorTime: Date | null;
  byMarketplace: {
    WB: { success: number; failed: number; avgDuration: number };
    Ozon: { success: number; failed: number; avgDuration: number };
  };
}

export class BrowserEyes {
  private browser: Browser | null = null;

  // Performance metrics
  private metrics: BrowserEyesMetrics = {
    totalRequests: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    avgDurationMs: 0,
    peakDurationMs: 0,
    lastError: null,
    lastErrorTime: null,
    byMarketplace: {
      WB: { success: 0, failed: 0, avgDuration: 0 },
      Ozon: { success: 0, failed: 0, avgDuration: 0 },
    },
  };

  /**
   * Initialize browser instance (reusable) with stealth mode
   * Supports local launch and remote browserless cluster
   */
  async init(): Promise<void> {
    if (this.browser) return;

    const browserlessUrl = process.env.BROWSERLESS_URL; // e.g. ws://localhost:3002

    if (browserlessUrl) {
      logger.info(`[BrowserEyes] Connecting to remote cluster: ${browserlessUrl}`);
      this.browser = await chromium.connectOverCDP(browserlessUrl);
    } else {
      logger.info('[BrowserEyes] Launching local Chromium with Stealth Mode...');
      // Apply stealth plugin to avoid detection
      chromium.use(StealthPlugin());

      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-features=IsolateOrigins,site-per-process',
          '--lang=ru-RU',
        ],
      });
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('[BrowserEyes] Browser closed');
    }
  }

  /**
   * Main method: Extract real buyer price using browser
   * IMPROVED: Added retry loop with proxy rotation
   */
  async gazeAtProduct(
    marketplace: 'WB' | 'Ozon',
    url: string,
    options?: {
      useVision?: boolean; // Use AI vision analysis
      waitForAuth?: boolean; // Wait for user to login (future)
      saveScreenshot?: boolean; // Save screenshot to result
      maxRetries?: number;
    }
  ): Promise<BrowserEyesResult> {
    const maxRetries = options?.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      let proxyConfig: import('../api-lib/services/proxy-service.js').ProxyConfig | null = null;
      let context: BrowserContext | null = null;
      let page: Page | null = null;
      let anonymizedProxyUrl: string | null = null;

      try {
        await this.init();
        if (!this.browser) throw new Error('Browser not initialized');

        proxyConfig = await proxyService.getNextProxyConfig();
        const isOzon = marketplace === 'Ozon';

        // Use Social Crawler identity for Ozon as it currently works best
        const userAgent = isOzon
          ? 'WhatsApp/2.21.12.21 A' // WhatsApp Social Crawler bypass
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

        const contextOptions: {
          viewport: { width: number; height: number };
          userAgent: string;
          locale: string;
          timezoneId: string;
          extraHTTPHeaders: Record<string, string>;
          proxy?: { server: string; username?: string; password?: string };
        } = {
          viewport: isOzon ? { width: 1440, height: 900 } : { width: 1920, height: 1080 },
          userAgent,
          locale: 'ru-RU',
          timezoneId: 'Europe/Moscow',
          extraHTTPHeaders: {
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'max-age=0',
            Connection: 'keep-alive',
            // Change referer to look like internal navigation or direct traffic
            Referer: 'https://www.wildberries.ru/',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
        };

        if (proxyConfig) {
          // Construct full URL with credentials for proxy-chain
          const proxyUrl = new URL(proxyConfig.server);
          if (proxyConfig.username && proxyConfig.password) {
            proxyUrl.username = proxyConfig.username;
            proxyUrl.password = proxyConfig.password;
          }
          const upstreamUrl = proxyUrl.toString();

          // "Chain" the proxy: Create a local HTTP proxy that forwards to the upstream SOCKS5/HTTP
          // This solves Playwright's inability to handle SOCKS5 auth
          anonymizedProxyUrl = await anonymizeProxy(upstreamUrl);

          logger.info(
            `[BrowserEyes] Attempt ${attempt}: Chained proxy ${upstreamUrl} -> ${anonymizedProxyUrl}`
          );

          contextOptions.proxy = {
            server: anonymizedProxyUrl,
            // parsed properties are not needed here, proxy-chain handles auth
          };
        }

        context = await this.browser.newContext(contextOptions);
        page = await context.newPage();

        // Anti-Detection Scripts
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru'] });
        });

        logger.info(`[BrowserEyes] Navigating to ${marketplace}: ${url}`);

        // Navigation with timeout and retry-safe wait
        await page.goto(url, {
          waitUntil: marketplace === 'WB' ? 'load' : 'domcontentloaded',
          timeout: 60000,
        });

        // Check for blocks, but give it a chance to pass (e.g. Cloudflare turnstile)
        let content = await page.content();
        if (content.includes('Доступ ограничен') || content.includes('challenge')) {
          logger.warn('[BrowserEyes] Detected potential block. Waiting 5s for redirect...');
          await page.waitForTimeout(5000);
          content = await page.content();

          if (content.includes('Доступ ограничен') || content.includes('challenge')) {
            await page.screenshot({ path: 'blocked-page.png', fullPage: true });
            logger.error(
              '[BrowserEyes] Still blocked. Screenshot saved to updated blocked-page.png'
            );
            throw new Error('Blocked by Marketplace (Antibot)');
          }
        }

        await this.simulateHumanBehavior(page);
        await this.waitForPriceElements(page, marketplace);

        const result = await this.extractPriceFromDOM(page, marketplace);

        if (result.buyerPrice === null) {
          throw new Error('Price not found in DOM');
        }

        // Success!
        const duration = Date.now() - startTime;
        this.updateMetrics(marketplace, duration, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = error instanceof Error ? error : new Error(String(error));

        if (proxyConfig) {
          proxyService.reportFailure(proxyConfig.server);
        }

        logger.warn(`[BrowserEyes] Attempt ${attempt} failed: ${lastError.message}`);

        if (attempt === maxRetries) {
          this.updateMetrics(marketplace, duration, false, lastError);
          break;
        }

        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (anonymizedProxyUrl) {
          await closeAnonymizedProxy(anonymizedProxyUrl, true);
        }
      }
    }

    throw lastError || new Error('Extraction failed after all retries');
  }

  /**
   * Simulate human-like behavior to avoid bot detection
   */
  private async simulateHumanBehavior(page: Page): Promise<void> {
    logger.info('[BrowserEyes] Simulating human behavior...');

    // 1. Random mouse movements
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 800);
      const y = Math.floor(Math.random() * 600);
      await page.mouse.move(x, y, { steps: 5 });
    }

    // 2. Random scrolling
    await page.evaluate(() => {
      window.scrollBy({
        top: Math.floor(Math.random() * 500) + 200,
        behavior: 'smooth',
      });
    });

    await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

    // 3. Scroll back up slightly
    await page.evaluate(() => {
      window.scrollBy({
        top: -Math.floor(Math.random() * 100),
        behavior: 'smooth',
      });
    });
  }

  /**
   * Wait for price elements to appear on page
   */
  private async waitForPriceElements(page: Page, marketplace: 'WB' | 'Ozon'): Promise<void> {
    try {
      if (marketplace === 'WB') {
        // Wait for WB price container (multiple possible selectors)
        await page.waitForSelector('.price-block, [class*="price"], .product-page__price', {
          timeout: 10000,
        });
      } else if (marketplace === 'Ozon') {
        // Wait for Ozon price
        await page.waitForSelector('[data-widget="webPrice"], .price, [class*="Price"]', {
          timeout: 10000,
        });
      }
    } catch {
      logger.warn('[BrowserEyes] Price elements not found, continuing anyway...');
    }
  }

  /**
   * Extract price using DOM selectors (Strategy 1)
   */
  private async extractPriceFromDOM(
    page: Page,
    marketplace: 'WB' | 'Ozon'
  ): Promise<BrowserEyesResult> {
    logger.info('[BrowserEyes] Extracting price via DOM selectors');

    if (marketplace === 'WB') {
      return await this.extractWBPriceFromDOM(page);
    } else {
      return await this.extractOzonPriceFromDOM(page);
    }
  }

  /**
   * Wildberries DOM extraction
   */
  private async extractWBPriceFromDOM(page: Page): Promise<BrowserEyesResult> {
    const priceData = await page.evaluate(() => {
      // Updated selectors based on 2025 WB layout
      const walletSelectors = [
        '.price-block__wallet-price',
        '.price-section__wallet-price',
        '.price-block__wallet-price-value',
        '.wallet-price',
      ];

      const regularSelectors = [
        '.price-block__final-price',
        '.price-section__final-price',
        'ins.price-block__final-price',
        '.product-page__price-block ins',
      ];

      let buyerPrice: number | null = null;
      let originalPrice: number | null = null;
      let cardPrice: number | null = null;

      // 1. Try to find WB Wallet Price (Purple price)
      for (const selector of walletSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const text = elem.textContent || '';
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            cardPrice = parseInt(match[1].replace(/\s/g, ''));
            break; // Found the specific wallet price
          }
        }
      }

      // 2. Try to find Regular Final Price
      for (const selector of regularSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const text = elem.textContent || '';
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            const price = parseInt(match[1].replace(/\s/g, ''));
            // If we haven't found a buyer price yet, or this one is lower/valid
            if (!buyerPrice) {
              buyerPrice = price;
            }
          }
        }
      }

      // If we found a card price, that is effectively the "buyer price" (lowest)
      if (cardPrice) {
        buyerPrice = cardPrice;
      }

      // Find original price (strikethrough)
      const delElem = document.querySelector('.price-block__old-price, del, [class*="old-price"]');
      if (delElem) {
        const text = delElem.textContent || '';
        const match = text.match(/(\d[\d\s]*)/);
        if (match) {
          originalPrice = parseInt(match[1].replace(/\s/g, ''));
        }
      }

      // Check stock status
      const outOfStock =
        document.body.textContent?.includes('Нет в наличии') ||
        document.body.textContent?.includes('Товара нет в наличии');

      return {
        buyerPrice,
        originalPrice,
        cardPrice,
        stockStatus: outOfStock ? 'out_of_stock' : 'in_stock',
      };
    });

    return {
      ...priceData,
      extractionMethod: 'dom',
      confidence: priceData.buyerPrice ? 0.9 : 0.3,
    } as BrowserEyesResult;
  }

  /**
   * Ozon DOM extraction
   */
  private async extractOzonPriceFromDOM(page: Page): Promise<BrowserEyesResult> {
    const priceData = await page.evaluate(() => {
      try {
        if (!document || !document.body)
          return {
            buyerPrice: null,
            originalPrice: null,
            cardPrice: null,
            stockStatus: 'out_of_stock',
          };

        const priceSelectors = [
          '[data-widget="webPrice"]', // Main Ozon price container
          '[data-widget="pdpPrice"]', // Alternate price widget
          '.price-block',
          '[class*="Price"]',
        ];

        let buyerPrice: number | null = null;
        let originalPrice: number | null = null;

        // Strategy A: Direct selector matching
        for (const selector of priceSelectors) {
          const widget = document.querySelector(selector);
          if (!widget) continue;

          // Inside the widget, we look for spans with prices
          const spans = Array.from(widget.querySelectorAll('span'));
          for (const span of spans) {
            const text = (span.textContent || '').replace(/\xa0/g, ' ').trim();
            // Match pattern like "1 234 ₽" or "1234"
            const match = text.match(/([\d\s]+)\s*(?:₽|P|р|руб)/i) || text.match(/^([\d\s]+)$/);

            if (match) {
              const price = parseInt(match[1].replace(/\s/g, ''));
              if (price > 10) {
                // Ignore trivial amounts
                // If it's the first price found, it's usually the buyer price
                if (!buyerPrice) {
                  buyerPrice = price;
                } else if (!originalPrice && price > buyerPrice) {
                  // If we found a second, higher price - that's the original one
                  originalPrice = price;
                } else if (price < buyerPrice) {
                  // If we found a second, LOWER price - that's the new actual buyer price (e.g. Ozon Card)
                  originalPrice = buyerPrice;
                  buyerPrice = price;
                }
              }
            }
          }
          if (buyerPrice) break; // Found something in the prioritized widget
        }

        // Strategy B: Text-based deep search (only if Strategy A failed)
        if (!buyerPrice) {
          const allSpans = Array.from(document.querySelectorAll('span'));
          for (const span of allSpans) {
            const text = (span.textContent || '').trim();
            if (text.includes('₽') && text.length < 15) {
              const priceMatch = text.match(/([\d\s]+)/);
              if (priceMatch) {
                const price = parseInt(priceMatch[1].replace(/\s/g, ''));
                if (price > 100) {
                  buyerPrice = price;
                  break;
                }
              }
            }
          }
        }

        // Check stock status
        const outOfStock =
          document.body.textContent?.includes('Нет в наличии') ||
          document.body.textContent?.includes('Товара нет');

        // STRATEGY: Try to find data in JSON-LD or NEXT_DATA if DOM is blocked
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        const nextData = document.getElementById('__NEXT_DATA__');

        if (jsonLd && !buyerPrice) {
          try {
            const ldData = JSON.parse(jsonLd.textContent || '{}');
            const offers = Array.isArray(ldData)
              ? ldData.find(i => i.offers)?.offers
              : ldData.offers;
            if (offers && offers.price) {
              buyerPrice = parseFloat(offers.price);
            }
          } catch {
            /* Silent */
          }
        }

        if (nextData && !buyerPrice) {
          try {
            const data = JSON.parse(nextData.textContent || '{}');
            // Deep search for price in Ozon's next.js state
            const state = data.props?.pageProps?.initialState;
            if (state) {
              const jsonState = JSON.stringify(state);
              const priceMatch =
                jsonState.match(/"price":(\d+)/) || jsonState.match(/"price":"(\d+)"/);
              if (priceMatch) buyerPrice = parseInt(priceMatch[1]);
            }
          } catch {
            /* Silent */
          }
        }

        return {
          buyerPrice,
          originalPrice,
          cardPrice: null,
          stockStatus: outOfStock ? 'out_of_stock' : 'in_stock',
        };
      } catch {
        return {
          buyerPrice: null,
          originalPrice: null,
          cardPrice: null,
          stockStatus: 'out_of_stock',
        };
      }
    });

    // --- FALLBACK: Node-level Search API (if product page is blocked) ---
    if (
      !priceData.buyerPrice &&
      ((await page.content()).includes('Доступ ограничен') ||
        (await page.content()).includes('challenge'))
    ) {
      try {
        const currentUrl = page.url();
        const skuMatch = currentUrl.match(/\/product\/([^/]+)/);
        const sku = skuMatch ? skuMatch[1] : null;

        if (sku) {
          logger.info(
            `[BrowserEyes] Product page blocked. Attempting search fallback for SKU: ${sku}`
          );
          const searchUrl = `https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=${encodeURIComponent(`/search/?text=${sku}&from_global=true`)}`;

          // We must use page.evaluate to fetch so it uses the browser's cookies and IP session
          const searchResult = await page.evaluate(async fetchUrl => {
            try {
              const response = await fetch(fetchUrl, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              });
              if (!response.ok) return null;
              const data = await response.json();
              return JSON.stringify(data);
            } catch {
              return null;
            }
          }, searchUrl);

          if (searchResult) {
            const sPriceMatch =
              searchResult.match(/"price":"(\d+)"/) || searchResult.match(/"price":(\d+)/);
            if (sPriceMatch) {
              priceData.buyerPrice = parseInt(sPriceMatch[1]);
              logger.info(
                `[BrowserEyes] Search fallback SUCCESS: found price ${priceData.buyerPrice}`
              );
            }
          }
        }
      } catch (err) {
        logger.warn('[BrowserEyes] Search fallback failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      ...priceData,
      extractionMethod: 'dom',
      confidence: priceData.buyerPrice ? 0.9 : 0.3,
    } as BrowserEyesResult;
  }

  /**
   * Extract price using Vision AI (Strategy 2)
   */
  private async extractPriceFromVision(
    _page: Page,
    _marketplace: 'WB' | 'Ozon'
  ): Promise<BrowserEyesResult> {
    logger.info('[BrowserEyes] Extracting price via Vision AI');

    // Take screenshot
    // const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    // const base64 = screenshot.toString('base64');

    // Analyze with Vision AI
    // TODO: Enhance VisionService to return price data
    // const visionResult = await visionService.analyzeImage({
    //   imageBase64: base64,
    //   checkType: 'full',
    //   targetMarketplace: marketplace,
    // });

    // Parse vision result to extract price
    // This is a simplified version - you'd need to enhance VisionService to return price data
    return {
      buyerPrice: null, // TODO: Extract from vision analysis
      originalPrice: null,
      cardPrice: null,
      stockStatus: 'in_stock',
      extractionMethod: 'vision',
      confidence: 0.7,
    };
  }

  /**
   * Merge DOM and Vision results
   */
  private mergeResults(
    domResult: BrowserEyesResult,
    visionResult: BrowserEyesResult | null
  ): BrowserEyesResult {
    if (!visionResult) return domResult;

    // Prefer DOM if confidence is high
    if (domResult.confidence >= 0.8) return domResult;

    // Use vision if DOM failed
    if (domResult.buyerPrice === null && visionResult.buyerPrice !== null) {
      return { ...visionResult, extractionMethod: 'hybrid' };
    }

    return domResult;
  }

  /**
   * Update performance metrics after each extraction
   */
  private updateMetrics(
    marketplace: 'WB' | 'Ozon',
    durationMs: number,
    success: boolean,
    error?: unknown
  ): void {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulExtractions++;
      this.metrics.byMarketplace[marketplace].success++;
    } else {
      this.metrics.failedExtractions++;
      this.metrics.byMarketplace[marketplace].failed++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      this.metrics.lastErrorTime = new Date();
    }

    // Update peak duration
    if (durationMs > this.metrics.peakDurationMs) {
      this.metrics.peakDurationMs = durationMs;
    }

    // Update average duration (running average)
    const totalSuccessful = this.metrics.successfulExtractions;
    if (totalSuccessful > 0) {
      this.metrics.avgDurationMs =
        (this.metrics.avgDurationMs * (totalSuccessful - 1) + durationMs) / totalSuccessful;
    }

    // Update marketplace-specific average
    const mpStats = this.metrics.byMarketplace[marketplace];
    const mpTotal = mpStats.success + mpStats.failed;
    if (mpTotal > 0) {
      mpStats.avgDuration = (mpStats.avgDuration * (mpTotal - 1) + durationMs) / mpTotal;
    }
  }

  /**
   * Get current performance metrics for monitoring
   */
  getMetrics(): BrowserEyesMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for periodic reporting)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      avgDurationMs: 0,
      peakDurationMs: 0,
      lastError: null,
      lastErrorTime: null,
      byMarketplace: {
        WB: { success: 0, failed: 0, avgDuration: 0 },
        Ozon: { success: 0, failed: 0, avgDuration: 0 },
      },
    };
  }
}

// Singleton instance
export const browserEyes = new BrowserEyes();
