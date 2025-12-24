// ============================================
// NeuroGUARDIAN — Services Index
// Re-export all services
// ============================================

// Database
export {
  initializeDatabase,
  createOrUpdateUser,
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
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
} from './database.js';

// YooKassa
export {
  createYookassaPayment,
  getPaymentStatus,
  isValidYookassaIP,
  type PaymentResult,
} from './yookassa.js';

// Notifications
export {
  sendTelegramNotification,
  sendExpiryReminders,
  sendProtectionAlert,
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
  setOzonZeroStock,
  setOzonDefensePrice,
  setWbZeroStock,
  setWbDefensePrice,
  // FBS Stock management
  updateWbStockFbs,
  getWbFbsWarehouses,
  updateOzonStockFbs,
  getOzonFbsWarehouses,
  type MarketplaceProduct,
  type MarketplacePriceUpdate,
  type MarketplaceSalesStats,
  type MarketplaceApiKeys,
} from './marketplace.js';
