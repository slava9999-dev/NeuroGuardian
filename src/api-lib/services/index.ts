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
  activateSubscription,
  createTransaction,
  updateTransactionStatus,
  isFirstPayment,
  logSentinelAction,
  getUsersWithExpiringSubscriptions,
  markReminderSent,
  applyReferralBonus,
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
  updateWbPrices,
  fetchOzonProducts,
  updateOzonPrices,
  fetchOzonSalesStats,
  fetchWbSalesStats,
  type MarketplaceProduct,
  type MarketplacePriceUpdate,
  type MarketplaceSalesStats,
  type MarketplaceApiKeys,
} from './marketplace.js';
