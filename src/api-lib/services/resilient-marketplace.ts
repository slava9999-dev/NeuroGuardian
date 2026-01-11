// ============================================
// NeuroGUARDIAN — Resilient Marketplace Client
// Marketplace API calls with Circuit Breaker protection
// Wraps marketplace.ts functions with fallback strategies
// ============================================

import { withCircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker.js';
import { logger } from '../lib/logger.js';
import {
  fetchWbProducts,
  fetchWbPrices,
  fetchWbStocks,
  updateWbPrices,
  fetchOzonProducts,
  updateOzonPrices,
  fetchOzonCurrentPrices,
  type MarketplaceProduct,
} from './marketplace-bridge.js';

// ============================================
// TYPES
// ============================================

interface ResilientCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromFallback?: boolean;
  circuitOpen?: boolean;
}

// ============================================
// CACHE FOR FALLBACK (in-memory, short TTL)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Caches for different data types
const productCache = new SimpleCache<MarketplaceProduct[]>();
const priceCache = new SimpleCache<Map<number, number>>();
const stockCache = new SimpleCache<Map<number, number>>();

// ============================================
// RESILIENT WB API CALLS
// ============================================

/**
 * Fetch WB products with circuit breaker and cache fallback
 */
export async function fetchWbProductsResilient(
  apiKey: string,
  limit = 100
): Promise<ResilientCallResult<MarketplaceProduct[]>> {
  const cacheKey = `wb-products-${limit}`;

  try {
    const products = await withCircuitBreaker(
      'wb-content-api',
      () => fetchWbProducts(apiKey, limit),
      // Fallback: return cached data if available
      async () => {
        const cached = productCache.get(cacheKey);
        if (cached) {
          logger.info('[ResilientMarketplace] WB Products: Using cached data (circuit open)');
          return cached;
        }
        throw new Error('No cached data available');
      }
    );

    // Cache successful response
    productCache.set(cacheKey, products);

    return { success: true, data: products };
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = productCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromFallback: true,
          circuitOpen: true,
        };
      }
      return {
        success: false,
        error: 'WB API недоступен, кэш пуст',
        circuitOpen: true,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch WB prices with circuit breaker
 */
export async function fetchWbPricesResilient(
  apiKey: string,
  nmIds: number[]
): Promise<ResilientCallResult<Map<number, number>>> {
  const cacheKey = `wb-prices-${nmIds.slice(0, 5).join('-')}`;

  try {
    const result = await withCircuitBreaker('wb-prices-api', () => fetchWbPrices(apiKey, nmIds));

    if (result.priceMap.size > 0) {
      priceCache.set(cacheKey, result.priceMap);
    }

    return { success: true, data: result.priceMap };
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = priceCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromFallback: true,
          circuitOpen: true,
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

/**
 * Fetch WB stocks with circuit breaker
 */
export async function fetchWbStocksResilient(
  apiKey: string,
  nmIds: number[]
): Promise<ResilientCallResult<Map<number, number>>> {
  const cacheKey = `wb-stocks-${nmIds.slice(0, 5).join('-')}`;

  try {
    const stockMap = await withCircuitBreaker('wb-stocks-api', () => fetchWbStocks(apiKey, nmIds));

    if (stockMap.size > 0) {
      stockCache.set(cacheKey, stockMap);
    }

    return { success: true, data: stockMap };
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = stockCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromFallback: true,
          circuitOpen: true,
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

/**
 * Update WB prices with circuit breaker (no fallback - mutations should fail explicitly)
 */
export async function updateWbPricesResilient(
  apiKey: string,
  updates: Array<{ nmId: number; price: number }>
): Promise<ResilientCallResult<{ count: number; taskId?: number }>> {
  try {
    const result = await withCircuitBreaker('wb-prices-api', () => updateWbPrices(apiKey, updates));

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: { count: result.count, taskId: result.taskId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

// ============================================
// RESILIENT OZON API CALLS
// ============================================

/**
 * Fetch Ozon products with circuit breaker and cache fallback
 */
export async function fetchOzonProductsResilient(
  clientId: string,
  apiKey: string,
  limit = 100
): Promise<ResilientCallResult<MarketplaceProduct[]>> {
  const cacheKey = `ozon-products-${limit}`;

  try {
    const products = await withCircuitBreaker(
      'ozon-api',
      () => fetchOzonProducts(clientId, apiKey, limit),
      async () => {
        const cached = productCache.get(cacheKey);
        if (cached) {
          logger.info('[ResilientMarketplace] Ozon Products: Using cached data (circuit open)');
          return cached;
        }
        throw new Error('No cached data available');
      }
    );

    productCache.set(cacheKey, products);

    return { success: true, data: products };
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = productCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromFallback: true,
          circuitOpen: true,
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

/**
 * Fetch Ozon current prices with circuit breaker
 */
export async function fetchOzonCurrentPricesResilient(
  clientId: string,
  apiKey: string,
  productIds: number[]
): Promise<ResilientCallResult<Map<number, number>>> {
  const cacheKey = `ozon-prices-${productIds.slice(0, 5).join('-')}`;

  try {
    const priceMap = await withCircuitBreaker('ozon-api', () =>
      fetchOzonCurrentPrices(clientId, apiKey, productIds)
    );

    if (priceMap.size > 0) {
      priceCache.set(cacheKey, priceMap);
    }

    return { success: true, data: priceMap };
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = priceCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromFallback: true,
          circuitOpen: true,
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

/**
 * Update Ozon prices with circuit breaker (no fallback for mutations)
 */
export async function updateOzonPricesResilient(
  clientId: string,
  apiKey: string,
  updates: Array<{ productId: number; price: number }>
): Promise<ResilientCallResult<{ count: number; partialErrors?: string[] }>> {
  try {
    const result = await withCircuitBreaker('ozon-api', () =>
      updateOzonPrices(clientId, apiKey, updates)
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: { count: result.count, partialErrors: result.partialErrors },
      };
    }

    return {
      success: true,
      data: { count: result.count, partialErrors: result.partialErrors },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitOpen: error instanceof CircuitOpenError,
    };
  }
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Clear all marketplace caches (for testing or manual refresh)
 */
export function clearMarketplaceCaches(): void {
  productCache.clear();
  priceCache.clear();
  stockCache.clear();
  logger.info('[ResilientMarketplace] All caches cleared');
}
