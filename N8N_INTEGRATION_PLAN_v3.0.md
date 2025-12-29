# 🔄 n8n INTEGRATION PLAN - Viktor Margin v3.0

**Date:** 2025-12-29  
**Goal:** Полная визуализация и контроль всех процессов через n8n

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ n8n

### ✅ Существующие Workflows (6):

1. **sentinel-workflow.json** (25KB)
   - Trigger: Every 5 minutes
   - Check prices API
   - Defense action router (WB/Ozon, zero_stock/price_fix)
   - Telegram notifications
   - Bulk logging

2. **monitoring-workflow.json** (7KB)
   - System health monitoring
   - API status checks

3. **sync-workflow.json** (9KB)
   - Product synchronization
   - WB/Ozon data sync

4. **notifications-workflow.json** (10KB)
   - Telegram alert system
   - Email notifications

5. **analytics-workflow.json** (7KB)
   - Daily statistics
   - Performance metrics

6. **agent-dashboard-workflow.json** (14KB)
   - AI agent monitoring
   - Conversation analytics

---

## 🎯 ЧТО НУЖНО ДОБАВИТЬ ДЛЯ VIKTOR MARGIN v3.0

### 1. **Unit Economics Monitoring Workflow** (NEW)

**Цель:** Визуализация расчётов маржи в реальном времени

**Nodes:**

1. **Trigger**: Schedule (hourly)
2. **Get Products**: Fetch all products
3. **Calculate Economics**: For each product
   - Call `/api/calculate-unit-economics`
   - Get full breakdown (Ozon Card, storage, returns)
4. **Detect Warnings**: Filter products with warnings
   - OZON_CARD_IMPACT
   - HIGH_STORAGE_DAYS
   - HIGH_RETURN_RATE
   - NEGATIVE_PROFIT
5. **Route by Severity**:
   - Critical → Immediate Telegram alert
   - Warning → Daily digest
   - Info → Log only
6. **Store Results**: Save to database
7. **Telegram Summary**: Daily margin report

**Value:** Вы видите в n8n какие товары теряют маржу и почему

---

### 2. **Viktor Margin Persona Workflow** (NEW)

**Цель:** Мониторинг работы AI agent с новой персоной

**Nodes:**

1. **Trigger**: Webhook (on agent response)
2. **Parse Response**: Extract Viktor Margin elements
   - Did it use margin-focused language?
   - Did it mention Ozon Card?
   - Did it provide concrete numbers?
3. **Quality Check**:
   - Response contains warnings? ✅
   - Response has concrete numbers? ✅
   - Response mentions marketplace traps? ✅
4. **Log to Dashboard**: Track persona effectiveness
5. **Alert if Generic**: If agent response is too generic

**Value:** Контроль качества Viktor Margin persona

---

### 3. **Threat Detection & Auto-Resolution Workflow** (NEW)

**Цель:** Визуализация PriceShield работы (когда реализуем Phase 2)

**Nodes:**

1. **Trigger**: Webhook (on threat detected)
2. **Threat Analysis**:
   - Type (OZON_CARD_EROSION, NEGATIVE_MARGIN, etc.)
   - Severity (critical/warning)
   - Impact (potential loss in ₽)
3. **Decision Router**:
   - Auto-resolvable + Critical → Execute PriceShield
   - Non-critical → Send for manual approval
   - Not resolvable → Alert only
4. **Execute Action** (if auto-resolvable):
   - Call PriceShield API
   - Adjust price
   - Verify change
5. **Audit Log**: Record all actions
6. **Telegram Notification**: With before/after comparison

**Value:** Полная прозрачность автоматической защиты

---

### 4. **Onboarding Progress Workflow** (NEW)

**Цель:** Визуализация onboarding процесса (для Phase 3)

**Nodes:**

1. **Trigger**: Webhook (on onboarding step)
2. **Track Progress**:
   - Current step (1-10)
   - Time spent on each step
   - Completion rate
3. **Detect Blockers**:
   - API validation failed?
   - Product sync stuck?
   - User abandoned?
4. **Auto-Assist**:
   - Send help message if stuck >5 min
   - Offer manual support
5. **Success Metrics**: Track completion rate

**Value:** Видите где пользователи застревают в onboarding

---

### 5. **Enhanced Sentinel Workflow** (UPDATE EXISTING)

**Цель:** Добавить Viktor Margin features в существующий Sentinel

**Additions to existing sentinel-workflow.json:**

**New Nodes:**

1. **Unit Economics Check** (after "Check Prices API"):
   - Calculate full economics for each violation
   - Include Ozon Card impact
   - Include storage costs
   - Include return costs

2. **Viktor Margin Alert Format**:
   - Replace generic alerts with Viktor Margin style
   - Include concrete numbers
   - Include annual impact calculation
   - Include actionable recommendations

3. **Threat Severity Router** (before Defense Action Router):
   - CRITICAL (negative margin) → Immediate action
   - HIGH (Ozon Card >2.5%) → Priority action
   - MEDIUM (storage >60 days) → Scheduled action
   - LOW (info only) → Log only

**Example Alert (Viktor Margin style):**

```
🚨 КРИТИЧЕСКАЯ УГРОЗА МАРЖИ!

📦 Товар: [название]
🔵 Маркетплейс: Ozon

💰 АНАЛИЗ:
├─ Текущая цена: 1000₽
├─ Себестоимость: 700₽
├─ Комиссия Ozon: 120₽ (12%)
├─ Логистика: 46₽
├─ Скидка Ozon Card: 20₽ (2%)
└─ ЧИСТАЯ ПРИБЫЛЬ: 114₽ (11.4%)

⚠️ РИСК:
Цена упала до 950₽ → УБЫТОК 36₽ с каждого заказа!
При 100 заказах в месяц = -3,600₽

⚔️ ДЕЙСТВИЕ:
Цена автоматически возвращена к минимальной: 1050₽
Новая маржа: 15%

✅ Товар защищён!
```

---

## 📋 ПЛАН РЕАЛИЗАЦИИ

### Phase 1.5: n8n Updates (4 часа) - СЕЙЧАС

**Цель:** Обновить существующие workflows для Viktor Margin

**Tasks:**

1. **Update Sentinel Workflow** (2 часа):
   - Add Unit Economics calculation node
   - Update alert format to Viktor Margin style
   - Add threat severity routing
   - Test with real data

2. **Create Unit Economics Monitoring Workflow** (2 часа):
   - New workflow from scratch
   - Hourly checks
   - Warning detection
   - Daily digest

**Deliverable:** n8n workflows с Viktor Margin брендингом

---

### Phase 2.5: PriceShield Integration (4 часа) - ПОСЛЕ PHASE 2

**Цель:** Добавить автоматическую корректировку цен в n8n

**Tasks:**

1. **Create Threat Detection Workflow** (2 часа)
2. **Update Sentinel for Auto-Resolution** (2 часа)

---

### Phase 3.5: Onboarding Tracking (2 часа) - ПОСЛЕ PHASE 3

**Цель:** Визуализация onboarding процесса

---

## 🎯 РЕКОМЕНДАЦИЯ

**Начнём с Phase 1.5 (4 часа):**

1. **Сейчас (2 часа):** Update Sentinel Workflow
   - Добавим Viktor Margin alert format
   - Добавим Unit Economics в каждый alert
   - Вы сможете видеть полный расчёт маржи в Telegram

2. **Потом (2 часа):** Create Unit Economics Monitoring
   - Новый workflow для hourly checks
   - Автоматическое обнаружение проблем
   - Daily digest с рисками

**После этого:**

- Вы сможете тестировать сутки
- Видеть все процессы в n8n
- Проверять каждую ноду
- Убедиться что всё работает корректно

---

**Начинаем с обновления Sentinel Workflow?** Это даст вам полную визуализацию защиты цен с Viktor Margin стилем.
