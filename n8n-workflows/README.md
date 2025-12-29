# 🔄 n8n Workflows - Viktor Margin v3.0

**Дата:** 2025-12-29  
**Статус:** Production Ready

---

## 📊 ОБЗОР WORKFLOWS

### Существующие (6):

1. **sentinel-workflow.json** ✅ ОБНОВЛЁН
   - Каждые 5 минут
   - Проверка цен WB/Ozon
   - Автоматическая защита (zero_stock/price_fix)
   - **НОВОЕ:** Viktor Margin alert format
   - **НОВОЕ:** Детальный breakdown маржи
   - **НОВОЕ:** Годовой impact calculation

2. **unit-economics-monitor-workflow.json** ✨ НОВЫЙ
   - Каждый час
   - Расчёт Unit Economics для всех товаров
   - Обнаружение warnings (Ozon Card, Storage, Returns)
   - Severity routing (Critical → Immediate, Warning → Digest)
   - Telegram alerts в Viktor Margin стиле

3. **monitoring-workflow.json**
   - System health monitoring
   - API status checks

4. **sync-workflow.json**
   - Product synchronization
   - WB/Ozon data sync

5. **notifications-workflow.json**
   - Telegram alert system
   - Email notifications

6. **analytics-workflow.json**
   - Daily statistics
   - Performance metrics

7. **agent-dashboard-workflow.json**
   - AI agent monitoring
   - Conversation analytics

---

## 🚀 QUICK START

### 1. Import Workflows в n8n

```bash
# Откройте n8n
http://localhost:5678

# Для каждого workflow:
# 1. Workflows → Import from File
# 2. Выберите .json файл
# 3. Activate workflow
```

### 2. Настройте Environment Variables

В n8n Settings → Environment Variables:

```env
API_URL=https://your-api.vercel.app/api
CRON_SECRET=your-cron-secret
TELEGRAM_BOT_TOKEN=your-bot-token
ADMIN_CHAT_ID=your-telegram-id
```

### 3. Тест Workflows

**Sentinel (Price Defense):**

```bash
# Manual trigger
Workflows → Sentinel → Execute Workflow
# Проверьте Telegram alert
```

**Unit Economics Monitor:**

```bash
# Manual trigger
Workflows → Unit Economics Monitor → Execute Workflow
# Проверьте Telegram digest
```

---

## 📋 ДЕТАЛИ WORKFLOWS

### 1. Sentinel - Price Defense

**Trigger:** Every 5 minutes

**Flow:**

1. Configuration → Load env vars
2. Check Prices API → Get violations
3. Has Violations? → Filter
4. Rate Limit Check → Max 100 per run
5. Split Violations → Process each
6. Validate Required Fields
7. Defense Action Router:
   - WB Zero Stock
   - WB Price Fix
   - Ozon Zero Stock
   - Ozon Price Fix
8. **Build Summary Message** (Viktor Margin format)
9. Send Telegram Alert
10. Bulk Log Results

**Viktor Margin Features:**

- ✅ Детальный breakdown каждого товара
- ✅ Конкретные цифры (detected price, min price, saved amount)
- ✅ Годовой impact (на 1000 заказов)
- ✅ Threat severity indicators
- ✅ Брендинг Viktor Margin

**Example Alert:**

```
🛡️ VIKTOR MARGIN: Защита сработала!

📊 СТАТИСТИКА:
✅ Защищено: 2
📦 Всего обработано: 2

━━━━━━━━━━━━━━━━━━━━
ЗАЩИЩЁННЫЕ ТОВАРЫ:

🟣 Футболка мужская хлопок
├─ Обнаружена цена: 850₽
├─ Лимит (Stop-Loss): 950₽
├─ Падение: 10.5%
├─ Сохранено: 100₽ на заказ
├─ Годовой impact: 100,000₽ (на 1000 заказов)
└─ 🛡️ Цена возвращена к 950₽

━━━━━━━━━━━━━━━━━━━━
💡 Viktor Margin
_Защита вашей маржи 24/7_
```

---

### 2. Unit Economics Monitor (NEW)

**Trigger:** Every hour

**Flow:**

1. Configuration → Load env vars
2. Get All Products → Fetch from API
3. Split Products → Process each
4. **Calculate Unit Economics** → Full breakdown
   - Ozon Card impact
   - Storage costs
   - Return costs
   - All commissions
5. Merge Product Data
6. Has Warnings? → Filter
7. Severity Router:
   - **Critical** → Immediate Telegram alert
   - **Warning** → Aggregate for digest
   - **Info** → Log only
8. Send Alerts

**Critical Alert Example:**

```
🚨 КРИТИЧЕСКАЯ УГРОЗА МАРЖИ!

🔵 Кроссовки спортивные
Ozon

📊 UNIT ECONOMICS:
├─ Цена: 2000₽
├─ Себестоимость: 1200₽
├─ Комиссия: 240₽ (12.0%)
├─ Логистика: 46₽
├─ Ozon Card: 40₽
└─ ПРИБЫЛЬ: 474₽ (23.7%)

⚠️ РИСКИ:
🚨 Скидка Ozon Card съедает 40₽ (2.0%) с каждого заказа! При 1000 заказов в год вы теряете 40,000₽ маржи. Учтите это при ценообразовании!

💡 Viktor Margin
_Срочно требуется действие!_
```

**Warning Digest Example:**

```
📊 VIKTOR MARGIN: Hourly Report

⚠️ Обнаружено 5 товаров с предупреждениями

*Типы предупреждений:*
  • Ozon Card: 3
  • Долгое хранение: 2

💡 Viktor Margin
_Проверьте детали в dashboard_
```

---

## 🔧 ОБНОВЛЕНИЕ WORKFLOWS

### Обновить Sentinel на Viktor Margin формат:

См. `UPDATE_SENTINEL_INSTRUCTIONS.md`

**Краткая версия:**

1. Откройте workflow в n8n
2. Найдите node "Build Summary Message"
3. Замените код на `viktor-margin-alert-builder.js`
4. Save & Test

---

## 📊 МОНИТОРИНГ

### Проверка статуса workflows:

```bash
# В n8n UI
Workflows → Status column

# Должны быть Active:
✅ Sentinel - Price Defense
✅ Unit Economics Monitor
✅ Monitoring
✅ Sync
```

### Логи выполнения:

```bash
# В n8n UI
Executions → Filter by workflow

# Проверьте:
- Success rate
- Execution time
- Error messages
```

---

## 🚨 TROUBLESHOOTING

### Workflow не запускается:

1. **Проверьте env vars:**

   ```bash
   Settings → Environment Variables
   # Убедитесь что все переменные установлены
   ```

2. **Проверьте API доступность:**

   ```bash
   curl https://your-api.vercel.app/api/health
   ```

3. **Проверьте Telegram bot token:**
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getMe
   ```

### Alerts не приходят:

1. **Проверьте ADMIN_CHAT_ID:**

   ```bash
   # Получите свой chat_id:
   # 1. Напишите боту /start
   # 2. Откройте: https://api.telegram.org/bot<TOKEN>/getUpdates
   # 3. Найдите "chat":{"id":123456789}
   ```

2. **Проверьте формат сообщения:**
   ```bash
   # В node "Send Summary Telegram"
   # parse_mode должен быть "Markdown"
   ```

### API errors:

1. **Проверьте CRON_SECRET:**

   ```bash
   # Должен совпадать с .env.production
   ```

2. **Проверьте rate limits:**
   ```bash
   # Sentinel: max 100 violations per run
   # Unit Economics: обрабатывает все товары
   ```

---

## 📈 МЕТРИКИ

### Sentinel Performance:

- **Frequency:** Every 5 minutes = 288 runs/day
- **Average execution:** 10-30 seconds
- **Success rate target:** >95%

### Unit Economics Monitor:

- **Frequency:** Every hour = 24 runs/day
- **Average execution:** 30-60 seconds (depends on product count)
- **Success rate target:** >98%

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### Phase 2: PriceShield Integration

Когда реализуем автоматическую корректировку цен:

1. **Threat Detection Workflow** (NEW)
   - Webhook trigger on threat detected
   - Auto-resolution logic
   - PriceShield API integration

2. **Update Sentinel**
   - Add PriceShield calls
   - Verification of price changes
   - Rollback on errors

### Phase 3: Onboarding Tracking

1. **Onboarding Progress Workflow** (NEW)
   - Track user progress
   - Detect blockers
   - Auto-assist

---

## 📞 SUPPORT

**Документация:**

- `UPDATE_SENTINEL_INSTRUCTIONS.md` - Как обновить Sentinel
- `viktor-margin-alert-builder.js` - Код для alerts
- `N8N_INTEGRATION_PLAN_v3.0.md` - Полный план интеграции

**Файлы:**

- `sentinel-workflow.json` - Обновлённый Sentinel
- `unit-economics-monitor-workflow.json` - Новый мониторинг

---

**Version:** 3.0.0  
**Date:** 2025-12-29  
**Status:** Production Ready ✅
