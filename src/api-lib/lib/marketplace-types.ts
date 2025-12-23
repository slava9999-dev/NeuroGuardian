// ============================================
// NeuroGUARDIAN — Marketplace API Types
// WB and Ozon API response types
// Version: 1.0.0 | Date: December 2024
// ============================================

// ============================================
// WILDBERRIES API TYPES
// ============================================

/**
 * WB Content API - Card response
 * From: content-api.wildberries.ru/content/v2/get/cards/list
 */
export interface WbCard {
  nmID: number;
  imtID?: number;
  nmUUID?: string;
  subjectID?: number;
  subjectName?: string;
  vendorCode?: string;
  brand?: string;
  title?: string;
  description?: string;
  photos?: WbPhoto[];
  video?: string;
  dimensions?: WbDimensions;
  characteristics?: WbCharacteristic[];
  sizes?: WbSize[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WbPhoto {
  big?: string;
  c246x328?: string;
  c516x688?: string;
  square?: string;
  tm?: string;
}

export interface WbDimensions {
  length: number;
  width: number;
  height: number;
}

export interface WbCharacteristic {
  id: number;
  name: string;
  value: string | string[];
}

export interface WbSize {
  chrtID?: number;
  techSize?: string;
  wbSize?: string;
  skus?: string[];
  price?: number;
  discountedPrice?: number;
  clubDiscountedPrice?: number;
  salePrice?: number;
}

/**
 * WB Prices API - Goods response
 * From: discounts-prices-api.wildberries.ru/api/v2/list/goods/filter
 */
export interface WbGoodsItem {
  nmID: number;
  vendorCode?: string;
  price?: number;
  discount?: number;
  clubDiscount?: number;
  sizes?: WbGoodsSizeItem[];
}

export interface WbGoodsSizeItem {
  sizeID?: number;
  price?: number;
  discountedPrice?: number;
  clubDiscountedPrice?: number;
  salePrice?: number;
  techSizeName?: string;
}

/**
 * WB Price Update Task Response
 * From: discounts-prices-api.wildberries.ru/api/v2/upload/task
 */
export interface WbUploadTaskResponse {
  data?: {
    id: number;
  };
  error?: boolean;
  errorText?: string;
}

/**
 * WB Task Status - History item
 * From: discounts-prices-api.wildberries.ru/api/v2/history/tasks
 */
export interface WbTaskHistoryItem {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'done' | 'failed';
  createdAt?: string;
  updatedAt?: string;
  details?: WbTaskDetail[];
}

export interface WbTaskDetail {
  nmID: number;
  status: 'accepted' | 'rejected' | 'pending';
  errorText?: string;
  price?: number;
}

/**
 * WB Warehouse - Stock item
 * From: marketplace-api.wildberries.ru/api/v3/stocks/{warehouseId}
 */
export interface WbWarehouse {
  id: number;
  name?: string;
  address?: string;
}

export interface WbStockItem {
  sku: string;
  amount: number;
}

// ============================================
// OZON API TYPES
// ============================================

/**
 * Ozon Product List Response
 * From: api-seller.ozon.ru/v3/product/list
 */
export interface OzonProductListItem {
  product_id: number;
  offer_id?: string;
}

/**
 * Ozon Product Info Response
 * From: api-seller.ozon.ru/v3/product/info/list
 */
export interface OzonProductInfo {
  id: number;
  offer_id?: string;
  name?: string;
  barcode?: string;
  sku?: number;
  marketing_price?: string;
  price?: OzonPrice | string;
  old_price?: string;
  premium_price?: string;
  primary_image?: string | string[];
  images?: string[];
  stocks?: OzonStocksInfo;
  visible?: boolean;
}

export interface OzonPrice {
  price?: string;
  marketing_price?: string;
  old_price?: string;
  premium_price?: string;
  currency_code?: string;
}

export interface OzonStocksInfo {
  stocks?: OzonStockItem[];
  present?: number;
  reserved?: number;
}

export interface OzonStockItem {
  warehouse_id?: number;
  warehouse_name?: string;
  present?: number;
  reserved?: number;
  type?: string;
}

/**
 * Ozon Prices Info Response
 * From: api-seller.ozon.ru/v4/product/info/prices
 */
export interface OzonPriceInfo {
  product_id: number;
  offer_id?: string;
  price?: OzonPrice;
}

/**
 * Ozon Price Update Result
 * From: api-seller.ozon.ru/v1/product/import/prices
 */
export interface OzonPriceUpdateResult {
  product_id: number;
  offer_id?: string;
  updated: boolean;
  errors?: OzonError[];
}

export interface OzonError {
  code?: string;
  message?: string;
  field?: string;
}

/**
 * Ozon Analytics Response
 * From: api-seller.ozon.ru/v1/analytics/data
 */
export interface OzonAnalyticsRow {
  dimensions?: OzonDimension[];
  metrics?: number[];
}

export interface OzonDimension {
  id?: string;
  name?: string;
}
