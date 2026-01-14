// ============================================
// NeuroGUARDIAN — Advanced Threat Detector (ML-Lite)
// Enhances threat detection precision using heuristics & dynamic analysis
// Goal: Increase precision from 53% -> 85%
// ============================================

import { createLogger } from '../api-lib/lib/logger.js';
import type { DBProduct } from '../api-lib/lib/types.js';

const logger = createLogger({ service: 'AdvancedThreatDetector' });

/**
 * Historical price point for analysis
 */
export interface PricePoint {
  price: number;
  timestamp: Date;
}

/**
 * Advanced features for ML-Lite scoring
 */
export interface ThreatFeatures {
  priceDropPercent: number; // Immediate drop (vs last point)
  cumulativeDropPercent: number; // Drop vs max in history window
  priceDropVelocity: number; // Drop per hour (immediate)
  volatilityScore: number; // Historical volatility (0-1)
  competitorCorrelation: number; // Correlation with competitors (0-1)
  isFlashCrash: boolean; // >15% drop in <1 hour
}

/**
 * ML-Lite Prediction Result
 */
export interface PredictionResult {
  isThreat: boolean;
  score: number; // 0-100 (Threat Probability)
  confidence: 'low' | 'medium' | 'high';
  threatType: string;
  reasoning: string[];
}

export class AdvancedThreatDetector {
  /**
   * Analyze price dynamics to detect sophisticated threats
   */
  detectAdvancedThreats(
    product: DBProduct,
    currentPrice: number,
    history: PricePoint[],
    competitorPrices?: number[]
  ): PredictionResult {
    // 1. Calculate features
    const features = this.extractFeatures(currentPrice, history, competitorPrices);

    // 2. Score the threat using weighted heuristics (ML-Lite model)
    const score = this.calculateThreatScore(features);

    // 3. Interpret results
    const isThreat = score > 50;
    const confidence = score > 80 ? 'high' : score > 60 ? 'medium' : 'low';

    const reasoning: string[] = [];
    if (features.isFlashCrash) reasoning.push('Обнаружен резкий обвал цены (Flash Crash)');
    if (features.priceDropVelocity > 5)
      reasoning.push(`Высокая скорость падения: ${features.priceDropVelocity.toFixed(1)}%/час`);
    if (features.cumulativeDropPercent > 15 && !features.isFlashCrash)
      reasoning.push(
        `Значительное накопленное падение: ${features.cumulativeDropPercent.toFixed(1)}%`
      );
    if (features.competitorCorrelation < 0.3 && features.priceDropPercent > 0)
      reasoning.push('Аномалия: цена падает против рынка');

    // Log analysis for improvement
    logger.debug('Advanced threat analysis', {
      productId: product.product_id,
      score,
      features,
    });

    return {
      isThreat,
      score,
      confidence,
      threatType: features.isFlashCrash ? 'flash_crash' : 'price_dump',
      reasoning,
    };
  }

  /**
   * Extract features from raw data
   */
  private extractFeatures(
    currentPrice: number,
    history: PricePoint[],
    competitorPrices?: number[]
  ): ThreatFeatures {
    // Sort history by time
    const sortedHistory = [...history].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Get last price (before current)
    const lastPoint = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;
    const lastPrice = lastPoint ? lastPoint.price : currentPrice;

    // Find max price in history window to calculate cumulative drop
    const maxPrice = history.length > 0 ? Math.max(...history.map(p => p.price)) : lastPrice;

    // 1. Immediate Price Drop Percent
    const priceDropPercent = lastPrice > 0 ? ((lastPrice - currentPrice) / lastPrice) * 100 : 0;

    // 2. Cumulative Drop Percent
    const cumulativeDropPercent = maxPrice > 0 ? ((maxPrice - currentPrice) / maxPrice) * 100 : 0;

    // 3. Velocity (percent per hour) - Immediate
    let priceDropVelocity = 0;
    if (lastPoint && priceDropPercent > 0) {
      const hoursDiff = (new Date().getTime() - lastPoint.timestamp.getTime()) / (1000 * 60 * 60);
      priceDropVelocity = hoursDiff > 0.1 ? priceDropPercent / hoursDiff : priceDropPercent; // Avoid divide by zero/tiny
    }

    // 4. Volatility (Standard Deviation / Mean)
    let volatilityScore = 0;
    if (history.length > 2) {
      const prices = history.map(p => p.price);
      const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
      volatilityScore = mean > 0 ? Math.sqrt(variance) / mean : 0;
    }

    // 5. Competitor Correlation (0 = no correlation, 1 = follows competitors)
    // If competitors also dropped, correlation is high (it's a market trend)
    // If competitors stable but we dropped, correlation is low (it's our anomaly)
    let competitorCorrelation = 0.5; // Default neutral
    if (competitorPrices && competitorPrices.length > 0) {
      const avgCompetitorPrice =
        competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
      // Simple logic: if our price <<< competitors, correlation is low
      if (currentPrice < avgCompetitorPrice * 0.85) {
        competitorCorrelation = 0.1; // We are dumping alone
      } else {
        competitorCorrelation = 0.8; // We are in range
      }
    }

    // 6. Flash Crash Detection
    const isFlashCrash = priceDropVelocity > 10; // >10% per hour drop

    return {
      priceDropPercent,
      cumulativeDropPercent,
      priceDropVelocity,
      volatilityScore,
      competitorCorrelation,
      isFlashCrash,
    };
  }

  /**
   * Calculate score (0-100) based on features
   * Higher score = Higher probability of being a real threat
   */
  private calculateThreatScore(features: ThreatFeatures): number {
    let score = 0;

    // Base score from IMMEDIATE drop magnitude
    // A 1% drop is barely a threat, a 20% drop is huge
    // Tuned: 20% drop -> 40 points (was 50 with * 2.5)
    score += Math.min(features.priceDropPercent * 2.0, 40);

    // Velocity Bonus
    // Flash crash (>5%/hr) gets huge bonus
    if (features.priceDropVelocity > 5) score += 20;

    // Cumulative Drop Bonus (Slow Bleed)
    // If cumulative drop > 15% even if immediate drop is small
    // Tuned: Reduced from 30 to 20 to avoid early capping
    if (features.cumulativeDropPercent > 15) {
      score += 20;
    }

    if (features.isFlashCrash) score += 15;

    // Volatility Penalty (high volatility = less likely to be a threat, just noise)
    if (features.volatilityScore > 0.1) score -= 15;

    // Competitor Context - CRITICAL FACTOR
    // If we are dumping alone (low correlation), it's a high threat
    if (features.competitorCorrelation < 0.3) {
      // Only add competitor bonus if there IS a drop to analyze
      if (features.cumulativeDropPercent > 2) {
        score += 25;
      }
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100);
  }
}

export const advancedThreatDetector = new AdvancedThreatDetector();
