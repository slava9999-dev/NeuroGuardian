# 🔴 КРИТИЧЕСКИЙ АУДИТ NeuroGUARDIAN

**Дата:** 2026-01-04  
**Аудитор:** Claude AI (Antigravity)  
**Версия проекта:** 2.12.0  
**Статус:** ⚠️ НЕ ГОТОВ К PRODUCTION (вопреки ранее заявленному)

---

## 📊 СВОДКА РЕЗУЛЬТАТОВ

| Категория           | Статус | Критичность  | Количество проблем         |
| ------------------- | ------ | ------------ | -------------------------- |
| **TypeScript/Lint** | ⚠️     | Medium       | 2 errors, **145 warnings** |
| **Безопасность**    | 🔴     | **CRITICAL** | 5 критических уязвимостей  |
| **npm Audit**       | ⚠️     | Medium       | 5 moderate vulnerabilities |
| **Тесты**           | ✅     | OK           | 282 passed, 6 skipped      |
| **Архитектура**     | ⚠️     | Medium       | Технический долг           |
| **Документация**    | ⚠️     | Low          | Неполная                   |

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (P0 - БЛОКИРУЮТ PRODUCTION)

### 1. 🔴 `verifyWebhookSignature` НЕ РЕАЛИЗОВАНА

**Файл:** `src/api-lib/services/yookassa-service.ts:140-144`

```typescript
verifyWebhookSignature(_body: string, _signature: string): boolean {
  // TODO: Implement signature verification
  // For now, return true (will implement after getting webhook secret)
  return true;  // ⚠️ ВСЕГДА ВОЗВРАЩАЕТ TRUE!
}
```

**Риск:** КРИТИЧЕСКИЙ  
**Последствия:**

- Любой злоумышленник может отправить фейковый webhook
- Можно активировать подписки БЕЗ оплаты
- Полное отсутствие защиты от подделки платежей

**Рекомендация:** Немедленно реализовать проверку подписи YooKassa перед принятием первого реального платежа.

---

### 2. 🔴 СИМВОЛЫ `\r\n` В СЕКРЕТАХ `.env.production`

**Файл:** `.env.production`

```
ADMIN_API_KEY="VhDeoXcrFiab8dREpvu4xlfqPBJMN7IC\r\n"
CRON_SECRET="phIc1exX5YF08r9Cmg4blaLoSGP2wEOt\r\n"
```

**Риск:** HIGH  
**Последствия:**

- Ключи могут не сравниваться корректно
- Авторизация может случайно работать/не работать
- Непредсказуемое поведение при деплое

**Рекомендация:** Удалить `\r\n` из всех значений в production env файлах.

---

### 3. 🔴 VERCEL CRON: `/api/cron/send-daily-report` НЕ СУЩЕСТВУЕТ КАК ENDPOINT

**Файл:** `vercel.json:8-10`

```json
{
  "path": "/api/cron/send-daily-report",
  "schedule": "0 5 * * *"
}
```

**Проблема:** Файл `api/cron/send-daily-report.ts` существует, но он НЕ зарегистрирован в main API router (`api/index.ts`). Vercel будет вызывать URL, но получит 400 (Unknown action).

**Риск:** HIGH  
**Последствия:**

- Daily reports никому не отправляются
- Пользователи не получают утренние дайджесты
- Функция монетизации не работает

**Рекомендация:** Зарегистрировать endpoint `send-daily-report` в `api/index.ts`.

---

### 4. 🔴 МАССОВОЕ ИСПОЛЬЗОВАНИЕ `any` ТИП (50+ мест)

**Файлы с наибольшим количеством `any`:**

- `src/api-lib/handlers/products.ts` — 7 instances
- `src/api-lib/handlers/sentinel.ts` — 7 instances
- `src/api-lib/handlers/n8n-webhooks.ts` — 3 instances
- `src/api-lib/agent/tool-executors.ts` — 3 instances
- `src/pages/OpsPanelPage.tsx` — 7 instances

**Риск:** MEDIUM-HIGH  
**Последствия:**

- Runtime errors не ловятся на этапе компиляции
- Типобезопасность теряется в критических местах
- Рефакторинг становится опасным

**Рекомендация:** Заменить `any` на конкретные типы в критических путях (платежи, sentinel, auth).

---

### 5. 🔴 IP WHITELIST ДЛЯ YOOKASSA МОЖЕТ БЛОКИРОВАТЬ ЛЕГИТИМНЫЕ ЗАПРОСЫ

**Файл:** `src/api-lib/handlers/payments.ts:118-145`

```typescript
const isYookassaIp = (ip: string) => {
  if (ip === '77.75.156.11' || ip === '77.75.156.35') return true;
  if (ip.startsWith('2a02:5180:')) return true; // IPv6 check
  // ...
};

if (IS_PRODUCTION && !isYookassaIp(clientIP) && clientIP !== 'unknown') {
  console.error(`🚫 BLOCKED: Webhook from unauthorized IP: ${clientIP}`);
  return res.status(403).json({ error: 'Forbidden: Invalid source IP' });
}
```

**Проблема:**

- Список IP может быть неполным
- YooKassa может добавить новые IP
- `clientIP !== 'unknown'` — если unknown, пропускаем! Потенциальная дыра.

**Рекомендация:**

1. Реализовать `verifyWebhookSignature` (приоритетнее IP whitelist)
2. Проверить актуальность IP-адресов YooKassa

---

## ⚠️ ВАЖНЫЕ ПРОБЛЕМЫ (P1)

### 6. npm Audit: 5 Moderate Vulnerabilities

```
esbuild  <=0.24.2 — Moderate severity
vite — depends on vulnerable versions of esbuild
vitest — depends on vulnerable versions of vite-node
```

**Рекомендация:** `npm audit fix` или обновить зависимости.

---

### 7. ESLint: 2 Errors, 145 Warnings

**Errors:**

- Rule `@typescript-eslint/no-explicit-any` definition not found (config issue)
- Unused variables

**Warnings:** Массово `@typescript-eslint/no-unused-vars` и `@typescript-eslint/no-explicit-any`

**Рекомендация:** Исправить конфигурацию ESLint и пройтись по warnings.

---

### 8. Debug Logs в Production Коде

**Файл:** `src/api-lib/services/sentinel-service.ts`

```typescript
console.warn(`[DEBUG] processUser called for user ${user.id}`);
console.error(`[DEBUG] Ozon Prices fetched: size=${priceMap.size}`);
console.warn(`[DEBUG] handleMarketplaceThreats for ${products.length} products`);
```

**Риск:** LOW-MEDIUM  
**Последствия:**

- Засорение логов в production
- Potential data leak (user IDs в логах)

**Рекомендация:** Использовать `logger.debug()` с условием на environment.

---

### 9. Отсутствие Rate Limiting на Payment Webhook

**Файл:** `api/index.ts:267-268`

```typescript
case 'payment-webhook':
  return handlePaymentWebhook(req, res);
```

Payment webhook обходит rate limiting (не проходит через `applyRateLimit`).

**Рекомендация:** Добавить специальный rate limit для webhooks (хотя они уже от YooKassa).

---

### 10. constants.ts Содержит Устаревшие Цены

**Файл:** `src/api-lib/lib/constants.ts:12-59`

```typescript
export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  basic: {
    price: 499, // <-- отличается от
    discountedPrice: 349,
  },
  // ...
};
```

Но в `yookassa-service.ts:150-155`:

```typescript
const prices = {
  basic: { monthly: 999, yearly: 9990 }, // 999, не 499!
  pro: { monthly: 2999, yearly: 29990 },
  business: { monthly: 9999, yearly: 99990 },
};
```

**Риск:** MEDIUM  
**Последствия:** Путаница в ценах, несоответствие между UI и backend.

---

## 📋 ТЕХНИЧЕСКИЙ ДОЛГ

| Проблема                                      | Файлы                        | Оценка времени |
| --------------------------------------------- | ---------------------------- | -------------- |
| Заменить `any` на типы                        | 15+ файлов                   | 4-6 часов      |
| Убрать debug console.log/warn                 | sentinel-service.ts, auth.ts | 1 час          |
| Синхронизировать цены (constants vs yookassa) | 2 файла                      | 30 минут       |
| Зарегистрировать daily-report endpoint        | api/index.ts                 | 15 минут       |
| Исправить ESLint config                       | eslint.config.js             | 30 минут       |
| Update npm dependencies                       | package.json                 | 1 час          |

---

## ✅ ЧТО РАБОТАЕТ ХОРОШО

1. **Тесты:** 282 теста проходят (27 файлов)
2. **TypeScript:** Компилируется без критических ошибок
3. **Архитектура:** Разумное разделение handlers/services/agent
4. **Auth Middleware:** Хорошая система авторизации (Telegram + Admin + Cron)
5. **Sentinel Logic:** Логика защиты цен реализована
6. **AI Agent:** 17 tools, orchestrator работает
7. **Telegram Bot:** Полноценный webhook handler

---

## 🎯 ПРИОРИТЕТЫ ИСПРАВЛЕНИЯ

### ✅ ИСПРАВЛЕНО (2026-01-04):

1. ✅ **YooKassa Webhook Security** — Добавлена проверка платежа через API `getPayment()` перед активацией подписки
2. ✅ **Daily Report CRON** — Зарегистрирован `send-daily-report` action в API router + изменён путь в vercel.json
3. ✅ **`.env.production` secrets** — Удалены `\r\n` из ADMIN_API_KEY, CRON_SECRET, POSTGRES_URL, TELEGRAM_BOT_TOKEN
4. ✅ **Debug logs** — Заменены `console.warn/error` на `logger.debug()` в sentinel-service.ts
5. ✅ **Синхронизация цен** — constants.ts обновлён до актуальных цен (basic=999₽, pro=2999₽)

### На этой неделе:

4. Заменить `any` в payments.ts и sentinel.ts
5. npm audit fix
6. Исправить ESLint config

### В ближайший месяц:

7. Полный рефакторинг типов (50+ any)
8. Добавить интеграционные тесты для YooKassa webhook
9. Улучшить документацию

---

## 💡 ЗАКЛЮЧЕНИЕ

> **PROJECT_STATE.md заявляет: "🟢 PRODUCTION READY"**
>
> **Реальность: ⚠️ NOT PRODUCTION READY**

Проект содержит **критическую уязвимость в платёжной системе** — webhook signature verification не реализована. Это означает, что **любой может подделать платёж и получить подписку бесплатно**.

До исправления этой проблемы проект **НЕ ГОТОВ** к приёму реальных платежей.

---

_Аудит проведён 2026-01-04. Следующий аудит рекомендуется после исправления P0 проблем._
