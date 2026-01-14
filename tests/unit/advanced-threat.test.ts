// ============================================
// NeuroGUARDIAN — Advanced Threat Detector Tests
// Validating ML-Lite scoring logic
// ============================================

import { describe, it, expect } from 'vitest';
import {
  advancedThreatDetector,
  type PricePoint,
} from '../../src/sentinel/AdvancedThreatDetector.js';
import type { DBProduct } from '../../src/api-lib/lib/types.js';

// Mock product
const mockProduct: DBProduct = {
  id: 1,
  user_id: 1,
  product_id: 'test-1',
  title: 'Test Product',
  current_price: 1000,
  marketplace: 'WB',
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
  current_stock: 10,
  min_price: 800,
  is_monitored: true,
  nm_id: 123456,
};

// Helper: create history
function createHistory(prices: number[], intervalHours = 1): PricePoint[] {
  const now = new Date();
  return prices.map((price, i) => ({
    price,
    timestamp: new Date(now.getTime() - (prices.length - 1 - i) * intervalHours * 60 * 60 * 1000),
  }));
}

describe('AdvancedThreatDetector', () => {
  it('should detect Flash Crash (Right Now)', () => {
    // History: Stable 1000 -> Drop to 800 in 1 hour
    const history = createHistory([1000, 1000, 1000]);
    const currentPrice = 800; // -20% drop

    const result = advancedThreatDetector.detectAdvancedThreats(mockProduct, currentPrice, history);

    expect(result.isThreat).toBe(true);
    expect(result.score).toBeGreaterThan(70);
    expect(result.threatType).toBe('flash_crash');
    expect(result.reasoning.some(r => r.includes('Flash Crash'))).toBe(true);
  });

  it('should ignore normal volatility (Noise)', () => {
    // History: Bouncing 950-1050
    const history = createHistory([1000, 950, 1050, 980, 1020]);
    const currentPrice = 960; // Just another dip

    const result = advancedThreatDetector.detectAdvancedThreats(mockProduct, currentPrice, history);

    // Should NOT be a threat or have low score
    expect(result.isThreat).toBe(false);
    expect(result.score).toBeLessThan(50);
  });

  it('should detect Slow Dump (Trend)', () => {
    // History: 1000 -> 950 -> 900 -> 850 (Slowly dying)
    const history = createHistory([1000, 950, 900, 850], 24); // Daily drop
    const currentPrice = 800;

    const result = advancedThreatDetector.detectAdvancedThreats(mockProduct, currentPrice, history);

    // It is a threat, but likely "price_dump" not flash crash
    expect(result.isThreat).toBe(true);
    expect(result.threatType).toBe('price_dump');
  });

  it('should respect Competitor Correlation', () => {
    const history = createHistory([1000, 1000]);
    const currentPrice = 800; // We dropped

    // Case A: Competitors also cheap (Market Trend)
    const resultA = advancedThreatDetector.detectAdvancedThreats(
      mockProduct,
      currentPrice,
      history,
      [800, 810, 790]
    );

    // Case B: Competitors correspond to old price (We are dumping alone)
    const resultB = advancedThreatDetector.detectAdvancedThreats(
      mockProduct,
      currentPrice,
      history,
      [1000, 1050, 990]
    );

    // Result B should have HIGHER score than A
    expect(resultB.score).toBeGreaterThan(resultA.score);
  });
});
