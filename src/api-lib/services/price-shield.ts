// ============================================
// NeuroGUARDIAN — PriceShield Service (Smart Repricing)
// Logic for competitor following and margin protection
// Version: 1.0.0 | Date: December 2024
// ============================================

import { sql } from '@vercel/postgres';

export interface PriceRule {
  id: number;
  product_id: string;
  min_price: number;
  max_price: number;
  target_margin: number;
  competitor_tracking: boolean;
  competitor_nmids?: string;
  price_match_strategy: 'none' | 'match' | 'undercut' | 'premium';
  undercut_amount: number;
  undercut_type: 'percent' | 'absolute';
  auto_adjust: boolean;
}

export interface RepricingResult {
  newPrice: number;
  reason: string;
  strategyUsed: string;
  isChangeNeeded: boolean;
}

export class PriceShieldService {
  /**
   * Calculate optimal price based on competitor price and rules
   */
  public calculateOptimalPrice(
    currentPrice: number,
    competitorPrice: number | null,
    rule: PriceRule
  ): RepricingResult {
    // 1. If no competitor tracking or no competitor price, stick to current or max?
    // For now, if no competitor signal, we do nothing unless we want to 'return to max' logic (smart recovery)
    if (!rule.competitor_tracking || !competitorPrice || rule.price_match_strategy === 'none') {
      return {
        newPrice: currentPrice,
        reason: 'No competitor signal or strategy disabled',
        strategyUsed: 'none',
        isChangeNeeded: false,
      };
    }

    let targetPrice = currentPrice;
    const strategy = rule.price_match_strategy;

    // 2. Apply Strategy
    switch (strategy) {
      case 'match':
        targetPrice = competitorPrice;
        break;
      case 'undercut':
        if (rule.undercut_type === 'percent') {
          targetPrice = Math.floor(competitorPrice * (1 - rule.undercut_amount / 100));
        } else {
          targetPrice = competitorPrice - rule.undercut_amount;
        }
        break;
      case 'premium':
        if (rule.undercut_type === 'percent') {
          targetPrice = Math.ceil(competitorPrice * (1 + rule.undercut_amount / 100));
        } else {
          targetPrice = competitorPrice + rule.undercut_amount;
        }
        break;
    }

    // 3. Apply Constraints (Min/Max)
    let finalReason = `Competitor at ${competitorPrice}, strategy ${strategy}`;
    let isConstrained = false;

    if (targetPrice < rule.min_price) {
      targetPrice = rule.min_price;
      finalReason += ` -> Clamped to MinPrice ${rule.min_price}`;
      isConstrained = true;
    } else if (targetPrice > rule.max_price) {
      targetPrice = rule.max_price;
      finalReason += ` -> Clamped to MaxPrice ${rule.max_price}`;
      isConstrained = true;
    }

    // 4. Threshold Check (Avoid noise)
    // Don't change price if difference is insignificant (e.g. < 0.5% or < 10 rub) unless it's a constraint fix
    const diff = Math.abs(currentPrice - targetPrice);
    const diffPercent = (diff / currentPrice) * 100;

    if (!isConstrained && (diff < 10 || diffPercent < 0.5)) {
      return {
        newPrice: currentPrice,
        reason: 'Change too small (noise filter)',
        strategyUsed: strategy,
        isChangeNeeded: false,
      };
    }

    return {
      newPrice: Math.round(targetPrice),
      reason: finalReason,
      strategyUsed: strategy,
      isChangeNeeded: targetPrice !== currentPrice,
    };
  }

  /**
   * Fetch Active Rules for a User
   */
  public async getRulesForUser(userId: number): Promise<PriceRule[]> {
    const { rows } = await sql`
      SELECT * FROM price_rules 
      WHERE user_id = ${userId} 
      AND active = true
    `;
    return rows.map((row: any) => ({
      id: row.id,
      product_id: row.product_id,
      min_price: parseFloat(row.min_price),
      max_price: parseFloat(row.max_price),
      target_margin: parseFloat(row.target_margin),
      competitor_tracking: row.competitor_tracking,
      competitor_nmids: row.competitor_nmids,
      price_match_strategy: row.price_match_strategy,
      undercut_amount: parseFloat(row.undercut_amount),
      undercut_type: row.undercut_type,
      auto_adjust: row.auto_adjust,
    }));
  }
}

export const priceShield = new PriceShieldService();
