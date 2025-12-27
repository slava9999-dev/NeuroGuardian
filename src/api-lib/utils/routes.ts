// ============================================
// NeuroGUARDIAN — Route Registry
// Declarative route definitions for cleaner router
// ============================================

// ============================================
// ROUTE GROUPS
// For documentation and organization
// ============================================

export const ROUTE_GROUPS = {
  auth: ['auth', 'settings', 'plans'],
  products: ['products', 'sync-products', 'batch-set-stop-loss'],
  payments: ['create-payment', 'payment-webhook'],
  sentinel: [
    'check-prices',
    'sentinel-logs',
    'sentinel-status',
    'defense-history',
    'toggle-protection',
    'update-sentinel-status',
    'log-defense',
    'bulk-log-defense',
  ],
  agent: ['agent', 'agent-v4', 'agent-confirm', 'agent-status', 'agent-v4-status'],
  chat: ['get-chat-history', 'save-chat-history', 'clear-chat-history'],
  analytics: ['get-analytics', 'get-system-metrics'],
  admin: [
    'init-db',
    'reset-db',
    'run-migration',
    'health',
    'admin-activate-trial',
    'admin-check-user',
    'admin-list-users',
    'admin-list-products',
    'admin-set-protection',
    'admin-test-telegram',
    'admin-reset-statuses',
    'admin-set-defense-mode',
    'admin-test-ozon',
    'admin-test-wb',
    'admin-clone-user',
    'admin-sentinel-logs',
    'send-reminders',
    'referral',
  ],
} as const;

// ============================================
// AVAILABLE ACTIONS LIST
// ============================================

export const AVAILABLE_ACTIONS = [
  ...ROUTE_GROUPS.auth,
  ...ROUTE_GROUPS.products,
  ...ROUTE_GROUPS.payments,
  ...ROUTE_GROUPS.sentinel,
  ...ROUTE_GROUPS.agent,
  ...ROUTE_GROUPS.chat,
  ...ROUTE_GROUPS.analytics,
  ...ROUTE_GROUPS.admin,
];
