export interface MarketplaceProduct {
  product_id: string;
  nm_id?: string;
  title: string;
  image_url: string | null;
  current_price: number;
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  weight_kg?: number;
  needs_details_update?: boolean;
}

export interface MarketplacePriceUpdate {
  product_id: string;
  nm_id?: number;
  new_price: number;
  marketplace: 'WB' | 'Ozon';
}

export interface MarketplaceSalesStats {
  period: string;
  dateFrom: string;
  dateTo: string;
  orders: number;
  revenue: number;
  returns: number;
}
