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

export { priceParserService } from '../core-services/PriceParserService.js';

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

// Notifications
// Notifications
export {
  notificationService,
  sendAlert,
  sendAlertToAdmin,
  sendAlertToUser,
  sendTelegramNotification,
} from './notifications.js';

// Marketplace (Unified via Bridge)
export * from './marketplace-bridge.js';

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
