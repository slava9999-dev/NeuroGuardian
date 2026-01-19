import { sql } from '../services/database.js';
import type { LLMResponse } from '../../infrastructure/llm/LLMProvider.js';

interface WbProductApi {
  id: number;
  name: string;
  sizes?: Array<{ price?: { total?: number }; product?: number }>;
  salePriceU?: number;
  priceU?: number;
  reviewRating?: number;
  feedbacks?: number;
  root?: number;
}

interface WbFeedback {
  id: string;
  productValuation: number;
  text: string;
  createdDate: string;
}
import { geminiPro } from '../../infrastructure/llm/GeminiProvider.js';
import { logger } from '../lib/logger.js';
import { fetchWithRetry } from '../lib/index.js';
import puppeteer, { Browser } from 'puppeteer';

// Types for the Semantic Mining process
export interface CompetitorReview {
  reviewId: string;
  rating: number;
  text: string;
  date: string;
}

export interface CompetitorData {
  marketplace: 'wb' | 'ozon';
  externalId: string; // NMID or SKU
  title: string;
  price: number;
  rating: number;
  reviewsCount: number;
  rootCategory?: string;
  imtId?: number; // Internal WB ID for reviews (root)
}

export interface CompetitorInsight {
  competitorId: string; // NMID
  competitorTitle: string;
  painPoints: string[]; // "broken", "bad smell"
  uniqueSellingPoints: string[]; // "steel frame", "eco-friendly"
  missedKeywords: string[]; // LSI keywords they are ranking for but we might miss
}

export interface OptimizationSuggestion {
  targetField: 'title' | 'description' | 'attributes';
  originalContent?: string;
  suggestedContent: string;
  reasoning: string; // "Added 'gift set' to capture low-freq traffic"
  expectedImpact: 'high' | 'medium' | 'low';
}

export class SemanticMiner {
  private readonly defaultCompetitorLimit = 10;
  private readonly reviewsToAnalyze = 50;

  // WB Internal API Endpoints (Reverse Engineered)
  private readonly WB_SEARCH_API_V5 = 'https://search.wb.ru/exactmatch/ru/common/v5/search';
  private readonly WB_SEARCH_API_V4 = 'https://search.wb.ru/exactmatch/ru/common/v4/search';
  private readonly WB_FEEDBACKS_API = 'https://feedbacks1.wb.ru/feedbacks/v1';

  /**
   * Main entry point for the "Semantic Miner" module.
   * Performs full analysis: search -> parse -> extract -> suggest.
   */
  async mineAndOptimize(
    query: string,
    currentProductId?: string
  ): Promise<OptimizationSuggestion[]> {
    logger.info(`[SemanticMiner] Starting mining for query: "${query}"`);

    // 1. Find Top Competitors (Puppeteer -> API Fallback)
    const competitors = await this.findCompetitors(query);

    if (competitors.length === 0) {
      logger.warn('[SemanticMiner] No competitors found after all attempts');
      return [];
    }

    // 2. Mine Insights (Reviews & SEO)
    const insights = await this.analyzeCompetitors(competitors);

    // 3. Generate "Weaponized" Content
    return this.generateWeaponizedContent(insights, currentProductId);
  }

  /**
   * Combined finding method: Puppeteer first, then API
   */
  async findCompetitors(query: string): Promise<CompetitorData[]> {
    // Try Puppeteer
    const pupResults = await this.findCompetitorsPuppeteer(query);
    if (pupResults.length > 0) return pupResults;

    logger.warn('[SemanticMiner] Puppeteer yielded 0 results, switching to API fallback');

    // Try API
    return this.findCompetitorsApiFallback(query);
  }

  /**
   * Step 1A: Puppeteer scraping (Most robust)
   */
  async findCompetitorsPuppeteer(query: string): Promise<CompetitorData[]> {
    let browser;
    try {
      logger.info(`[SemanticMiner] Launching Puppeteer for query: ${query}`);
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors',
        ],
      });
      const page = await browser.newPage();

      // Stealth Mode
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      const searchUrl = `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(query)}`;

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch {
        logger.warn('[SemanticMiner] Page load timeout/partial load');
      }

      // 1. Handle Protection / "Almost ready" Page
      for (let i = 0; i < 20; i++) {
        const title = await page.title();
        if (title.includes('Почти готово') || title.includes('Checking your browser')) {
          if (i === 0) logger.info('[SemanticMiner] Hit protection page, waiting...');
          await new Promise(r => setTimeout(r, 2000));
        } else {
          break;
        }
      }

      const cardSelectors =
        'article.product-card, .product-card__wrapper, .j-card-item, .product-card-list .product-card, .goods-cards__item';

      try {
        await page.waitForSelector(cardSelectors, { timeout: 15000 });
      } catch {
        /* ignore */
      }

      // 3. Extract Data - Using STRING EVALUATION to avoid TSX transpilation artifacts
      const extractionCode = `
        (function(selector, limit) {
            const nodes = document.querySelectorAll(selector);
            const results = [];
            
            for (let i = 0; i < nodes.length && i < limit; i++) {
               const item = nodes[i];
               
               const getText = (cls) => {
                   const el = item.querySelector(cls);
                   return el ? el.textContent.trim() : '';
               };

               let idStr = item.getAttribute('data-nm-id') || item.id || '';
               idStr = idStr.replace(/\\D/g, '');

               let title = getText('.product-card__brand-name') + ' ' + getText('.product-card__name');
               if (!title.trim()) title = getText('.goods-name');
               if (!title.trim()) title = item.getAttribute('aria-label') || 'Unknown';

               let priceStr = getText('.price__lower-price');
               if (!priceStr) priceStr = getText('.lower-price');
               const price = parseInt(priceStr.replace(/\\D/g, '')) || 0;

               const ratingStr = getText('.address-rate-mini');
               const rating = parseFloat(ratingStr) || 0;

               const reviewsStr = getText('.product-card__count');
               const reviewsCount = parseInt(reviewsStr.replace(/\\D/g, '')) || 0;

               results.push({
                 marketplace: 'wb',
                 externalId: idStr,
                 title: title.trim(),
                 price: price,
                 rating: rating,
                 reviewsCount: reviewsCount,
                 rootCategory: '', 
                 imtId: 0
               });
            }
            return results;
        })('${cardSelectors}', ${this.defaultCompetitorLimit});
      `;

      // Execute string
      const rawCompetitors = await page.evaluate(extractionCode);
      const competitors = (Array.isArray(rawCompetitors) ? rawCompetitors : []) as CompetitorData[];

      logger.info(`[SemanticMiner] Puppeteer found ${competitors.length} items`);
      return competitors.filter(c => c.externalId && c.price > 0);
    } catch (e) {
      logger.error('[SemanticMiner] Puppeteer scraping failed', { error: e });
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Step 1B: API Fallback
   */
  async findCompetitorsApiFallback(query: string): Promise<CompetitorData[]> {
    // Try V5 first, then V4
    let products = await this._fetchFromApi(this.WB_SEARCH_API_V5, query);

    if (products.length === 0) {
      logger.info('[SemanticMiner] V5 API empty or blocked, trying V4...');
      products = await this._fetchFromApi(this.WB_SEARCH_API_V4, query);
    }

    return products;
  }

  private async _fetchFromApi(endpoint: string, query: string): Promise<CompetitorData[]> {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('appType', '1');
      url.searchParams.set('curr', 'rub');
      url.searchParams.set('dest', '-1257786');
      url.searchParams.set('query', query);
      url.searchParams.set('resultset', 'catalog');

      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Wildberries/10.9.1005 (iPhone; iOS 16.0; Scale/3.00)',
          Accept: '*/*',
          'Accept-Language': 'ru-RU;q=1.0, en-US;q=0.9',
          Referer: `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(query)}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      let products = data.data?.products || [];

      // Handle Redirect
      if (products.length === 0 && data.shardKey && data.query) {
        try {
          const bucketMatch = (data.shardKey as string).match(/(bucket_\d+)/);
          const bucket = bucketMatch ? bucketMatch[1] : null;

          if (bucket) {
            const catalogUrl = `https://catalog.wb.ru/catalog/${bucket}/catalog?appType=1&curr=rub&dest=-1257786&${data.query}`;
            const redirResponse = await fetchWithRetry(catalogUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Wildberries/10.9.1005 (iPhone; iOS 16.0; Scale/3.00)',
              },
            });

            if (redirResponse.ok) {
              const redirData = await redirResponse.json();
              products = redirData.data?.products || [];
            }
          }
        } catch {
          // ignore
        }
      }

      return products.slice(0, this.defaultCompetitorLimit).map((p: WbProductApi) => ({
        marketplace: 'wb' as const,
        externalId: String(p.id),
        title: p.name,
        price: (p.sizes?.[0]?.price?.total || p.salePriceU || p.priceU || 0) / 100,
        rating: p.reviewRating || 0,
        reviewsCount: p.feedbacks || 0,
        rootCategory: String(p.root),
        imtId: p.root,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Step 2: Pain Point Extraction - uses Puppeteer (navigation) for robust IMT ID resolution
   */
  async analyzeCompetitors(competitors: CompetitorData[]): Promise<CompetitorInsight[]> {
    const insights: CompetitorInsight[] = [];

    // Reduce logic: Analyze fewer competitors (2) to respect tokens and API limits
    const topCompetitors = competitors.slice(0, 2);

    let browser;
    try {
      logger.info('[SemanticMiner] Launching Puppeteer for deep analysis...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      for (const comp of topCompetitors) {
        try {
          let targetId = comp.imtId;

          // Resolve IMT ID if missing (common with Puppeteer search results)
          if (!targetId || targetId === 0) {
            logger.info(`[SemanticMiner] Resolving imtId for ${comp.externalId} via Puppeteer...`);
            const resolved = await this.resolveImtIdPuppeteer(comp.externalId, browser);
            if (resolved) {
              targetId = resolved;
              comp.imtId = resolved; // Update cached reference
            } else {
              logger.warn(
                `[SemanticMiner] Could not resolve imtId for ${comp.externalId}, trying with nmId`
              );
              // Fallback to nmId, though it usually fails for reviews
              targetId = parseInt(comp.externalId);
            }
          }

          const reviews = await this.fetchWbReviews(targetId);
          logger.info(
            `[SemanticMiner] Fetched ${reviews.length} reviews for ${comp.externalId} (imt: ${targetId})`
          );

          if (reviews.length === 0) continue;

          const negativeReviews = reviews
            .filter(r => r.rating <= 3)
            .map(r => r.text)
            .join('\n---\n');
          const positiveReviews = reviews
            .filter(r => r.rating >= 4)
            .slice(0, 5)
            .map(r => r.text)
            .join('\n---\n');

          if (!negativeReviews && !positiveReviews) continue;

          // Initial Rate Limit Protection
          await new Promise(r => setTimeout(r, 2000));

          const analysis = await this.analyzeReviewsWithGemini(
            comp.title,
            negativeReviews,
            positiveReviews
          );
          if (analysis) {
            insights.push({
              competitorId: comp.externalId,
              competitorTitle: comp.title,
              ...analysis,
            });
          }
        } catch (e) {
          logger.warn(`[SemanticMiner] Failed to analyze competitor ${comp.externalId}`, {
            error: e,
          });
        }
      }
    } catch (e) {
      logger.error('[SemanticMiner] Analysis browser crash', { error: e });
    } finally {
      if (browser) await browser.close();
    }

    return insights;
  }

  /**
   * Helper: Resolve nmId to imtId (root) using Puppeteer HTML Page
   * Strategy: Navigate to product page and extract imtId from common selectors or links
   */
  private async resolveImtIdPuppeteer(nmId: string, browser: Browser): Promise<number | null> {
    const page = await browser.newPage();
    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      const pageUrl = `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`;

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch {
        logger.warn('[SemanticMiner] Puppeteer detail nav timeout');
      }

      // Wait for protection to pass or page content to manifest
      for (let i = 0; i < 20; i++) {
        const title = await page.title();
        if (title.includes('Почти готово') || title.includes('Checking your browser')) {
          if (i === 0) logger.info(`[SemanticMiner] Hit protection on ${nmId}, waiting...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        // Extraction Logic
        const rootId = await page.evaluate(() => {
          // 1. Try common link structure for feedbacks
          const feedbackLinks = Array.from(document.querySelectorAll('a')).filter(
            a => a.href.includes('feedbacks') && a.href.includes('imtId=')
          );

          for (const link of feedbackLinks) {
            const match = link.href.match(/imtId=(\d+)/);
            if (match && match[1]) return parseInt(match[1]);
          }

          // 2. Try window globals
          // @ts-expect-error - Wildberries global data object
          if (window.staticGoods?.root) return parseInt(window.staticGoods.root);
          // @ts-expect-error - Wildberries global SSR object
          if (window.ssrModel?.product?.root) return parseInt(window.ssrModel.product.root);

          // 3. Try parsing from page source text
          const html = document.documentElement.innerHTML;
          const rootMatch = html.match(/"root":\s*(\d+)/) || html.match(/imtId[:=]\s*(\d+)/);
          if (rootMatch && rootMatch[1]) return parseInt(rootMatch[1]);

          return null;
        });

        if (rootId) return rootId;

        await new Promise(r => setTimeout(r, 1000));
      }

      return null;
    } catch (e) {
      logger.warn(`[SemanticMiner] Puppeteer resolve failed for ${nmId}`, { error: e });
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * Helper: Fetch reviews from WB Feedbacks API
   */
  private async fetchWbReviews(imtId: number): Promise<CompetitorReview[]> {
    if (!imtId) return [];
    try {
      const url = `${this.WB_FEEDBACKS_API}/${imtId}`;
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          Origin: 'https://www.wildberries.ru',
          Referer: `https://www.wildberries.ru/catalog/${imtId}/detail.aspx`,
        },
      });

      if (!response.ok) {
        logger.warn(`[SemanticMiner] Feedbacks V1 failed for ${imtId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const feedbacks = (data.feedbacks || []) as WbFeedback[];

      return feedbacks.slice(0, this.reviewsToAnalyze).map(f => ({
        reviewId: String(f.id),
        rating: f.productValuation,
        text: f.text,
        date: f.createdDate,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Helper: Use Gemini to extract pain points with Rate Limit Handling
   */
  private async analyzeReviewsWithGemini(
    title: string,
    negatives: string,
    positives: string
  ): Promise<{
    painPoints: string[];
    uniqueSellingPoints: string[];
    missedKeywords: string[];
  } | null> {
    const prompt = `
      Analyze these reviews: "${title}".
      
      NEG:
      ${negatives.substring(0, 2000)}

      POS:
      ${positives.substring(0, 1000)}

      Task: top 3 pain points, top 3 selling points, 3 LSI keywords.

      Return JSON only:
      {
        "painPoints": [],
        "uniqueSellingPoints": [],
        "missedKeywords": []
      }
    `;

    try {
      const result = await this.callGeminiWithRetry(
        [
          { role: 'system', content: 'You are an E-commerce analyst.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.1, maxTokens: 800 }
      ); // Reduce tokens

      if (!result) return null;

      const cleanJson = result.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      logger.error('[SemanticMiner] Gemini analysis failed', { error: e });
      return null;
    }
  }

  /**
   * Step 3: Weaponized Description
   */
  private async generateWeaponizedContent(
    insights: CompetitorInsight[],
    currentProductId?: string
  ): Promise<OptimizationSuggestion[]> {
    if (insights.length === 0) return [];

    const allPainPoints = [...new Set(insights.flatMap(i => i.painPoints))];
    const allMissedKeywords = [...new Set(insights.flatMap(i => i.missedKeywords))];

    let currentProductInfo = 'my product';
    if (currentProductId) {
      currentProductInfo = `Product ID: ${currentProductId}`;
    }

    const prompt = `
      Gen updates for ${currentProductInfo}.

      PAIN:
      ${allPainPoints.slice(0, 5).join('\n- ')}

      KEYWORDS:
      ${allMissedKeywords.slice(0, 5).join('\n- ')}

      Output JSON:
      [
        {"targetField":"title","suggestedContent":"...","reasoning":"...","expectedImpact":"high"},
        {"targetField":"description","suggestedContent":"...","reasoning":"...","expectedImpact":"high"}
      ]
    `;

    try {
      const result = await this.callGeminiWithRetry(
        [
          { role: 'system', content: 'You are a SEO copywriter.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.4, maxTokens: 800 }
      );

      if (!result) return [];

      const cleanJson = result.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      logger.error('[SemanticMiner] Generation failed', { error: e });
      return [];
    }
  }

  /**
   * Wrapper for Gemini calls with Robust Retry Logic (up to 3 tries)
   */
  private async callGeminiWithRetry(
    messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[],
    config?: Record<string, unknown>
  ): Promise<LLMResponse> {
    const maxRetries = 3;
    let attempt = 0;
    let waitTime = 65000; // start with 65s

    while (attempt < maxRetries) {
      try {
        return await geminiPro.complete(messages, config);
      } catch (error: unknown) {
        attempt++;
        const errMsg = error instanceof Error ? error.message : JSON.stringify(error);

        if (
          errMsg.includes('429') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('RESOURCE_EXHAUSTED')
        ) {
          if (attempt >= maxRetries) throw error;

          logger.warn(
            `[SemanticMiner] ⚠️ Rate Limit (429). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime / 1000}s...`
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));

          waitTime += 30000; // Increase wait time for next retry
          logger.info('[SemanticMiner] Retrying request...');
          continue;
        }
        throw error; // Throw other errors immediately
      }
    }
    throw new Error('Failed to complete request after retries');
  }

  async injectTrendingKeywords(productId: string, trendingKeywords: string[]): Promise<void> {
    logger.info(
      `[SemanticMiner] Injecting keywords for ${productId}: ${trendingKeywords.join(', ')}`
    );
    await sql`
       UPDATE products 
       SET keywords = array_cat(COALESCE(keywords, ARRAY[]::text[]), ${trendingKeywords}::text[])
       WHERE id = ${productId}
     `;
  }
}

export const semanticMiner = new SemanticMiner();
