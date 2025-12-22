// ============================================
// NeuroGUARDIAN — Handlers Index
// Re-export all API handlers
// ============================================

// Auth handlers
export { handleAuth, handleSettings, handlePlans } from './auth.js';

// Payment handlers
export { handleCreatePayment, handlePaymentWebhook } from './payments.js';

// Product handlers
export { handleProducts, handleSyncProducts, handleBatchSetStopLoss } from './products.js';

// Admin handlers
export {
  validateAdminAccess,
  handleInitDb,
  handleResetDb,
  handleAdminActivateTrial,
  handleAdminCheckUser,
  handleAdminListUsers,
  handleAdminListProducts,
  handleSentinelLogs,
  handleAdminSentinelLogs,
  handleHealth,
} from './admin.js';
