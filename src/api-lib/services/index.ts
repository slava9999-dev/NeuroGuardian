// ============================================
// NeuroGUARDIAN — Services Index
// Re-export all services
// ============================================

// Users & Accounts
export {
  getMarketplaceAccounts,
  getAccountById,
  addMarketplaceAccount,
  getAllUsers,
  getUsersStats,
  getUsersPaginated,
} from './users.js';

// Database
export {
  initializeDatabase,
  createOrUpdateUser,
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  updateProductMonitoring,
  updateProductCostPrice,
  updateProductCategory,
  batchUpdateCostPrices,
  updateProductPrice,
  batchUpdateWbPrices,
  batchUpdateOzonPrices,
  activateSubscription,
  createTransaction,
  updateTransactionStatus,
  isFirstPayment,
  logSentinelAction,
  getUsersWithExpiringSubscriptions,
  markReminderSent,
  applyReferralBonus,
  // Pending price tracking (Dec 2024)
  setPendingPrice,
  clearPendingPrice,
  confirmPendingPrice,
  batchSetPendingPrices,
  getProductsWithPendingPrices,
  batchConfirmPendingByTaskId,
  migrateAddPendingColumns,
  // Chat history (Dec 2024)
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  // Sales History (Dec 2024)
  getSalesHistory,
  upsertMarketplaceOrders,
  saveProducts,
} from './database.js';

// YooKassa
export {
  createYookassaPayment,
  getPaymentStatus,
  isValidYookassaIP,
  type PaymentResult,
} from './yookassa.js';

// Notifications
// Notifications
export {
  notificationService,
  sendAlert,
  sendAlertToAdmin,
  sendAlertToUser,
  sendTelegramNotification,
} from './notifications.js';

// Marketplace (WB & Ozon unified API)
export {
  getMarketplaceKeys,
  fetchWbProducts,
  fetchWbPrices,
  fetchWbStocks,
  updateWbPrices,
  fetchOzonProducts,
  updateOzonPrices,
  fetchOzonSalesStats,
  fetchWbSalesStats,
  // Sentinel defense operations
  fetchOzonCurrentPrices,
  fetchOzonProductInfo,
  fetchOzonStocksV3,
  fetchOzonAnalytics,
  fetchWbOrders,
  fetchOzonOrders,
  fetchOzonFbsUnfulfilledOrders,
  setOzonZeroStock,
  setOzonDefensePrice,
  setWbZeroStock,
  setWbDefensePrice,
  // FBS Stock management
  updateWbStockFbs,
  getWbFbsWarehouses,
  updateOzonStockFbs,
  getOzonFbsWarehouses,
  // Buyer price estimation (since Ozon removed marketing_price from API)
  calculateOzonBuyerPrice,
  calculateWbBuyerPrice,
  OZON_DISCOUNT_CONFIG,
  WB_DISCOUNT_CONFIG,
  type MarketplaceProduct,
  type MarketplacePriceUpdate,
  type MarketplaceSalesStats,
  type MarketplaceApiKeys,
  // Sales Sync
  syncSalesHistory,
} from './marketplace.js';

// Unit Economics (Dec 2024)
export {
  calculateUnitEconomics,
  getCommissionRate,
  estimateCostPrice,
  WB_COMMISSIONS,
  OZON_COMMISSIONS,
  LOGISTICS_COSTS,
  STORAGE_COSTS,
  SPP_RATES,
  ACQUIRING_RATES,
  type UnitEconomicsInput,
  type UnitEconomicsResult,
} from './unit-economics.js';

// Ops Panel (Dec 2024)
// Ops Panel (Dec 2024)
export {
  logOpsEvent,
  logAudit,
  getSystemEvents,
  type OpsEvent,
  type AuditEntry,
} from './ops-logger.js';

// n8n Client
export {
  triggerN8nWorkflow,
  triggerSyncProducts,
  triggerRetryOnboarding,
  getN8nSystemHealth,
  type N8nActionPayload,
} from './n8n-client.js';
