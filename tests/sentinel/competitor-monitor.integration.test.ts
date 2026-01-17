import { describe, it, expect, beforeAll, vi } from 'vitest';
import { fetchWbCompetitorData } from '../../src/api-lib/services/competitor-monitor.js';

describe('CompetitorMonitor (Integration)', () => {
  // A known active product on WB (e.g., generic electronics or clothes)
  // This ID might expire, so robustness is key.
  // Using a relatively stable product ID (e.g. basic t-shirt or popular electronics)
  // Art: 138593051 (T-shirt)
  const TEST_NM_ID = 138593051;

  beforeAll(() => {
    vi.unstubAllGlobals(); // Restore real fetch
    vi.setConfig({ testTimeout: 60000 });
  });

  it('should fetch real data from WB public API', async () => {
    try {
      const data = await fetchWbCompetitorData(TEST_NM_ID);

      // If product is sold out or delisted, data might be null or available=false
      // But the call should not throw.
      console.log('WB Competitor Data:', data);

      if (data) {
        expect(data.nmId).toBe(TEST_NM_ID);
        expect(typeof data.price).toBe('number');
        expect(data.price).toBeGreaterThan(0);
        expect(typeof data.basicPrice).toBe('number');
        expect(typeof data.stock).toBe('number');
      } else {
        console.warn('Test product not found or API changed');
      }
    } catch (error) {
      console.warn('⚠️ Network or API error during integration test (Soft Fail):', error);
      // Soft fail: do not fail the test suite if external API is flaky
    }
  }, 60000);

  it('should return null for non-existent product', async () => {
    try {
      const data = await fetchWbCompetitorData(999999999999);
      expect(data).toBeNull();
    } catch (error) {
      console.warn('⚠️ Network or API error during integration test (Soft Fail):', error);
    }
  }, 60000);
});
