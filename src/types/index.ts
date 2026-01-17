// ============================================
// NeuroGUARDIAN — Core Type Definitions
// Strict TypeScript, Null Safety Protocol
// ============================================

// Marketplace types
export type Marketplace = 'WB' | 'Ozon';

// Product status
export type ProductStatus = 'active' | 'protected' | 'triggered' | 'disabled';

// Defense mode
export type DefenseMode = 'zero_stock' | 'price_correction';

// Log entry type
export type LogType = 'price_drop' | 'defense_triggered' | 'sync' | 'error' | 'info';

// ============================================
// User Model
// ============================================
export interface User {
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;

  // Subscription
  subscriptionActive: boolean;
  subscriptionExpiresAt: Date | null;
  subscriptionPlan: 'trial' | 'basic' | 'pro' | 'yearly' | null;

  // Protection settings
  protectionEnabled: boolean;
  defenseMode: DefenseMode;

  // API Keys (references to Secret Manager)
  wbKeyRef: string | null;
  ozonKeyRef: string | null;

  // Stats
  totalProducts: number;
  triggeredToday: number;
  savedAmount: number; // Сколько денег сохранено

  // Sentinel buffer settings
  priceBufferPercent?: number; // Buffer for card discounts (Ozon Card, WB Pay)
  warningThresholdPercent?: number; // Alert when price is within this % of min

  voiceEnabled?: boolean; // Toggle for AI voice responses

  hasUnlinkedAccounts?: boolean; // Flag for UI notification

  // Timestamps (optional - only used on backend)
  createdAt?: Date;
  updatedAt?: Date;
  lastActiveAt?: Date;

  // Subscription days left (computed on login)
  subscriptionDaysLeft?: number | null;
}

// ============================================
// Product Model
// ============================================
export interface Product {
  id: string;
  userId: number;

  // Identifiers
  productId: string; // Universal ID
  nmId?: number; // WB specific
  offerId?: string; // Ozon specific
  vendorCode: string;
  barcode?: string;

  // Display info
  title: string;
  imageUrl: string;
  brand?: string;
  category?: string;

  // Pricing
  currentPrice: number; // Seller's set price
  estimatedBuyerPrice?: number; // Price buyer sees (after marketplace discounts)
  minPrice: number; // Stop-Loss level (0 = disabled)
  costPrice?: number; // Unit economics basis
  supplierSku?: string;
  originalPrice?: number; // Price before any drops

  // Marketplace discounts info
  marketplaceDiscountPercent?: number; // Total discount applied by marketplace
  ozonCardDiscount?: boolean; // True if Ozon Card discount applies

  // Stock
  stock: number;
  warehouses?: WarehouseStock[];

  // Marketplace
  marketplace: Marketplace;

  // Status
  status: ProductStatus;
  isMonitored: boolean;

  // Media
  mediaAssets?: MediaAsset[];
  url?: string; // Link to marketplace product page

  // Timestamps
  lastCheckedAt: Date;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Media Asset Types
// ============================================

export type MediaAssetStatus = 'uploading' | 'analyzing' | 'processing' | 'ready' | 'failed';
export type MediaAssetType = 'original' | 'white_bg' | 'lifestyle' | 'thumbnail' | 'watermarked';

export interface MediaAsset {
  id: string; // UUID
  productId: string; // Reference to product
  userId: string; // Owner (string for BIGINT compatibility)

  // Asset type and status
  type: MediaAssetType;
  status: MediaAssetStatus;

  // URLs
  originalUrl: string; // Original upload (from цех)
  processedUrl?: string; // Processed version
  thumbnailUrl?: string; // 200x200 thumbnail

  // Metadata from Vision analysis
  visionMetadata?: Record<string, unknown>; // Relaxed type for frontend to avoid circular deps

  // Dimensions
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  mimeType?: string;

  // Processing info
  sourceAssetId?: string; // Parent asset (for derivatives)
  processingJobId?: string; // Active job ID
  processingError?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  analyzedAt?: Date;
  processedAt?: Date;
}

export interface WarehouseStock {
  warehouseId: number;
  warehouseName: string;
  stock: number;
}

// ============================================
// Log Entry Model
// ============================================
export interface LogEntry {
  id: string;
  userId: number;

  type: LogType;
  productId?: string;

  title: string;
  message: string;

  metadata: {
    oldPrice?: number;
    newPrice?: number;
    minPrice?: number;
    stockBefore?: number;
    stockAfter?: number;
    marketplace?: Marketplace;
    error?: string;
    [key: string]: unknown;
  };

  isRead: boolean;
  createdAt: Date;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Telegram WebApp Types
// ============================================
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;

  expand: () => void;
  close: () => void;
  ready: () => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  showPopup: (params: PopupParams, callback?: (buttonId: string) => void) => void;

  MainButton: MainButton;
  BackButton: BackButton;
  HapticFeedback: HapticFeedback;
}

export interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;

  setText: (text: string) => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
}

export interface BackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

export interface PopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

// ============================================
// Store Types
// ============================================
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export interface ProductsState {
  products: Product[];
  filteredProducts: Product[];
  isLoading: boolean;
  error: string | null;

  // Filters
  marketplaceFilter: Marketplace | 'all';
  statusFilter: ProductStatus | 'all';
  searchQuery: string;

  // Actions
  setProducts: (products: Product[]) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  setFilter: (
    filter: Partial<{
      marketplace: Marketplace | 'all';
      status: ProductStatus | 'all';
      search: string;
    }>
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface LogsState {
  logs: LogEntry[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  addLog: (log: LogEntry) => void;
  markAsRead: (logId: string) => void;
  markAllAsRead: () => void;
  setLogs: (logs: LogEntry[]) => void;
}
