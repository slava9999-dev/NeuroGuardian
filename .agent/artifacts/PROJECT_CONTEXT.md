# 🧠 NeuroGUARDIAN — Полный контекст проекта

**Дата:** 2026-01-15  
**Версия:** 3.0.0  
**Архитектура:** Multi-Agent V6 + RAG

---

## 1. СТРУКТУРА ПРОЕКТА

```
NeuroGUARDIAN/
├── api/                          # Vercel Serverless Functions entry points
│   ├── index.ts                  # Main API router
│   └── cron/                     # Cron jobs (Sentinel cycles, reports)
├── src/
│   ├── agent/                    # 🧠 AI Agent Architecture
│   │   ├── core/                 # Orchestration, State, Memory
│   │   │   ├── AgentOrchestratorV5.ts
│   │   │   ├── StateManager.ts
│   │   │   ├── MemoryManager.ts
│   │   │   ├── ExperienceLearning.ts
│   │   │   └── ResponseValidator.ts
│   │   ├── specialists/          # Multi-Agent Specialists (V6)
│   │   │   ├── MultiAgentOrchestrator.ts  # Main router
│   │   │   ├── IntentClassifier.ts        # LLM/Rules intent detection
│   │   │   ├── BaseSpecialist.ts          # Abstract base
│   │   │   ├── ProductsSpecialist.ts
│   │   │   ├── PricingSpecialist.ts
│   │   │   ├── SentinelSpecialist.ts
│   │   │   ├── AnalyticsSpecialist.ts
│   │   │   └── ChatSpecialist.ts
│   │   ├── execution/
│   │   │   ├── ToolRegistry.ts    # Tool registry
│   │   │   └── tools/             # 21 tools (see below)
│   │   └── utils/
│   ├── infrastructure/
│   │   ├── llm/                   # LLM Providers
│   │   │   ├── GeminiProvider.ts  # Main (Direct Google + OpenRouter)
│   │   │   ├── OpenAIProvider.ts
│   │   │   └── LLMRouter.ts
│   │   └── rag/                   # RAG Infrastructure
│   │       ├── VectorStore.ts     # pgvector-based store
│   │       ├── SpecialistKnowledgeBase.ts
│   │       ├── DocumentChunker.ts
│   │       └── IngestionPipeline.ts
│   ├── integrations/
│   │   ├── wildberries/client.ts  # WB API Client
│   │   └── ozon/client.ts         # Ozon API Client
│   ├── sentinel/                  # Ценовая защита
│   │   ├── SentinelOrchestrator.ts
│   │   ├── PriceMonitor.ts
│   │   ├── ThreatDetector.ts
│   │   ├── DefenseExecutor.ts
│   │   └── AlertSender.ts
│   ├── api-lib/                   # Backend services
│   │   ├── handlers/              # API handlers
│   │   ├── services/              # Business logic
│   │   ├── repositories/          # Data access
│   │   └── core-services/         # WbService, OzonService
│   ├── core/
│   │   ├── types/                 # TypeScript types
│   │   └── errors/                # Error classes
│   ├── pages/                     # React pages
│   ├── components/                # React components
│   └── stores/                    # Zustand stores
├── security-agent/                # Security monitoring package
├── docs/
│   ├── knowledge_base/            # RAG source docs
│   ├── business/                  # Business docs
│   └── technical/                 # Tech docs
├── tests/                         # 445+ tests
└── scripts/                       # Utility scripts
```

---

## 2. СТЕК ТЕХНОЛОГИЙ

### Core

```json
{
  "runtime": "Node.js 20+ / Bun",
  "language": "TypeScript 5.9",
  "framework": "Vite 7 + React 19",
  "styling": "Tailwind CSS 4",
  "state": "Zustand 5",
  "hosting": "Vercel (Serverless)",
  "database": "PostgreSQL (Neon) + pgvector"
}
```

### AI/LLM

```json
{
  "primary_llm": "Google Gemini 2.5 Flash (Direct API)",
  "fallback_llm": "OpenRouter (любая модель)",
  "embeddings": "Gemini text-embedding-004 (768 dims)",
  "rag": "pgvector + custom VectorStore",
  "orchestration": "Custom Multi-Agent (не LangChain)"
}
```

### Integrations

```json
{
  "marketplaces": ["Wildberries", "Ozon"],
  "notifications": "Telegram Bot API",
  "payments": "YooKassa",
  "cron": "Vercel Cron"
}
```

---

## 3. АРХИТЕКТУРА АГЕНТОВ (Multi-Agent V6)

### Flow:

```
User Query → IntentClassifier → Specialist Router → Specialist.execute() → Response
                   ↓
            5 Categories:
            PRODUCTS | PRICING | SENTINEL | ANALYTICS | CHAT
```

### Intent Classifier (`IntentClassifier.ts`)

- **LLM Mode:** Gemini Flash для точной классификации
- **Rules Mode:** Fallback на regex patterns (быстро, без API)
- **Entities:** Извлекает productIds, prices, marketplace

### Specialists Structure:

```typescript
abstract class BaseSpecialist {
  name: string;
  description: string;
  tools: string[];
  systemPrompt: string;

  abstract buildContext(context: SpecialistContext): Promise<string>;
  execute(query: string, context: SpecialistContext): Promise<SpecialistResult>;
}
```

### Available Tools (21):

| Tool                   | Description                           |
| ---------------------- | ------------------------------------- |
| `get_products`         | Список товаров с фильтрами            |
| `sync_catalog`         | Синхронизация с WB/Ozon               |
| `set_stop_loss`        | Установка минимальной цены            |
| `bulk_protect`         | Массовая защита товаров               |
| `calculate_economics`  | Юнит-экономика                        |
| `get_abc_analysis`     | ABC-анализ товаров                    |
| `get_competitor_price` | Цены конкурентов                      |
| `get_real_price`       | Реальная цена для покупателя (WB SPP) |
| `get_reviews`          | Отзывы и рейтинги                     |
| `get_sales_stats`      | Статистика продаж                     |
| `get_stock_forecast`   | Прогноз остатков                      |
| `update_prices`        | Обновление цен                        |
| `update_stocks`        | Обновление остатков                   |
| `search_web`           | Поиск в интернете (Serper)            |
| ... и другие           |

---

## 4. ИНТЕГРАЦИЯ С МАРКЕТПЛЕЙСАМИ

### Wildberries Client (`src/integrations/wildberries/client.ts`)

```typescript
class WildberriesClient {
  // Rate Limiting: 90 req/min

  getProducts(): Promise<WBProduct[]>; // Content API v2
  getPrices(): Promise<WBPrice[]>; // Prices API v1
  updatePrice(nmId, price): Promise<boolean>;
  getCompetitorPrices(nmIds): Promise<Map<number, number>>; // Public API
}

interface WBProduct {
  nmID: number; // Уникальный ID карточки
  vendorCode: string; // Артикул продавца
  title: string;
  stocks: Array<{ qty: number }>;
}
```

### Ozon Client (`src/integrations/ozon/client.ts`)

```typescript
class OzonClient {
  // Rate Limiting: 50 req/min

  getProducts(page, pageSize): Promise<OzonProduct[]>;
  getProductInfo(productIds): Promise<OzonProductInfo[]>;
  getPrices(productIds): Promise<OzonPrice[]>;
  updatePrices(updates: OzonPriceUpdate[]): Promise<any>;
}

interface OzonProduct {
  product_id: number; // Ozon internal ID
  offer_id: string; // Артикул продавца (наш SKU)
}
```

### Связь ID:

```typescript
// products table
{
  id: number,              // Наш internal ID
  user_id: number,         // Telegram User ID (BIGINT)
  product_id: string,      // Generic product identifier
  nm_id: number | null,    // Wildberries nmID
  offer_id: string | null, // Ozon offer_id
  official_sku: string,    // Unified SKU
  marketplace: 'WB' | 'Ozon'
}
```

---

## 5. БАЗА ДАННЫХ (PostgreSQL + pgvector)

### Product Schema:

```typescript
interface DBProduct {
  id: number; // SERIAL PRIMARY KEY
  user_id: number; // BIGINT (Telegram ID)
  product_id: string; // VARCHAR(255)
  nm_id: number | null; // BIGINT (WB)
  watermarked: MediaAsset | null; // With logon)
  offer_id: string | null; // VARCHAR(255) (Ozon)
  official_sku: string | null;
  title: string; // VARCHAR(500)
  image_url: string | null;
  current_price: number; // INTEGER (копейки или рубли)
  estimated_buyer_price: number | null;
  marketplace_discount_percent: number | null;
  min_price: number; // Stop-loss цена
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
  account_id: number | null; // Связь с marketplace_accounts
  status: string;
  is_monitored: boolean;
  card_discount_buffer: number | null;
  cost_price: number | null; // Себестоимость для юнит-экономики
  category: string | null;
  // Pending price tracking
  pending_price: number | null;
  pending_task_id: number | null;
  pending_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  created_at: Date;
  updated_at: Date;
}
```

### RAG Embeddings Table:

```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  namespace VARCHAR(50),      -- 'wb_api', 'ozon_api', 'faq', 'pricing', etc.
  source_file VARCHAR(255),
  chunk_index INTEGER,
  title VARCHAR(500),
  content TEXT,
  embedding vector(768),      -- Gemini embeddings
  metadata JSONB,
  created_at TIMESTAMP
);

CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## 6. RAG СИСТЕМА

### Knowledge Base Namespaces:

```typescript
const SPECIALIST_NAMESPACES = {
  ProductsSpecialist: ['wb_api', 'ozon_api', 'faq'],
  PricingSpecialist: ['wb_api', 'ozon_api', 'pricing', 'sentinel'],
  SentinelSpecialist: ['sentinel', 'pricing', 'wb_api', 'ozon_api'],
  AnalyticsSpecialist: ['analytics', 'pricing', 'faq'],
  ChatSpecialist: ['faq', 'onboarding'],
};
```

### VectorStore API:

```typescript
class VectorStore {
  embeddingProvider: GeminiEmbeddingProvider; // 768 dims

  addDocument(doc: EmbeddingDocument): Promise<number>;
  search(query, options): Promise<SearchResult[]>;
  hybridSearch(query, options): Promise<SearchResult[]>; // Vector + Text
}
```

### Source Documents (`docs/knowledge_base/`):

- `viktor_personality.md` — Личность агента
- `wb_api_guide.md` — Wildberries API документация
- `ozon_api_guide.md` — Ozon API документация
- `sentinel_guide.md` — Как работает защита
- `faq.md` — Часто задаваемые вопросы

---

## 7. LLM ПРОВАЙДЕР

### GeminiProvider (`src/infrastructure/llm/GeminiProvider.ts`)

```typescript
class GeminiProvider implements LLMProvider {
  // Приоритет:
  // 1. Direct Google API (GEMINI_API_KEY) — бесплатно, работает в РФ
  // 2. OpenRouter (OPENROUTER_API_KEY) — fallback, платно

  complete(messages: LLMMessage[]): Promise<LLMResponse>;
  completeWithTools(messages, tools): Promise<LLMResponse>; // Function calling
}

// Models:
const MODELS = {
  flash: 'gemini-2.0-flash-001', // Быстрый (intent, chat)
  pro: 'gemini-2.0-pro-exp-02-05', // Мощный (сложные задачи)
};
```

---

## 8. АВТОРИЗАЦИЯ МАРКЕТПЛЕЙСОВ

### Хранение токенов:

```typescript
// marketplace_accounts table
{
  id: number,
  user_id: number,          // Telegram ID
  name: string,             // "Мой магазин WB"
  marketplace: 'WB' | 'Ozon',
  api_key: string,          // ENCRYPTED (AES-256-GCM)
  ozon_client_id: string,   // ENCRYPTED (только для Ozon)
  is_active: boolean,
  created_at: Date
}
```

### Шифрование:

```typescript
// src/api-lib/lib/crypto.ts
import { encrypt, decrypt } from './crypto';

// При сохранении:
const encryptedKey = encrypt(rawApiKey, process.env.API_KEY_ENCRYPTION_KEY);

// При использовании:
const rawKey = decrypt(encryptedKey, process.env.API_KEY_ENCRYPTION_KEY);
```

---

## 9. SENTINEL (ЦЕНОВАЯ ЗАЩИТА)

### Архитектура:

```
Cron (каждые 15 мин) → SentinelOrchestrator
                            ↓
                    PriceMonitor.fetchPrices()
                            ↓
                    ThreatDetector.analyze()
                            ↓
                    DefenseExecutor.defend()  (если угроза)
                            ↓
                    AlertSender.notify()
```

### Типы угроз:

```typescript
type ThreatType =
  | 'flash_crash' // Резкое падение >10%
  | 'slow_erosion' // Медленное падение
  | 'competitor_undercut' // Конкурент снизил цену
  | 'margin_squeeze'; // Маржа ниже порога
```

---

## 10. ENV VARIABLES (Production)

```bash
# Database
POSTGRES_URL=postgresql://...

# LLM
GEMINI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-v1-...  # Optional

# Telegram
TELEGRAM_BOT_TOKEN=...
ADMIN_TELEGRAM_ID=...

# Security
API_KEY_ENCRYPTION_KEY=...
ADMIN_API_KEY=...
CRON_SECRET=...

# Payments
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...

# Integrations (user-level, stored encrypted in DB)
# WB_API_KEY, OZON_API_KEY, OZON_CLIENT_ID
```

---

## 11. ТЕКУЩИЕ ЗАДАЧИ / ПРОБЛЕМЫ

### ✅ Решено:

- Multi-Agent V6 работает локально (968 tokens, успешный ответ)
- GEMINI_API_KEY добавлен на Vercel

### ⚠️ В процессе:

- Production агент возвращает ошибку (нужно проверить логи Vercel)
- user_id BIGINT overflow (Telegram ID > INT32)

### 📋 Roadmap проекта:

1. **Content Generation** — генерация описаний для WB/Ozon
2. **Media Pipeline** — обработка изображений (белый фон для WB)
3. **SEO Optimization** — гибридные тексты (SEO + премиальный стиль)
4. **Stock Sync** — мгновенная синхронизация при заказе

---

## 12. КОНТАКТ

**Репозиторий:** https://github.com/slava9999-dev/NeuroGuardian  
**Production:** https://neuro-guardian.vercel.app  
**Telegram Bot:** @NeuroGuardianBot

---

_Документ сгенерирован автоматически для передачи контекста_
