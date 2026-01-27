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
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
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
   */
  async gazeAtProduct(
    marketplace: 'WB' | 'Ozon',
    url: string,
    options?: {
      useVision?: boolean; // Use AI vision analysis
      waitForAuth?: boolean; // Wait for user to login (future)
      saveScreenshot?: boolean; // Save screenshot to result
    }
  ): Promise<BrowserEyesResult> {
    const startTime = Date.now();
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const proxyUrl = await proxyService.getNextProxy();
    const contextOptions: {
      viewport: { width: number; height: number };
      userAgent: string;
      locale: string;
      timezoneId: string;
      geolocation: { latitude: number; longitude: number };
      permissions: string[];
      proxy?: { server: string };
    } = {
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      geolocation: { latitude: 55.7558, longitude: 37.6173 }, // Moscow
      permissions: ['geolocation'],
    };

    if (proxyUrl) {
      logger.info(`[BrowserEyes] Using proxy: ${proxyUrl}`);
      contextOptions.proxy = { server: proxyUrl };
    }

    const context: BrowserContext = await this.browser.newContext(contextOptions);
    const page = await context.newPage();

    // Additional anti-detection: Override navigator properties
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Add realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Add realistic languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      });
    });

    try {
      logger.info(`[BrowserEyes] Navigating to ${marketplace}: ${url}`);

      // Navigate and wait for network idle
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for price elements to load
      await this.waitForPriceElements(page, marketplace);

      // Strategy 1: DOM Extraction (Fast, Reliable)
      const domResult = await this.extractPriceFromDOM(page, marketplace);

      // Strategy 2: Vision Analysis (Fallback, More Accurate for complex cases)
      let visionResult: BrowserEyesResult | null = null;
      if (options?.useVision && domResult.buyerPrice === null) {
        visionResult = await this.extractPriceFromVision(page, marketplace);
      }

      const finalResult = this.mergeResults(domResult, visionResult);

      // Take screenshot if requested or if extraction failed (for debugging)
      if (options?.saveScreenshot || finalResult.buyerPrice === null) {
        const screenshot = await page.screenshot({ type: 'png', fullPage: false });
        finalResult.screenshotUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
      }

      const duration = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(marketplace, duration, true);

      logger.info(`[BrowserEyes] Extraction complete in ${duration}ms`, {
        method: finalResult.extractionMethod,
        price: finalResult.buyerPrice,
        marketplace,
      });

      return finalResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(marketplace, duration, false, error);

      logger.error('[BrowserEyes] Failed to extract price', {
        marketplace,
        url,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await page.close();
    }
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
      // Strategy: Find price elements by common WB patterns
      const priceSelectors = [
        '.price-block__final-price', // Main price
        '[class*="wallet-price"]', // WB Wallet price
        '.product-page__price-block ins', // Sale price
        '.price-block__content ins',
      ];

      let buyerPrice: number | null = null;
      let originalPrice: number | null = null;
      const cardPrice: number | null = null;

      // Try to find wallet/card price (lowest)
      for (const selector of priceSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const text = elem.textContent || '';
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            const price = parseInt(match[1].replace(/\s/g, ''));
            if (!buyerPrice || price < buyerPrice) {
              buyerPrice = price;
            }
          }
        }
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
      const priceSelectors = [
        '[data-widget="webPrice"] span', // Main Ozon price widget
        '.price span',
        '[class*="Price"] span',
      ];

      let buyerPrice: number | null = null;
      let originalPrice: number | null = null;

      for (const selector of priceSelectors) {
        const elems = document.querySelectorAll(selector);
        elems.forEach(elem => {
          const text = elem.textContent || '';
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            const price = parseInt(match[1].replace(/\s/g, ''));
            if (price > 0) {
              if (!buyerPrice) {
                buyerPrice = price;
              } else if (price < buyerPrice) {
                originalPrice = buyerPrice;
                buyerPrice = price;
              }
            }
          }
        });
      }

      const outOfStock =
        document.body.textContent?.includes('Нет в наличии') ||
        document.body.textContent?.includes('Товара нет');

      return {
        buyerPrice,
        originalPrice,
        cardPrice: null,
        stockStatus: outOfStock ? 'out_of_stock' : 'in_stock',
      };
    });

    return {
      ...priceData,
      extractionMethod: 'dom',
      confidence: priceData.buyerPrice ? 0.85 : 0.3,
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
