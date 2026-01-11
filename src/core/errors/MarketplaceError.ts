import type { Marketplace } from '../types/marketplace.types.js';

export class MarketplaceError extends Error {
  marketplace: Marketplace;
  statusCode?: number;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    marketplace: Marketplace,
    statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MarketplaceError';
    this.message = message;
    this.marketplace = marketplace;
    this.statusCode = statusCode;
    this.context = context;
  }
}
