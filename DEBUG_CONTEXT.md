# 📋 NeuroGUARDIAN — Контекст для нового диалога

**Дата:** 14 декабря 2024
**Состояние:** Требуется отладка

---

## 🎯 ТЕКУЩАЯ ПРОБЛЕМА

Приложение работает через API (терминал), но **НЕ работает через UI в браузере/Telegram**:

### ✅ Что работает (через терминал):

```
- Auth: success=True, user=demo_user, subscriptionActive=True
- Save API key: success=True
- Sync products: success=True (но 0 товаров — нужно проверить формат v3)
```

### ❌ Что НЕ работает (в браузере):

- Подписка показывает "не активна"
- Кнопка сохранения API ключа не работает
- Кнопка синхронизации не появляется

---

## 🔍 КЛЮЧЕВЫЕ ФАЙЛЫ

### Backend: `api/index.ts`

- Unified Vercel Serverless Function
- Все endpoints через `?action=xxx`
- Demo user для тестирования (id=123456789)

### Frontend: `src/App.tsx`

- Всегда вызывает API для auth
- Использует zustand store для user state

### Frontend: `src/pages/SettingsPage.tsx`

- API key модалка
- Sync products кнопки

### Frontend: `src/lib/api.ts`

- Axios client
- settingsApi.saveApiKey()
- productsApi.syncProducts()

---

## 🐛 ВОЗМОЖНЫЕ ПРИЧИНЫ

1. **Frontend получает user из API, но state не обновляется правильно**

   - `setUser()` может не учитывать все поля

2. **subscriptionActive парсится неправильно**

   - API возвращает true, но frontend видит false

3. **user.ozonKeyRef не обновляется после сохранения ключа**

   - Нужен refresh после save

4. **Ozon API v3 формат отличается от v2**
   - `last_id` вместо `filter.visibility`

---

## 🔧 НУЖНО СДЕЛАТЬ

### 1. Проверить что frontend ПОЛУЧАЕТ от API:

```javascript
// В App.tsx после authApi.login():
console.log("RAW API response:", JSON.stringify(response));
```

### 2. Проверить что store СОХРАНЯЕТ:

```javascript
// В appStore.ts setUser():
console.log("Setting user:", JSON.stringify(user));
```

### 3. Исправить Ozon v3 формат:

```javascript
// Новый формат запроса:
body: JSON.stringify({
  filter: { visibility: "ALL" },
  last_id: "",
  limit: 100,
});
```

### 4. Добавить auto-refresh после save API key

---

## 📡 КОНФИГУРАЦИЯ

### Vercel:

- Project: neuro-guardian
- URL: https://neuro-guardian.vercel.app
- Region: default

### Environment Variables (Vercel):

- POSTGRES_URL: ✅ configured
- YOOKASSA_SHOP_ID: ❌ not set (TEST MODE)
- ADMIN_API_KEY: ✅ configured

### База данных:

- Neon Postgres через Vercel
- Таблицы: users, products, transactions

---

## 🧪 ТЕСТИРОВАНИЕ

### Терминал (PowerShell):

```powershell
# Auth
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api?action=auth" -Method POST -ContentType "application/json" -Body '{}'

# Save Ozon key
$body = @{action="settings"; marketplace="Ozon"; apiKey="CLIENT_ID:API_KEY"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api" -Method POST -ContentType "application/json" -Body $body

# Sync products
$body = @{action="sync-products"; marketplace="Ozon"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api" -Method POST -ContentType "application/json" -Body $body
```

### Браузер:

```
https://neuro-guardian.vercel.app
```

---

## 📁 КЛЮЧЕВЫЕ ПУТИ

```
c:\NeuroGUARDIAN\
├── api\
│   └── index.ts           # Backend API
├── src\
│   ├── App.tsx            # Main app + routing
│   ├── lib\
│   │   ├── api.ts         # API client
│   │   └── telegram.ts    # Telegram SDK
│   ├── stores\
│   │   └── appStore.ts    # Zustand user store
│   └── pages\
│       ├── DashboardPage.tsx
│       └── SettingsPage.tsx
├── vercel.json            # Vercel config
└── package.json
```

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Добавить console.log в frontend** чтобы видеть что получает от API
2. **Проверить subscriptionActive** — почему frontend видит false
3. **Исправить Ozon v3** — добавить last_id в запрос
4. **Добавить auto-reload** после save API key
5. **Тестировать в браузере с DevTools открытым**

---

## 📱 OZON CREDENTIALS

- Client ID: 2820442
- API Key: 7bc0e79f-dc16-471e-a2eb-0b... (hidden)
- Товаров: 11 активных

---

**ВАЖНО:** API работает корректно! Проблема в frontend — state не синхронизируется с данными от API.
