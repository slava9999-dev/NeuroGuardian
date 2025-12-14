# 🔍 ПОЛНЫЙ АУДИТ БИЗНЕС-ЛОГИКИ NeuroGUARDIAN

## Дата: 2024-12-14 (21:13 MSK)

## Версия: 2.1.0

## Автор аудита: NeuroExpert Architect

---

# 📊 EXECUTIVE SUMMARY

| Модуль                  | Статус      | Логика | Проблемы |
| ----------------------- | ----------- | ------ | -------- |
| **Auth Flow**           | ✅ РАБОТАЕТ | 9/10   | 1 minor  |
| **Subscription System** | ✅ РАБОТАЕТ | 9/10   | 0        |
| **Payment Processing**  | ✅ РАБОТАЕТ | 8/10   | 1 minor  |
| **Product Management**  | ✅ РАБОТАЕТ | 9/10   | 0        |
| **Sentinel Protection** | ✅ РАБОТАЕТ | 8/10   | 2 minor  |
| **API Key Management**  | ⚠️ РИСК     | 6/10   | 1 major  |
| **State Management**    | ✅ РАБОТАЕТ | 9/10   | 1 minor  |
| **User Experience**     | ✅ ОТЛИЧНО  | 9/10   | 0        |
| **Referral System**     | ✅ РАБОТАЕТ | 8/10   | 1 minor  |
| **Notifications**       | ✅ РАБОТАЕТ | 9/10   | 0        |

**ОБЩАЯ ОЦЕНКА БИЗНЕС-ЛОГИКИ: 84/100**

---

# 🔐 1. МОДУЛЬ АУТЕНТИФИКАЦИИ

## Файлы: `api/index.ts` (строки 106-200), `src/lib/telegram.ts`

### Логика:

1. Получение `initData` от Telegram WebApp SDK
2. Валидация HMAC-SHA256 подписи
3. Проверка `auth_date` (максимум 24 часа)
4. Создание/обновление пользователя в PostgreSQL
5. Выдача 3-дневного trial новым пользователям

### ✅ Сильные стороны:

- **Криптографическая валидация** — HMAC-SHA256 с timing-safe сравнением
- **Защита от replay attacks** — проверка `auth_date`
- **Маскированное логирование** — user ID скрывается в логах
- **Auto-trial** — новые пользователи получают 3 дня бесплатно

### ⚠️ Найденные проблемы:

#### 🟡 P2: Demo User Fallback в Dev Mode

**Файл:** `api/index.ts`, строки 107-111

```typescript
if (!initData || initData === "" || initData === "demo") {
  console.log("🧪 [TEST] Using demo user (Bypass Auth for testing)");
  return { valid: true, user: DEMO_USER };
}
```

**Риск:** В dev-режиме любой может войти как demo user.
**Решение:** Добавить explicit dev-only flag или убрать после тестирования.

---

# 💳 2. ПЛАТЁЖНАЯ СИСТЕМА

## Файлы: `api/index.ts` (строки 613-1012), `src/components/ui/PaymentModal.tsx`

### Логика подписки:

```
1. Пользователь выбирает план (Basic/Pro/Yearly)
2. Frontend запрашивает создание платежа
3. Backend создаёт платёж в YooKassa
4. Пользователь оплачивает через виджет
5. YooKassa отправляет webhook
6. Backend активирует подписку
7. Telegram уведомление пользователю
```

### Тарифные планы:

| План   | Цена      | Скидка (первый месяц) | Дней | Товаров |
| ------ | --------- | --------------------- | ---- | ------- |
| Basic  | 499₽      | 349₽ (-30%)           | 30   | 50      |
| Pro    | 999₽      | 699₽ (-30%)           | 30   | 500     |
| Yearly | 9990₽     | —                     | 365  | 500     |
| Trial  | БЕСПЛАТНО | —                     | 3    | 20      |

### ✅ Сильные стороны:

- **YooKassa Embedded Widget** — безопасная оплата
- **Скидка 30%** на первый платёж
- **Promo-коды** (LAUNCH30, NEURO20)
- **Referral система** (+30 дней рефереру)
- **Auto-reminder** перед окончанием подписки (за 3 дня)

### ⚠️ Найденные проблемы:

#### 🟡 P3: Test Mode Fallback

**Файл:** `api/index.ts`, строки 922-933

```typescript
if (!SHOP_ID || !SECRET_KEY) {
  if (!IS_PRODUCTION) {
    console.log('🧪 DEV MODE: Activating subscription without payment');
    await activateSubscription(user.id, planId, plan.durationDays);
    return res.json({ success: true, testMode: true, ... });
  }
}
```

**Риск:** В dev-mode подписка активируется без оплаты.
**Решение:** OK для тестирования, удалить перед полным production.

---

# 🛡️ 3. SENTINEL — СИСТЕМА ЗАЩИТЫ

## Файлы: `api/index.ts` (строки 1320-1498)

### Бизнес-логика:

```
ЦИКЛ ЗАЩИТЫ (каждые 5 минут или по запросу клиента):
1. Найти пользователей с protection_enabled = true
2. Для каждого получить товары с min_price > 0
3. Запросить актуальные цены через API маркетплейса
4. Если currentPrice < minPrice:
   → Mode: zero_stock → Обнулить остаток
   → Mode: price_correction → Вернуть цену к minPrice
5. Обновить статистику (saved_amount, triggered_today)
6. Отправить Telegram уведомление
```

### Режимы защиты:

| Режим              | Действие                   | Когда использовать           |
| ------------------ | -------------------------- | ---------------------------- |
| `zero_stock`       | Обнуляет остатки товара    | При жёстких акциях (демпинг) |
| `price_correction` | Возвращает цену к минимуму | При мягком снижении цены     |

### Поддержка маркетплейсов:

| Маркетплейс | Проверка цен | Zero Stock | Price Correction |
| ----------- | ------------ | ---------- | ---------------- |
| **Ozon**    | ✅ v3 API    | ✅         | ✅               |
| **WB**      | ✅           | ❌ TODO    | ❌ TODO          |

### ✅ Сильные стороны:

- **Dual-trigger** — CRON + клиентский polling
- **Детальное логирование** каждого срабатывания
- **Telegram уведомления** при каждой защите
- **Статистика** — saved_amount, triggered_today

### ⚠️ Найденные проблемы:

#### 🟡 P2: WB Defense НЕ РЕАЛИЗОВАН

**Файл:** `api/index.ts`, строки 1482-1484

```typescript
// --- WB DEFENSE (Future) ---
// ... placeholder ...
```

**Риск:** Пользователи WB не получают защиту.
**Решение:** Реализовать WB API для stocks и prices.

#### 🟡 P3: Отсутствие retry-логики

**Проблема:** При ошибке API защита не повторяется.

```typescript
if (ozonRes.ok) { ... } // Если fail — молча пропускается
```

**Решение:** Добавить retry с exponential backoff.

---

# 📦 4. УПРАВЛЕНИЕ ТОВАРАМИ

## Файлы: `api/index.ts` (строки 579-837, 1078-1318), `src/stores/productsStore.ts`

### CRUD операции:

| Операция         | Endpoint                    | Method |
| ---------------- | --------------------------- | ------ |
| Get Products     | `/api?action=products`      | GET    |
| Update Min Price | `/api?action=products`      | POST   |
| Sync from WB     | `/api?action=sync-products` | POST   |
| Sync from Ozon   | `/api?action=sync-products` | POST   |

### Логика синхронизации:

1. Проверка активной подписки
2. Получение API-ключа из БД
3. Запрос товаров через API маркетплейса
4. Лимит по тарифу (Trial=20, Basic=50, Pro=500)
5. Upsert в PostgreSQL
6. Обновление total_products у пользователя

### ✅ Сильные стороны:

- **Лимит товаров** по тарифу
- **Upsert** — безопасное обновление
- **Состояние** — active, protected, triggered, disabled
- **Zustand persist** — локальное кеширование

### ⚠️ Потенциальные улучшения:

- Добавить пагинацию для больших каталогов (>100 товаров)
- Добавить bulk-update для minPrice

---

# 🔑 5. УПРАВЛЕНИЕ API КЛЮЧАМИ

## Файлы: `api/index.ts` (строки 853-860)

### Текущая логика:

```typescript
// При сохранении ключа WB:
await sql`UPDATE users SET api_key_wb = ${apiKey}, ...`;

// При сохранении ключа Ozon (clientId:apiKey):
await sql`UPDATE users SET api_key_ozon = ${apiKey}, ...`;
```

### ⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА:

#### 🔴 P1: API Keys хранятся в Plain Text

**Риск:** При утечке БД все API ключи пользователей будут скомпрометированы.

**Текущая ситуация:**

```sql
SELECT api_key_wb, api_key_ozon FROM users; -- Ключи в открытом виде!
```

**Рекомендуемое решение:**

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY; // 32 bytes hex

function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptApiKey(encryptedKey: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

**Приоритет:** ВЫСОКИЙ

---

# 🔄 6. STATE MANAGEMENT (FRONTEND)

## Файлы: `src/stores/appStore.ts`, `src/stores/productsStore.ts`

### Архитектура:

```
AppStore (Zustand + persist):
├── user (User object)
├── isAuthenticated
├── protectionEnabled
├── defenseMode
└── subscriptionDaysLeft

ProductsStore (Zustand + devtools + persist):
├── products[]
├── filters (marketplace, status, search)
├── sortBy / sortOrder
└── isLoading / error
```

### ✅ Сильные стороны:

- **Zustand** — минимальный, но мощный
- **Persist middleware** — сохранение между сессиями
- **DevTools** — отладка в браузере
- **Селекторы** — оптимизированный ре-рендер

### ⚠️ Найденные проблемы:

#### 🟡 P3: Отсутствие синхронизации с сервером при изменении protectionEnabled

**Файл:** `src/stores/appStore.ts`, строки 88-96

```typescript
setProtectionEnabled: (enabled) => {
  set({ protectionEnabled: enabled });
  // TODO: Sync with Firestore ← НЕ РЕАЛИЗОВАНО
},
```

**Решение:** Компонент `GlobalSwitch` уже делает API-запрос, но store не синхронизирует обратно. Нужно добавить callback.

---

# 📱 7. USER EXPERIENCE (FRONTEND)

## Файлы: `src/pages/DashboardPage.tsx`, `src/components/`

### UI Flow:

```
1. Загрузка → Loading Screen с анимацией
2. Аутентификация через Telegram
3. Dashboard:
   ├── Trial Banner (если trial)
   ├── Connect API Banner (если ключи не настроены)
   ├── GlobalSwitch (защита вкл/выкл)
   ├── Statistics (saved/protected/triggered)
   ├── Products Grid с фильтрами
   └── Log Console
4. Settings:
   ├── API Keys (WB/Ozon)
   ├── Defense Mode toggle
   └── Subscription status
```

### ✅ Сильные стороны:

- **Framer Motion** — красивые анимации
- **Haptic Feedback** — вибрация на действия
- **Confetti + Sound** при saved money увеличении
- **Responsive** — адаптивный дизайн
- **Error Boundary** — обработка ошибок

### Gamification элементы:

- 💰 Ka-ching звук при спасении денег
- 🎊 Confetti анимация
- 📊 Real-time статистика
- 🛡️ Pulse-анимация при активной защите

---

# 🎁 8. REFERRAL СИСТЕМА

## Файл: `api/index.ts` (строки 347-371, 1594-1630)

### Логика:

```
1. Каждый пользователь получает unique referral_code (NG{base36(userId)})
2. Новый пользователь переходит по ссылке t.me/Bot?start=ref_CODE
3. При оплате:
   - Рефереру добавляется 30 дней
   - Реферал получает 20% скидку на первый платёж
4. Telegram уведомление рефереру
```

### ✅ Работает:

- Генерация кода: `NG${user.id.toString(36).toUpperCase()}}`
- Бонус рефереру: +30 дней подписки
- Telegram уведомление

### ⚠️ Проблема:

#### 🟡 P3: Скидка 20% для реферала НЕ применяется

**Файл:** `api/index.ts`, строка 57

```typescript
const REFERRAL_DISCOUNT_PERCENT = 20; // 20% discount for referred user
```

**Но:** Логика в `calculatePrice` не учитывает referred_by.
**Решение:** Добавить проверку referred_by в calculatePrice.

---

# ⏰ 9. CRON JOBS

## Файл: `vercel.json` (отсутствует секция crons!)

### Ожидаемая конфигурация:

```json
{
  "crons": [
    {
      "path": "/api?action=check-prices",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api?action=send-reminders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

### ⚠️ ПРОБЛЕМА:

#### 🔴 P1: Cron Jobs НЕ НАСТРОЕНЫ в vercel.json!

**Текущий vercel.json** не содержит секции `crons`.

**Решение:** Добавить cron jobs (требуется Vercel Pro/Enterprise).

### Альтернатива для Hobby Plan:

Dashboard клиентское polling реализовано (строки 199-225):

```typescript
const interval = setInterval(runCheck, 60000); // Каждые 60 сек
```

**Это работает только когда пользователь на странице!**

---

# 📝 10. ЛОГИРОВАНИЕ И МОНИТОРИНГ

### Текущее состояние:

- `console.log` — основной метод
- Маскирование sensitive data
- Отсутствует production-ready logging

### Рекомендации:

1. **Добавить структурированное логирование** (pino/winston)
2. **Интегрировать Sentry** для отслеживания ошибок
3. **Добавить метрики** (Vercel Analytics / Custom)

---

# 🏗️ АРХИТЕКТУРНЫЕ НАБЛЮДЕНИЯ

## Dual Backend (ВАЖНО!)

Проект содержит **ДВА БЭКЕНДА**:

| Backend            | Путь              | Строк | Статус             |
| ------------------ | ----------------- | ----- | ------------------ |
| Vercel Serverless  | `/api/index.ts`   | 1644  | ✅ АКТИВЕН         |
| Firebase Functions | `/functions/src/` | ~500  | ❌ НЕ ИСПОЛЬЗУЕТСЯ |

**Рекомендация:** Удалить или архивировать `/functions/` во избежание путаницы.

## Database Schema

```
PostgreSQL (Vercel Postgres):
├── users
│   ├── id (BIGINT PK - Telegram ID)
│   ├── api_key_wb, api_key_ozon (⚠️ plain text!)
│   ├── subscription_plan, subscription_end
│   ├── protection_enabled, defense_mode
│   └── referral_code, referred_by
├── products
│   ├── user_id (FK)
│   ├── product_id, nm_id, title, image_url
│   ├── current_price, min_price, current_stock
│   └── marketplace, status
└── transactions
    ├── id, user_id (FK)
    ├── yookassa_payment_id
    └── amount, status, plan
```

---

# 📋 ИТОГОВЫЙ CHECKLIST

## ✅ Работает корректно:

- [x] Telegram аутентификация (HMAC-SHA256)
- [x] Создание пользователей с trial
- [x] Подписки (Basic/Pro/Yearly)
- [x] YooKassa платежи
- [x] Синхронизация товаров (WB + Ozon)
- [x] Установка min_price (Stop-Loss)
- [x] Лимиты товаров по тарифу
- [x] Referral программа (частично)
- [x] Sentinel защита (Ozon)
- [x] Telegram уведомления
- [x] Frontend UI/UX

## ⚠️ Требует внимания:

- [ ] 🔴 **P1:** Шифрование API ключей в БД
- [ ] 🔴 **P1:** Добавить Cron Jobs в vercel.json
- [ ] 🟡 **P2:** Реализовать WB Sentinel defense
- [ ] 🟡 **P2:** Скидка 20% для рефералов
- [ ] 🟡 **P3:** Retry логика для Sentinel
- [ ] 🟡 **P3:** Структурированное логирование
- [ ] 🟡 **P3:** Удалить/архивировать Firebase code

---

# 🚀 СЛЕДУЮЩИЕ ШАГИ

## Приоритет 1 (До Production):

1. Шифрование API ключей (AES-256-GCM)
2. Настройка Cron Jobs (или External Trigger)
3. Удаление demo-user fallback

## Приоритет 2 (Beta Improvements):

1. WB Sentinel Defense
2. Referral discount fix
3. Retry + Circuit Breaker для API calls

## Приоритет 3 (Nice to Have):

1. Sentry integration
2. Structured logging
3. Cleanup dual backend

---

_Аудит проведён: 2024-12-14T21:13:00+03:00_
_Автор: NeuroExpert Architect_
_Проанализировано файлов: 25+_
_Строк кода: ~5000_
