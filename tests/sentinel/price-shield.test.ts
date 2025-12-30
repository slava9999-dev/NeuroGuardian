import { describe, it, expect } from 'vitest';
import { PriceShieldService, PriceRule } from '../../src/api-lib/services/price-shield.js';

describe('PriceShieldService', () => {
  const service = new PriceShieldService();

  const baseRule: PriceRule = {
    id: 1,
    product_id: 'wb_123',
    min_price: 1000,
    max_price: 2000,
    target_margin: 20,
    competitor_tracking: true,
    price_match_strategy: 'match',
    undercut_amount: 0,
    undercut_type: 'absolute',
    auto_adjust: true,
  };

  it('should match competitor price within range', () => {
    const result = service.calculateOptimalPrice(1500, 1400, baseRule);
    expect(result.newPrice).toBe(1400);
    expect(result.isChangeNeeded).toBe(true);
    expect(result.strategyUsed).toBe('match');
  });

  it('should undercut competitor by absolute amount', () => {
    const rule = {
      ...baseRule,
      price_match_strategy: 'undercut',
      undercut_amount: 100,
      undercut_type: 'absolute',
    } as PriceRule;
    const result = service.calculateOptimalPrice(1500, 1400, rule);
    expect(result.newPrice).toBe(1300); // 1400 - 100
  });

  it('should undercut competitor by percentage', () => {
    const rule = {
      ...baseRule,
      price_match_strategy: 'undercut',
      undercut_amount: 10,
      undercut_type: 'percent',
    } as PriceRule;
    const result = service.calculateOptimalPrice(1500, 1400, rule);
    expect(result.newPrice).toBe(1260); // 1400 - 10% (140) = 1260
  });

  it('should respect min_price constraint', () => {
    const rule = {
      ...baseRule,
      price_match_strategy: 'undercut',
      undercut_amount: 500,
      min_price: 1200,
    } as PriceRule;
    const result = service.calculateOptimalPrice(1500, 1400, rule);
    // Target: 1400 - 500 = 900. Min: 1200.
    expect(result.newPrice).toBe(1200);
    expect(result.reason).toContain('Clamped to MinPrice');
  });

  it('should respect max_price constraint', () => {
    const rule = { ...baseRule, price_match_strategy: 'match', max_price: 1300 } as PriceRule;
    const result = service.calculateOptimalPrice(1200, 1400, rule);
    // Target: 1400. Max: 1300.
    expect(result.newPrice).toBe(1300);
    expect(result.reason).toContain('Clamped to MaxPrice');
  });

  it('should not change price if difference is insignificant (noise filter)', () => {
    const result = service.calculateOptimalPrice(1400, 1405, baseRule);
    // Diff 5 rub is < 0.5% of 1400 (7 rub)
    expect(result.isChangeNeeded).toBe(false);
    expect(result.newPrice).toBe(1400);
    expect(result.reason).toContain('noise filter');
  });

  it('should change price if difference is significant', () => {
    const result = service.calculateOptimalPrice(1400, 1420, baseRule);
    // Diff 20 rub is > 0.5%
    expect(result.isChangeNeeded).toBe(true);
    expect(result.newPrice).toBe(1420);
  });
});
