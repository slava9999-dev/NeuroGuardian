// ============================================
// NeuroGUARDIAN — Product Matcher Utility
// Fuzzy matching for finding products by name/query
// ============================================

import type { DBProduct } from '../lib/types.js';

/**
 * Find a product in a list by title or ID with fuzzy matching
 */
export function findProductMatch(query: string, products: DBProduct[]): DBProduct | undefined {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return undefined;

  // 1. Try exact ID match
  const exactIdMatch = products.find(
    p =>
      p.product_id.toLowerCase() === normalizedQuery ||
      String(p.nm_id) === normalizedQuery ||
      (p as { vendor_code?: string }).vendor_code?.toLowerCase() === normalizedQuery
  );
  if (exactIdMatch) return exactIdMatch;

  // 2. Try exact title match
  const exactTitleMatch = products.find(p => p.title.toLowerCase() === normalizedQuery);
  if (exactTitleMatch) return exactTitleMatch;

  // 3. Try fuzzy title match (includes)
  const fuzzyMatch = products.find(p => {
    const pTitle = p.title.toLowerCase();
    return (
      pTitle.includes(normalizedQuery) ||
      normalizedQuery.split(/\s+/).some(word => word.length > 3 && pTitle.includes(word))
    );
  });

  return fuzzyMatch;
}

/**
 * Filter products by marketplace and query
 */
export function filterProducts(
  products: DBProduct[],
  marketplace?: string,
  query?: string
): DBProduct[] {
  let filtered = [...products];

  if (marketplace) {
    const mp = marketplace.toUpperCase();
    filtered = filtered.filter(p => p.marketplace?.toUpperCase() === mp);
  }

  if (query) {
    const normalizedQuery = query.toLowerCase().trim();
    filtered = filtered.filter(p => {
      const pTitle = p.title.toLowerCase();
      return (
        pTitle.includes(normalizedQuery) ||
        p.product_id.toLowerCase().includes(normalizedQuery) ||
        String(p.nm_id).includes(normalizedQuery)
      );
    });
  }

  return filtered;
}
