# Database Migrations

## Overview

NeuroGUARDIAN uses PostgreSQL (Neon/Vercel Postgres) with the following migration strategy:

- **Initial schema**: Created via `initializeDatabase()` on first `init-db` API call
- **Migrations**: SQL files in this directory for tracking schema changes

## Migration Files

| File                              | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| `001_create_users.sql`            | Users table with subscriptions, API keys, referrals |
| `002_create_products.sql`         | Products from WB/Ozon with pending price tracking   |
| `003_create_transactions.sql`     | YooKassa payment transactions                       |
| `004_create_sentinel_logs.sql`    | Defense action logs (zero_stock, price_correction)  |
| `005_create_chat_history.sql`     | AI agent chat history (JSONB)                       |
| `006_add_performance_indexes.sql` | Additional indexes for query optimization           |
| `007_add_offer_id.sql`            | Ozon offer_id column for price updates              |

## Running Migrations

Migrations are automatically applied via `initializeDatabase()`:

```bash
# Via API
curl -X POST https://your-domain/api?action=init-db

# Or during development
npm run dev
# Then call init-db endpoint
```

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          USERS                               │
│ id (PK) │ username │ first_name │ api_key_wb │ api_key_ozon │
│ subscription_plan │ subscription_end │ protection_enabled   │
│ defense_mode │ referral_code │ triggered_today │ saved_amount│
└─────────────────────────────────────────────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       PRODUCTS                               │
│ id (PK) │ user_id (FK) │ product_id │ nm_id │ offer_id     │
│ title │ current_price │ min_price │ marketplace │ status    │
│ pending_price │ pending_task_id │ pending_status            │
└─────────────────────────────────────────────────────────────┘
          │
          │ 1:N (via user_id)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SENTINEL_LOGS                             │
│ id (PK) │ user_id (FK) │ product_id │ detected_price        │
│ min_price │ defense_action │ saved_amount │ marketplace     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     TRANSACTIONS                             │
│ id (PK) │ user_id (FK) │ yookassa_payment_id │ amount       │
│ status │ plan │ created_at │ paid_at                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     CHAT_HISTORY                             │
│ id (PK) │ user_id (FK, UNIQUE) │ messages (JSONB) │         │
└─────────────────────────────────────────────────────────────┘
```

## Indexes

### Users

- `idx_users_protection` - Partial index for active protection

### Products

- `idx_products_user_id` - User products lookup
- `idx_products_monitoring` - Partial index for min_price > 0
- `idx_products_offer_id` - Ozon offer_id lookup
- `idx_products_nm_id` - WB nmId lookup (partial, NOT NULL)
- `idx_products_marketplace` - Marketplace filtering
- `idx_products_user_marketplace` - Composite for user+marketplace
- `idx_products_pending` - Pending price verification

### Others

- `idx_transactions_user_id` - User transactions
- `idx_sentinel_logs_user` - Composite (user_id, created_at DESC)
- `idx_chat_history_user` - Chat history lookup

## Adding New Migrations

1. Create new file: `XXX_description.sql`
2. Add corresponding code to `initializeDatabase()` in `database.ts`
3. Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for safety
4. Update this README
