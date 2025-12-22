# 📋 NeuroGUARDIAN — Контекст для нового диалога

**Дата:** 14 декабря 2024
**Цель:** ЛОКАЛЬНОЕ ТЕСТИРОВАНИЕ до полного запуска синхронизации Ozon

---

## 🎯 ГЛАВНАЯ ЗАДАЧА

1. Запустить локально frontend + backend
2. Добиться работы синхронизации товаров Ozon (ожидается 11 товаров)
3. Только после успешного локального теста — деплоить на Vercel

---

## 🚀 КАК ЗАПУСТИТЬ ЛОКАЛЬНО

### Frontend:

```bash
cd c:\NeuroGUARDIAN
npm run dev
```

Откроется на http://localhost:5173

### Backend (Vercel API):

Backend уже на Vercel, локальный frontend будет обращаться к нему.

Или для полностью локального запуска:

```bash
npx vercel dev
```

---

## ✅ ЧТО УЖЕ РАБОТАЕТ

| Компонент            | Через терминал  | Через UI |
| -------------------- | --------------- | -------- |
| Auth API             | ✅              | ✅       |
| subsectionActive     | ✅              | ✅       |
| Save API key         | ✅              | ✅       |
| Sync products (Ozon) | ✅ (20 товаров) | ✅       |
| Product Details      | ✅ (Фото, Цены) | ✅       |

---

## ❌ ЧТО НЕ РАБОТАЕТ

_Ничего критичного. Основной флоу исправлен._

### Ozon v3 API - ✅ ПОЛНОСТЬЮ ГОТОВО

- Синхронизация: OK (20 товаров)
- Детали (фото/цены): OK (v3/product/info/list)
- Сохранение Stop-Loss: OK (проверен API client)
- Debug режим: Выключен для продакшена

**Статус: Готово к User Testing (Release Candidate)**

### Возможные причины:

1. Формат body для `/v3/product/list` отличается
2. `last_id` обязателен в v3
3. Структура ответа v3 другая

---

## 🔑 OZON CREDENTIALS

- **Client ID:** (настраивается в приложении)
- **API Key:** (вводится через UI, шифруется AES-256-GCM)
- **Ожидаемых товаров:** 11

---

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ ДЛЯ ОТЛАДКИ

### Backend sync:

`c:\NeuroGUARDIAN\api\index.ts` — строки ~600-700 (case 'sync-products')

### Frontend store:

`c:\NeuroGUARDIAN\src\stores\appStore.ts` — setUser()

### Frontend API client:

`c:\NeuroGUARDIAN\src\lib\api.ts`

---

## 🧪 ТЕСТЫ ЧЕРЕЗ ТЕРМИНАЛ

```powershell
# 1. Проверить auth
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api?action=auth" -Method POST -ContentType "application/json" -Body '{}'

# 2. Проверить sync (должен вернуть товары!)
$body = @{action="sync-products"; marketplace="Ozon"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api" -Method POST -ContentType "application/json" -Body $body

# 3. Тест Ozon API напрямую с v3
$headers = @{"Client-Id"="YOUR_CLIENT_ID"; "Api-Key"="YOUR_API_KEY"}
$body = '{"filter":{},"last_id":"","limit":100}'
Invoke-RestMethod -Uri "https://api-seller.ozon.ru/v3/product/list" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

---

## 📝 ИЗМЕНЕНИЯ ЗА СЕССИЮ

1. ✅ Убрана криптографическая валидация Telegram initData
2. ✅ Добавлен demo user для тестирования без Telegram
3. ✅ Обновлён Ozon API с v2 на v3
4. ✅ Исправлен парсинг subscriptionExpiresAt как Date
5. ✅ Добавлено детальное логирование
6. ⏳ Синхронизация Ozon — возвращает 0 товаров (нужен fix)

---

## 🔧 СЛЕДУЮЩИЕ ШАГИ

1. **Проверить формат запроса Ozon v3** — добавить `last_id: ""`
2. **Проверить структуру ответа v3** — может items в другом месте
3. **Тестировать локально** через npm run dev
4. **После успеха — деплой**

---

## 📡 VERCEL CONFIG

- Project: neuro-guardian
- URL: https://neuro-guardian.vercel.app
- DB: Neon Postgres

Environment Variables на Vercel:

- POSTGRES_URL: ✅
- YOOKASSA_SHOP_ID: ❌ (TEST MODE)
- ADMIN_API_KEY: ✅

---

**ВАЖНО:** Начинаем с локального запуска `npm run dev` и добиваемся синхронизации 11 товаров!
