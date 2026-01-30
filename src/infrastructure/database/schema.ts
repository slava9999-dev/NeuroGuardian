import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  username: varchar('username', { length: 255 }),
  telegramId: numeric('telegram_id'),
  subscriptionActive: boolean('subscription_active').default(false),
  subscriptionEnd: timestamp('subscription_end'),
  protectionEnabled: boolean('protection_enabled').default(true),
  isActive: boolean('is_active').default(true),
  subscriptionPlan: varchar('subscription_plan', { length: 255 }),
  voiceEnabled: boolean('voice_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const marketplaceAccounts = pgTable('marketplace_accounts', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  marketplace: varchar('marketplace', { length: 50 }).notNull(), // 'WB' | 'Ozon'
  isActive: boolean('is_active').default(true),
  wbToken: text('wb_token'), // Encrypted
  ozonClientId: text('ozon_client_id'), // Encrypted
  ozonApiKey: text('ozon_api_key'), // Encrypted
  createdAt: timestamp('created_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    accountId: integer('account_id').references(() => marketplaceAccounts.id),
    marketplace: varchar('marketplace', { length: 50 }).notNull(),
    productId: varchar('product_id', { length: 255 }).notNull(),
    nmId: varchar('nm_id', { length: 255 }), // WB Nomenclature ID
    title: varchar('title', { length: 255 }).notNull(),
    currentPrice: integer('current_price').notNull(),
    minPrice: integer('min_price').default(0),
    costPrice: integer('cost_price'),
    currentStock: integer('current_stock'),
    isMonitored: boolean('is_monitored').default(true),
    autoAdjustMinPrice: boolean('auto_adjust_min_price').default(false),
    cardDiscountBuffer: integer('card_discount_buffer').default(0),
    sppBufferPercent: integer('spp_buffer_percent').default(0),
    marketplaceDiscountPercent: numeric('marketplace_discount_percent', { precision: 5, scale: 2 }),
    estimatedBuyerPrice: integer('estimated_buyer_price'),
    targetBuyerPrice: integer('target_buyer_price'),
    imageUrl: text('image_url'),
    competitorUrl: text('competitor_url'),
    competitorPrice: integer('competitor_price').default(0),
    priceStrategy: varchar('price_strategy', { length: 50 }).default('passive'),
    minMargin: integer('min_margin').default(0),
    groupId: varchar('group_id', { length: 255 }), // For linking WB/Ozon products (Entity Merging)
    lastVisionSync: timestamp('last_vision_sync'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => {
    return {
      userProductUnique: uniqueIndex('products_user_id_product_id_key').on(
        table.userId,
        table.productId
      ),
      userIdIdx: index('idx_products_user_id').on(table.userId),
      marketplaceIdx: index('idx_products_marketplace').on(table.marketplace),
    };
  }
);

export const sentinelLogs = pgTable('sentinel_logs', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  productId: varchar('product_id', { length: 255 }).notNull(),
  productTitle: varchar('product_title', { length: 255 }),
  detectedPrice: integer('detected_price').notNull(),
  minPrice: integer('min_price').notNull(),
  defenseAction: varchar('defense_action', { length: 255 }).notNull(), // 'PRICE_UPDATE' | 'MONITOR_ONLY' | 'ALERT' | 'AUTO_FIX'
  savedAmount: integer('saved_amount'),
  marketplace: varchar('marketplace', { length: 50 }).notNull(),
  threatType: varchar('threat_type', { length: 100 }),
  success: boolean('success'),
  details: text('details'), // JSON with additional context
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemFlags = pgTable('system_flags', {
  key: varchar('key', { length: 255 }).primaryKey(),
  valueBool: boolean('value_bool'),
  valueText: text('value_text'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value'),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// VALIDATION LOGS (ResponseValidator Analytics)
// ============================================
export const validationLogs = pgTable(
  'validation_logs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).references(() => users.id),
    score: integer('score').notNull(),
    passed: boolean('passed').notNull(),
    issueTypes: text('issue_types'), // JSON array of issue types
    issueCount: integer('issue_count').default(0),
    hasCritical: boolean('has_critical').default(false),
    queryPreview: varchar('query_preview', { length: 100 }), // First 100 chars of query
    responseLength: integer('response_length'),
    processingTimeMs: integer('processing_time_ms'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    userIdIdx: index('idx_validation_logs_user_id').on(table.userId),
    createdAtIdx: index('idx_validation_logs_created_at').on(table.createdAt),
    passedIdx: index('idx_validation_logs_passed').on(table.passed),
  })
);

// ============================================
// THREAT HISTORY (Sentinel Analytics)
// ============================================
export const threatHistory = pgTable(
  'threat_history',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    productId: varchar('product_id', { length: 255 }).notNull(),
    nmId: varchar('nm_id', { length: 255 }),
    marketplace: varchar('marketplace', { length: 50 }).notNull(),
    threatType: varchar('threat_type', { length: 100 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(), // low, medium, high, critical
    message: text('message'),
    threatData: text('threat_data'), // JSON with threat details
    actionTaken: varchar('action_taken', { length: 50 }), // 'auto_fixed', 'user_confirmed', 'ignored', 'pending'
    priceBeforeFix: integer('price_before_fix'),
    priceAfterFix: integer('price_after_fix'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    userIdIdx: index('idx_threat_history_user_id').on(table.userId),
    productIdIdx: index('idx_threat_history_product_id').on(table.productId),
    threatTypeIdx: index('idx_threat_history_threat_type').on(table.threatType),
    createdAtIdx: index('idx_threat_history_created_at').on(table.createdAt),
    severityIdx: index('idx_threat_history_severity').on(table.severity),
  })
);
