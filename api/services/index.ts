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
} from './database';

// YooKassa
export {
  createYookassaPayment,
  getPaymentStatus,
  isValidYookassaIP,
  type PaymentResult,
} from './yookassa';

// Notifications
export {
  sendTelegramNotification,
  sendExpiryReminders,
  sendProtectionAlert,
} from './notifications';
