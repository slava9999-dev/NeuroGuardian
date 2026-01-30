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
  bigint,
  jsonb,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  username: varchar('username', { length: 255 }),
  photoUrl: text('photo_url'),
  telegramId: bigint('telegram_id', { mode: 'bigint' }),
  apiKeyWb: text('api_key_wb'),
  apiKeyOzon: text('api_key_ozon'),
  ozonClientId: varchar('ozon_client_id', { length: 255 }),
  subscriptionActive: boolean('subscription_active').default(false),
  subscriptionEnd: timestamp('subscription_end'),
  subscriptionPlan: varchar('subscription_plan', { length: 255 }),
  protectionEnabled: boolean('protection_enabled').default(true),
  defenseMode: varchar('defense_mode', { length: 50 }),
  isActive: boolean('is_active').default(true),
  voiceEnabled: boolean('voice_enabled').default(true),
  paymentMethodId: varchar('payment_method_id', { length: 255 }),
  totalProducts: integer('total_products').default(0),
  triggeredToday: integer('triggered_today').default(0),
  savedAmount: numeric('saved_amount', { precision: 12, scale: 2 }),
  referralCode: varchar('referral_code', { length: 50 }),
  priceBufferPercent: integer('price_buffer_percent').default(5),
  warningThresholdPercent: integer('warning_threshold_percent').default(10),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }),
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
    officialSku: text('official_sku'),
    offerId: varchar('offer_id', { length: 255 }),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 255 }),
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
    category: text('category'),
    imageUrl: text('image_url'),
    barcode: varchar('barcode', { length: 255 }),
    widthCm: integer('width_cm'),
    heightCm: integer('height_cm'),
    depthCm: integer('depth_cm'),
    weightKg: numeric('weight_kg'),
    competitorUrl: text('competitor_url'),
    competitorPrice: integer('competitor_price').default(0),
    priceStrategy: varchar('price_strategy', { length: 50 }).default('passive'),
    minMargin: integer('min_margin').default(0),
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
  details: jsonb('details'), // Match DB jsonb type
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemFlags = pgTable('system_flags', {
  key: text('key').primaryKey(),
  valueBool: boolean('value_bool'),
  valueText: text('value_text'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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

// ============================================
// OPERATIONS EVENTS (Ops Logger)
// ============================================
export const opsEvents = pgTable(
  'ops_events',
  {
    id: serial('id').primaryKey(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventSource: varchar('event_source', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).references(() => users.id),
    productId: bigint('product_id', { mode: 'bigint' }),
    payload: jsonb('payload').default({}),
    oldPrice: integer('old_price'),
    newPrice: integer('new_price'),
    competitorPrice: integer('competitor_price'),
    actionTaken: varchar('action_taken', { length: 50 }),
    marketplace: varchar('marketplace', { length: 20 }),
    externalId: varchar('external_id', { length: 255 }),
    severity: varchar('severity', { length: 20 }).default('INFO'),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: varchar('entity_id', { length: 255 }),
    processedAt: timestamp('processed_at'),
    processingResult: jsonb('processing_result'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    userIdIdx: index('idx_ops_events_user_id').on(table.userId),
    createdAtIdx: index('idx_ops_events_created_at').on(table.createdAt),
    typeIdx: index('idx_ops_events_type').on(table.eventType),
  })
);

// ============================================
// OPERATIONS AUDIT (Immutable)
// ============================================
export const opsAudit = pgTable(
  'ops_audit',
  {
    id: serial('id').primaryKey(),
    actorType: varchar('actor_type', { length: 20 }).notNull(),
    actorId: varchar('actor_id', { length: 255 }),
    action: varchar('action', { length: 50 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    metadata: jsonb('metadata').default({}),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 255 }),
    success: boolean('success').default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    resourceIdx: index('idx_ops_audit_resource').on(table.resourceType, table.resourceId),
  })
);
