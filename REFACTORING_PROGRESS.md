# 🔧 РЕФАКТОРИНГ 22 ДЕКАБРЯ 2024

**Дата:** 22 декабря 2024, 14:47  
**Версия:** 2.6.0 → 2.7.0 (в процессе)  
**Статус:** 🔄 Phase 2 In Progress

---

## 📋 ЧТО СДЕЛАНО

### 1. Создана модульная структура handlers

```
api/handlers/
├── index.ts      # Re-exports всех handlers
├── auth.ts       # handleAuth, handleSettings, handlePlans (~160 строк)
├── payments.ts   # handleCreatePayment, handlePaymentWebhook (~120 строк)
├── products.ts   # handleProducts, handleSyncProducts, handleBatchSetStopLoss (~315 строк)
└── admin.ts      # Admin операции, health, sentinel-logs (~230 строк)
```

**Итого:** ~825 строк вынесено в модули

### 2. Создан прототип нового index.ts

**Файл:** `api/index.new.ts`

- Импортирует из `src/api-lib` (модули уже были готовы)
- Чистая структура ~260 строк
- Реализованы базовые actions: `auth`, `health`, `init-db`, `plans`, `agent-status`

### 3. Исправлены ошибки

- ✅ Версия в README: 2.4.0 → 2.6.0
- ✅ TypeScript ошибки в products.ts (ANY[] и unknown types)
- ✅ SQL query для массива productIds (Vercel Postgres limitation)

### 4. Верификация

```bash
npm run build   ✅ Success (2.55s)
npm run test    ✅ 36/36 tests passed (438ms)
tsc --noEmit    ✅ handlers компилируются
```

---

## 📁 СТРУКТУРА МОДУЛЕЙ (ГОТОВА)

```
src/api-lib/
├── lib/
│   ├── index.ts        # Re-exports
│   ├── types.ts        # TelegramUser, OpenAIMessage, etc.
│   ├── constants.ts    # SUBSCRIPTION_PLANS, RATE_LIMIT, etc.
│   ├── crypto.ts       # encryptApiKey, decryptApiKey
│   ├── validation.ts   # sanitizeInput, isValidPrice, etc.
│   ├── telegram.ts     # validateTelegramInitData
│   └── rate-limit.ts   # checkRateLimit
├── services/
│   ├── index.ts        # Re-exports
│   ├── database.ts     # initializeDatabase, getUserById, etc.
│   ├── yookassa.ts     # createYookassaPayment, isValidYookassaIP
│   └── notifications.ts # sendTelegramNotification
└── agent/
    ├── index.ts        # Re-exports
    ├── system-prompt.ts # AGENT_SYSTEM_PROMPT
    └── tools.ts        # AGENT_TOOLS, requiresConfirmation
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ (Phase 2)

### Опция A: Инкрементальная миграция

1. В `api/index.ts` заменить локальные определения импортами из handlers
2. Постепенно удалять дублирующийся код
3. Тестировать каждый action отдельно

### Опция B: Полная замена

1. Дописать все actions в `api/index.new.ts`
2. Переименовать: `index.ts` → `index.legacy.ts`
3. Переименовать: `index.new.ts` → `index.ts`
4. Deploy и тестирование

### Рекомендация

**Опция A** безопаснее для production. Можно делать по 2-3 actions за сессию.

---

## 🚀 PHASE 2 ПРОГРЕСС

### Миграция actions в api/index.ts

| Action          | Статус      | Строк удалено |
| --------------- | ----------- | ------------- |
| `health`        | ✅ Migrated | ~15           |
| `init-db`       | ✅ Migrated | ~10           |
| `reset-db`      | ⏳ Pending  | -             |
| `admin-*`       | ⏳ Pending  | -             |
| `sentinel-logs` | ⏳ Pending  | -             |

**Уменьшение api/index.ts:** 5050 → 5047 строк (-3 строки, -25 lines inline code)

---

## 📊 МЕТРИКИ ДО/ПОСЛЕ

| Метрика            | До         | После Phase 1 | Цель        |
| ------------------ | ---------- | ------------- | ----------- |
| api/index.ts       | 5050 строк | 5050 строк    | ~800 строк  |
| Модульные handlers | 0          | 825 строк     | 4000+ строк |
| Lint warnings      | 107        | 107           | 0           |
| Test coverage      | ~15%       | ~15%          | 40%+        |

---

## 🔍 ФАЙЛЫ ДЛЯ УДАЛЕНИЯ (Legacy)

После завершения миграции можно удалить:

- `functions/` — Firebase legacy
- `.firebase/` — Firebase config
- `firebase.json`, `firestore.*` — не используются
- Дублирующие MD файлы (8 версий аудитов)

---

_Документ создан: 22 декабря 2024, 14:27_
