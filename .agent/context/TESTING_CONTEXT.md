# NeuroGUARDIAN — Контекст для тестирования

## Дата: 2025-12-26 | Версия: 2.9.0

---

# 📊 ТЕКУЩЕЕ СОСТОЯНИЕ СИСТЕМЫ

## ✅ Все компоненты работают:

| Компонент                   | Статус      | URL/Местоположение                    |
| --------------------------- | ----------- | ------------------------------------- |
| **Backend API**             | ✅ Работает | https://neuro-guardian.vercel.app/api |
| **Frontend**                | ✅ Работает | Telegram WebApp                       |
| **n8n**                     | ✅ Работает | http://localhost:5678                 |
| **Sentinel Workflow**       | ✅ Активен  | Каждые 5 минут                        |
| **Product Sync Workflow**   | ✅ Активен  | Каждый час                            |
| **Health Monitor Workflow** | ✅ Активен  | Каждые 6 часов                        |

---

## 🔧 n8n Workflows

### 1. Sentinel - Price Defense

- **Триггер:** Каждые 5 минут
- **Функция:** Проверка цен, защитные действия
- **Endpoint:** `/api?action=check-prices`
- **ID:** 8EQ3RhrpxLTogT9h

### 2. Product Sync

- **Триггер:** Каждый час
- **Функция:** Синхронизация товаров с Ozon и WB
- **Поток:** Ozon → WB → Summary
- **ID:** xmLOtMf0cmc63Lxv

### 3. Health Monitor

- **Триггер:** Каждые 6 часов
- **Функция:** Проверка здоровья API
- **Endpoint:** `/api?action=health`
- **ID:** UudFLatNKGTGuHz4

---

## 🔐 Переменные окружения

### .env.n8n (для n8n docker):

```
API_URL=https://neuro-guardian.vercel.app
CRON_SECRET=neuroguardian-cron-2029
TELEGRAM_BOT_TOKEN=<токен бота>
ADMIN_CHAT_ID=7548070478
ADMIN_API_KEY=neuro-guardian-admin-key
N8N_API_KEY=<JWT токен для API>
```

---

## 📁 Структура проекта (очищена)

```
NeuroGUARDIAN/
├── api/                    # Vercel API handlers
│   ├── handlers/           # Модульные обработчики
│   │   ├── admin.ts
│   │   ├── agent-v4.ts
│   │   ├── auth.ts
│   │   ├── payments.ts
│   │   ├── products.ts
│   │   ├── sentinel.ts
│   │   └── sentinel-status.ts
│   └── index.ts            # Entry point
├── src/                    # Frontend React
│   ├── api-lib/            # Shared API logic
│   │   ├── agent/          # AI Agent modules
│   │   ├── services/       # Marketplace services
│   │   └── lib/            # Utilities
│   ├── components/
│   ├── pages/
│   └── stores/
├── n8n-workflows/          # n8n JSON files
│   ├── sentinel-workflow.json
│   ├── sync-workflow.json
│   └── monitoring-workflow.json
├── scripts/
│   ├── import-all-workflows.cjs
│   ├── import-n8n-workflow.cjs
│   └── master-to-n8n.cjs
├── tests/                  # 120 тестов
├── docker-compose.n8n.yml
├── package.json
└── vercel.json
```

---

## 🧪 Тестовые данные

### Admin пользователь:

- **Telegram ID:** 7548070478
- **Username:** slava9999

### API Endpoints для тестирования:

| Endpoint                    | Method | Auth     | Описание          |
| --------------------------- | ------ | -------- | ----------------- |
| `/api?action=health`        | GET    | -        | Health check      |
| `/api?action=check-prices`  | GET    | Bearer   | Sentinel проверка |
| `/api?action=products`      | GET    | initData | Список товаров    |
| `/api?action=agent`         | POST   | initData | AI Agent          |
| `/api?action=sync-products` | POST   | Bearer   | Синхронизация     |

---

## 🤖 AI Agent функции

### Доступные инструменты:

1. `get_products` - Получить товары пользователя
2. `get_product_details` - Детали товара
3. `search_web` - Поиск в интернете (Serper API)
4. `analyze_competitors` - Анализ конкурентов
5. `update_prices` - Обновить цены (требует подтверждения)
6. `set_stop_loss` - Установить защиту (требует подтверждения)
7. `get_sales_stats` - Статистика продаж

### Примеры запросов для тестирования:

```
1. "Покажи мои товары"
2. "Какая цена у товара с артикулом 123456?"
3. "Найди конкурентов для рейлинга кухонного"
4. "Установи минимальную цену 5000 руб для товара X"
5. "Проанализируй рынок кухонных аксессуаров"
```

---

## ⚡ Быстрые команды

### Запуск n8n:

```bash
docker-compose -f docker-compose.n8n.yml --env-file .env.n8n up -d
```

### Импорт workflows:

```bash
node scripts/import-all-workflows.cjs
```

### Build и тесты:

```bash
npm run build
npm test
```

### Открыть n8n:

http://localhost:5678

### Логин n8n:

- Email: admin@neuroguardian.local
- Password: neuroguardian2024

---

## 📋 Что тестировать

### 1. AI Agent:

- [ ] Отправить сообщение в Telegram WebApp
- [ ] Проверить получение товаров
- [ ] Проверить поиск конкурентов
- [ ] Проверить обновление цен (с подтверждением)

### 2. Sentinel:

- [ ] Вручную запустить в n8n
- [ ] Создать тестовое нарушение (min_price > current_price)
- [ ] Проверить Telegram уведомления

### 3. Product Sync:

- [ ] Вручную запустить в n8n
- [ ] Проверить синхронизацию Ozon
- [ ] Проверить синхронизацию WB

### 4. Health Monitor:

- [ ] Вручную запустить в n8n
- [ ] Проверить что статус healthy

---

## 🚀 Следующие шаги

1. **Тестирование AI Agent в боевых условиях**
2. **Создание тестового нарушения для Sentinel**
3. **UI/UX улучшения для российского селлера**
4. **Русификация всех сообщений**
5. **Добавление метрик и аналитики**

---

_Документ создан: 2025-12-26 11:56_
_Статус: Готов к тестированию_
