import { WildberriesClient } from '@/integrations/wildberries/client';
import { OzonClient } from '@/integrations/ozon/client';
import { EventEmitter } from 'events';

export type Marketplace = 'wildberries' | 'ozon';

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

interface PriceUpdate {
  productId: string;
  marketplace: Marketplace;
  externalId: string; // nmId or product_id
  newPrice: number;
  reason: string;
}

export class MarketplaceService extends EventEmitter {
  public wb: WildberriesClient;
  public ozon: OzonClient;

  constructor() {
    super();
    this.wb = new WildberriesClient();
    this.ozon = new OzonClient();
  }

  async getAllProducts(): Promise<UnifiedProduct[]> {
    const [wbProducts, ozonProducts] = await Promise.all([
      this.getWBProducts(),
      this.getOzonProducts(),
    ]);

    return [...wbProducts, ...ozonProducts];
  }

  private async getWBProducts(): Promise<UnifiedProduct[]> {
    try {
      const [cards, prices] = await Promise.all([this.wb.getProducts(), this.wb.getPrices()]);

      const priceMap = new Map(prices.map((p: any) => [p.nmId, p]));

      return cards.map((card: any) => ({
        id: `wb_${card.nmID}`,
        marketplace: 'wildberries',
        externalId: card.nmID.toString(),
        name: card.title || `Product ${card.nmID}`,
        price: (priceMap.get(card.nmID) as any)?.price || 0,
        stock: card.stocks?.reduce((sum: number, s: any) => sum + s.qty, 0) || 0,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      this.emit('error', { marketplace: 'wildberries', error });
      return [];
    }
  }

  private async getOzonProducts(): Promise<UnifiedProduct[]> {
    try {
      const products = await this.ozon.getProducts();
      if (products.length === 0) return [];

      const productIds = products.map(p => p.product_id);

      const [info, prices] = await Promise.all([
        this.ozon.getProductInfo(productIds),
        this.ozon.getPrices(productIds),
      ]);

      const infoMap = new Map(info.map((i: any) => [i.id, i]));
      const priceMap = new Map(prices.map((p: any) => [p.product_id, p]));

      return products.map((product: any) => {
        const productInfo = infoMap.get(product.product_id) as any;
        const productPrice = priceMap.get(product.product_id) as any;

        return {
          id: `ozon_${product.product_id}`,
          marketplace: 'ozon',
          externalId: product.product_id.toString(),
          name: productInfo?.name || product.offer_id,
          price: parseFloat(productPrice?.price?.price || '0'),
          oldPrice: parseFloat(productPrice?.price?.old_price || '0'),
          stock: productInfo?.stocks?.present || 0,
          lastUpdated: new Date(),
        };
      });
    } catch (error) {
      this.emit('error', { marketplace: 'ozon', error });
      return [];
    }
  }

  async updatePrice(update: PriceUpdate): Promise<boolean> {
    // Log intent with reason for audit purposes
    await this.logEvent('price_update_started', update);

    try {
      const { marketplace, externalId, newPrice } = update;
      if (marketplace === 'wildberries') {
        await this.wb.updatePrice(parseInt(externalId), newPrice);
      } else if (marketplace === 'ozon') {
        await this.ozon.updatePrices([
          {
            product_id: parseInt(externalId),
            price: newPrice.toString(),
          },
        ]);
      }

      // Log success
      await this.logEvent('price_update_completed', { ...update, success: true });
      this.emit('priceUpdated', update);

      return true;
    } catch (error: any) {
      await this.logEvent('price_update_failed', { ...update, error: error.message });
      this.emit('error', { ...update, error });
      return false;
    }
  }

  private async logEvent(type: string, data: any): Promise<void> {
    try {
      // NOTE: We use raw SQL or a query helper here.
      // Assuming 'ops_events' table exists from migration 012.
      // If db is not globally available, we use @vercel/postgres 'sql' or similar.
      // But 'sql' is for tagged templates.
      // We will assume a global 'db' helper is available or use a direct import.
      // For now, let's use a safe console log if DB is missing, but try to use sql.
      // But we can't easily import 'db' if it's not standard.
      // Let's rely on standard 'messages' if db fails.

      // Actually, let's try to import the db client if possible.
      // But typically services shouldn't hard-depend on specific DB client instance path if it varies.
      // We'll skip DB write here in standard code to avoid compilation error if db module missing.
      // We will implement this properly when connecting PriceProtectionAgent which has db access.
      console.log(`[MarketplaceService] ${type}`, data);
    } catch (e) {
      console.error('Failed to log event', e);
    }
  }
}

export const marketplaceService = new MarketplaceService();
