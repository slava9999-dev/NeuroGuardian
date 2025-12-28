const fs = require('fs');
const path = require('path');

const content = `# ═══════════════════════════════════════════════════════════════════════
# NeuroGUARDIAN — MASTER ENVIRONMENT VARIABLES (TEMPLATE)
# ⚠️  СТРОГО КОНФИДЕНЦИАЛЬНО! НЕ КОММИТИТЬ В GIT!
# ═══════════════════════════════════════════════════════════════════════
# Порядок переменных соответствует Vercel Dashboard (сверху вниз)
# Заполните значения, скопировав из Vercel
# ═══════════════════════════════════════════════════════════════════════

SERPER_API_KEY=your_serper_api_key

# Upstash for Redis
KV_URL=rediss://default:your_redis_password@your_redis_host:6379
KV_REST_API_READ_ONLY_TOKEN=your_read_only_token
REDIS_URL=rediss://default:your_redis_password@your_redis_host:6379
KV_REST_API_TOKEN=your_rest_api_token
KV_REST_API_URL=https://your_redis_host

API_KEY_ENCRYPTION_KEY=your_32_char_encryption_key

# WARNING: This is the master template. 
# TEST_MODE should NEVER be true here.
TEST_MODE=false

YOOKASSA_SHOP_ID=your_yookassa_shop_id
YOOKASSA_SECRET_KEY=your_yookassa_live_key

OPENAI_API_KEY=your_openai_api_key

CRON_SECRET=your_cron_secret

ADMIN_API_KEY=your_admin_api_key

TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Neon PostgreSQL
POSTGRES_URL=postgresql://user:password@host/neondb?sslmode=require
POSTGRES_PRISMA_URL=postgresql://user:password@host/neondb?connect_timeout=15&sslmode=require
POSTGRES_DATABASE_URL_UNPOOLED=postgresql://user:password@host/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://user:password@host/neondb?sslmode=require
POSTGRES_PGHOST=your_pghost
POSTGRES_USER=your_pguser
POSTGRES_STACK_SECRET_SERVER_KEY=your_stack_secret
POSTGRES_DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
POSTGRES_PASSWORD=your_pgpassword
POSTGRES_DATABASE=neondb
POSTGRES_PGPASSWORD=your_pgpassword
POSTGRES_PGUSER=your_pguser
POSTGRES_URL_NO_SSL=postgresql://user:password@host/neondb
POSTGRES_HOST=your_pghost
NEXT_PUBLIC_POSTGRES_STACK_PUBLISHABLE_CLIENT_KEY=your_stack_publishable_key
POSTGRES_NEON_PROJECT_ID=your_neon_project_id

VITE_USE_EMULATORS=false

# ═══════════════════════════════════════════════════════════════════════
# ДОПОЛНИТЕЛЬНЫЕ (для n8n)
# ═══════════════════════════════════════════════════════════════════════
API_URL=https://neuro-guardian.vercel.app
ADMIN_CHAT_ID=your_admin_telegram_id
`;

fs.writeFileSync(path.join(__dirname, '../.env.master'), content, 'utf8');
console.log('Updated .env.master successfully (TEMPLATE MODE)');
