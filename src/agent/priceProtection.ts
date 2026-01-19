import { marketplaceService, type Marketplace } from '@/services/marketplaceService';
import { notificationService } from '@/services/notificationService';
import { db } from '@/lib/db';
import { logger } from '@/api-lib/lib/logger';

interface UnifiedProduct {
  id: string;
  marketplace: Marketplace;
  externalId: string;
  name: string;
  price: number;
  oldPrice?: number;
  costPrice?: number;
  stock: number;
  lastUpdated: Date;
}

interface PriceRule {
  productId: string;
  minPrice: number;
  maxPrice: number;
  targetMargin: number;
  competitorTracking: boolean;
  autoAdjust: boolean;
}

interface PriceAnalysis {
  product: UnifiedProduct;
  currentPrice: number;
  recommendedPrice: number;
  reason: string;
  action: 'none' | 'increase' | 'decrease' | 'alert';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface ExecutionResult {
  analyzed: number;
  updated: number;
  alerts: number;
  errors: number;
  details: {
    product: string;
    action: string;
    oldPrice: number;
    newPrice: number;
    reason: string;
  }[];
}

export class PriceProtectionAgent {
  private rules: Map<string, PriceRule> = new Map();

  async loadRules(): Promise<void> {
    const dbRules = await db.query(`
      SELECT product_id, min_price, max_price, target_margin, 
             competitor_tracking, auto_adjust
      FROM price_rules
      WHERE active = true
    `);

    for (const rule of dbRules.rows) {
      this.rules.set(rule.product_id, {
        productId: rule.product_id,
        minPrice: parseFloat(rule.min_price),
        maxPrice: parseFloat(rule.max_price),
        targetMargin: parseFloat(rule.target_margin),
        competitorTracking: rule.competitor_tracking,
        autoAdjust: rule.auto_adjust,
      });
    }
  }

  async analyzeAllProducts(): Promise<PriceAnalysis[]> {
    const products = await marketplaceService.getAllProducts();
    const analyses: PriceAnalysis[] = [];

    for (const product of products) {
      const analysis = await this.analyzeProduct(product as UnifiedProduct);
      if (analysis.action !== 'none') {
        analyses.push(analysis);
      }
    }

    // Sort by urgency
    analyses.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    return analyses;
  }

  private async analyzeProduct(product: UnifiedProduct): Promise<PriceAnalysis> {
    const rule = this.rules.get(product.id);

    if (!rule) {
      return this.basicAnalysis(product);
    }

    const analysis: PriceAnalysis = {
      product,
      currentPrice: product.price,
      recommendedPrice: product.price,
      reason: '',
      action: 'none',
      urgency: 'low',
    };

    // 1. Min Price Check
    if (product.price < rule.minPrice) {
      analysis.recommendedPrice = rule.minPrice;
      analysis.reason = `Price ${product.price} below min ${rule.minPrice}`;
      analysis.action = 'increase';
      analysis.urgency = 'critical';
      return analysis;
    }

    // 2. Max Price Check
    if (product.price > rule.maxPrice) {
      analysis.recommendedPrice = rule.maxPrice;
      analysis.reason = `Price ${product.price} above max ${rule.maxPrice}`;
      analysis.action = 'decrease';
      analysis.urgency = 'high';
      return analysis;
    }

    // 3. Margin Check
    if (product.costPrice) {
      const currentMargin = ((product.price - product.costPrice) / product.price) * 100;

      if (currentMargin < rule.targetMargin * 0.8) {
        const targetPrice = product.costPrice / (1 - rule.targetMargin / 100);
        analysis.recommendedPrice = Math.min(targetPrice, rule.maxPrice);
        analysis.reason = `Margin ${currentMargin.toFixed(1)}% below target ${rule.targetMargin}%`;
        analysis.action = 'increase';
        analysis.urgency = 'high';
        return analysis;
      }
    }

    // 4. Competitor Check
    if (rule.competitorTracking) {
      const competitorAnalysis = await this.analyzeCompetitors(product, rule);
      if (competitorAnalysis) {
        return competitorAnalysis;
      }
    }

    return analysis;
  }

  private basicAnalysis(product: UnifiedProduct): PriceAnalysis {
    return {
      product,
      currentPrice: product.price,
      recommendedPrice: product.price,
      reason: '',
      action: 'none',
      urgency: 'low',
    };
  }

  private async analyzeCompetitors(
    product: UnifiedProduct,
    rule: PriceRule
  ): Promise<PriceAnalysis | null> {
    let competitorPrice: number | null = null;

    if (product.marketplace === 'wildberries') {
      const prices = await marketplaceService.wb.getCompetitorPrices([
        parseInt(product.externalId),
      ]);
      competitorPrice = prices.get(parseInt(product.externalId)) || null;
    }

    if (!competitorPrice) return null;

    if (product.price > competitorPrice * 1.15) {
      const recommendedPrice = Math.max(competitorPrice * 1.05, rule.minPrice);

      return {
        product,
        currentPrice: product.price,
        recommendedPrice,
        reason: `Price is 15%+ higher than competitor (${competitorPrice})`,
        action: 'decrease',
        urgency: 'medium',
      };
    }

    return null;
  }

  async executeProtection(): Promise<ExecutionResult> {
    const startTime = Date.now();
    const analyses = await this.analyzeAllProducts();

    const results: ExecutionResult = {
      analyzed: 0,
      updated: 0,
      alerts: 0,
      errors: 0,
      details: [],
    };

    for (const analysis of analyses) {
      results.analyzed++;
      const rule = this.rules.get(analysis.product.id);

      if (analysis.action === 'none') continue;

      if (rule?.autoAdjust && (analysis.action === 'increase' || analysis.action === 'decrease')) {
        try {
          const success = await marketplaceService.updatePrice({
            productId: analysis.product.id,
            marketplace: analysis.product.marketplace,
            externalId: analysis.product.externalId,
            newPrice: analysis.recommendedPrice,
            reason: analysis.reason,
          });

          if (success) {
            results.updated++;
            results.details.push({
              product: analysis.product.name,
              action: 'updated',
              oldPrice: analysis.currentPrice,
              newPrice: analysis.recommendedPrice,
              reason: analysis.reason,
            });
          } else {
            results.errors++;
          }
        } catch {
          results.errors++;
        }
      } else {
        results.alerts++;
        await notificationService.sendAlert({
          type: 'price_protection',
          urgency: analysis.urgency,
          product: analysis.product as unknown as Record<string, unknown>,
          analysis,
        });
      }
    }

    await this.logExecution(results, Date.now() - startTime);

    return results;
  }

  private async logExecution(results: ExecutionResult, durationMs: number): Promise<void> {
    try {
      await db.query(
        `
        INSERT INTO ops_events (event_type, event_source, payload)
        VALUES ('price_protection_run', 'price_agent', $1)
      `,
        [JSON.stringify({ ...results, durationMs })]
      );
    } catch (e) {
      logger.error('Failed to log execution', e);
    }
  }
}

export const priceProtectionAgent = new PriceProtectionAgent();
