# 🔄 ИНСТРУКЦИЯ: Обновление Sentinel Workflow для Viktor Margin v3.0

**Дата:** 2025-12-29  
**Цель:** Обновить alerts в стиле Viktor Margin с детальным breakdown маржи

---

## 📋 ЧТО ОБНОВЛЯЕМ

### Node: "Build Summary Message" (ID: 14e58854-11d8-4dd8-a818-407ea4e64c77)

**Было:**

- Простой список успешных/неудачных действий
- Нет деталей по маржинальности
- Нет конкретных цифр убытков

**Станет:**

- Детальный breakdown каждого защищённого товара
- Конкретные цифры: обнаруженная цена, лимит, сохранённая сумма
- Годовой impact (на 1000 заказов)
- Threat severity indicators
- Viktor Margin брендинг

---

## 🛠️ КАК ОБНОВИТЬ

### Вариант A: Через n8n UI (рекомендуется)

1. **Откройте n8n:**

   ```bash
   # Если n8n запущен локально
   http://localhost:5678
   ```

2. **Найдите workflow:**
   - Workflows → "NeuroGUARDIAN Sentinel - Price Defense"

3. **Найдите node "Build Summary Message":**
   - Это Code node с ID `14e58854-11d8-4dd8-a818-407ea4e64c77`
   - Position: [464, 1344]

4. **Замените код:**
   - Откройте node
   - Удалите весь текущий JavaScript код
   - Скопируйте код из `viktor-margin-alert-builder.js`
   - Вставьте в node
   - Save

5. **Тест:**
   - Execute Workflow
   - Проверьте Telegram alert
   - Должен быть Viktor Margin стиль

---

### Вариант B: Через JSON (быстрее)

1. **Откройте файл:**

   ```bash
   code n8n-workflows/sentinel-workflow.json
   ```

2. **Найдите node "Build Summary Message"** (строка ~620):

   ```json
   {
     "parameters": {
       "mode": "runOnceForAllItems",
       "jsCode": "const items = $input.all();\\n\\n..."
     },
     "id": "14e58854-11d8-4dd8-a818-407ea4e64c77",
     "name": "Build Summary Message",
     ...
   }
   ```

3. **Замените `jsCode`:**
   - Скопируйте код из `viktor-margin-alert-builder.js`
   - Escape для JSON (замените `\n` на `\\n`, `"` на `\"`)
   - Или используйте готовый escaped код ниже

4. **Import в n8n:**
   - n8n UI → Import from File
   - Выберите обновлённый `sentinel-workflow.json`

---

## 📝 ГОТОВЫЙ ESCAPED КОД (для JSON)

Скопируйте это в `jsCode` field:

```
const items = $input.all();\\n\\nlet criticalCount = 0;\\nlet successCount = 0;\\nlet errorCount = 0;\\nconst criticalThreats = [];\\nconst successActions = [];\\nconst errorActions = [];\\n\\nfor (const item of items) {\\n  const status = item.json.execution_status;\\n  const marketplace = item.json.marketplace || 'unknown';\\n  const productTitle = item.json.product_title || item.json.product_id || 'Unknown Product';\\n  const productId = item.json.product_id || item.json.offer_id || 'unknown';\\n  const action = item.json.defense_action || 'unknown';\\n  const detectedPrice = item.json.detected_price || 0;\\n  const minPrice = item.json.min_price || 0;\\n  const savedAmount = item.json.saved_amount || 0;\\n  \\n  const mpEmoji = marketplace.toLowerCase() === 'wildberries' || marketplace.toLowerCase() === 'wb' ? '🟣' : '🔵';\\n  \\n  if (status === 'success') {\\n    successCount++;\\n    \\n    const priceDropPercent = minPrice > 0 ? ((minPrice - detectedPrice) / minPrice * 100).toFixed(1) : 0;\\n    const annualImpact = savedAmount * 1000;\\n    \\n    const actionText = action === 'zero_stock' \\n      ? '🛡️ Обнулены остатки' \\n      : `🛡️ Цена возвращена к ${minPrice}₽`;\\n    \\n    successActions.push({\\n      title: productTitle,\\n      marketplace: marketplace,\\n      mpEmoji: mpEmoji,\\n      detectedPrice: detectedPrice,\\n      minPrice: minPrice,\\n      savedAmount: savedAmount,\\n      priceDropPercent: priceDropPercent,\\n      annualImpact: annualImpact,\\n      action: actionText\\n    });\\n    \\n    if (priceDropPercent > 10 || detectedPrice < minPrice * 0.9) {\\n      criticalCount++;\\n    }\\n  } else {\\n    errorCount++;\\n    const errorReason = item.json.error_reason || 'Unknown error';\\n    errorActions.push({\\n      title: productTitle,\\n      marketplace: marketplace,\\n      mpEmoji: mpEmoji,\\n      productId: productId,\\n      error: errorReason\\n    });\\n  }\\n}\\n\\nlet message = '';\\n\\nif (criticalCount > 0) {\\n  message += `🚨 *КРИТИЧЕСКАЯ УГРОЗА МАРЖИ!*\\\\n\\\\n`;\\n} else if (successCount > 0) {\\n  message += `🛡️ *VIKTOR MARGIN: Защита сработала!*\\\\n\\\\n`;\\n} else {\\n  message += `✅ *VIKTOR MARGIN: Мониторинг*\\\\n\\\\n`;\\n}\\n\\nmessage += `📊 *СТАТИСТИКА:*\\\\n`;\\nmessage += `✅ Защищено: ${successCount}\\\\n`;\\nif (criticalCount > 0) {\\n  message += `🚨 Критических: ${criticalCount}\\\\n`;\\n}\\nif (errorCount > 0) {\\n  message += `❌ Ошибок: ${errorCount}\\\\n`;\\n}\\nmessage += `📦 Всего обработано: ${items.length}\\\\n\\\\n`;\\n\\nif (successActions.length > 0) {\\n  message += `━━━━━━━━━━━━━━━━━━━━\\\\n`;\\n  message += `*ЗАЩИЩЁННЫЕ ТОВАРЫ:*\\\\n\\\\n`;\\n  \\n  successActions.forEach((item, index) => {\\n    if (index < 5) {\\n      message += `${item.mpEmoji} *${item.title}*\\\\n`;\\n      message += `├─ Обнаружена цена: ${item.detectedPrice}₽\\\\n`;\\n      message += `├─ Лимит (Stop-Loss): ${item.minPrice}₽\\\\n`;\\n      message += `├─ Падение: ${item.priceDropPercent}%\\\\n`;\\n      message += `├─ Сохранено: ${item.savedAmount}₽ на заказ\\\\n`;\\n      message += `├─ Годовой impact: ${item.annualImpact.toFixed(0)}₽ (на 1000 заказов)\\\\n`;\\n      message += `└─ ${item.action}\\\\n\\\\n`;\\n    }\\n  });\\n  \\n  if (successActions.length > 5) {\\n    message += `_...и ещё ${successActions.length - 5} товаров_\\\\n\\\\n`;\\n  }\\n}\\n\\nif (errorActions.length > 0) {\\n  message += `━━━━━━━━━━━━━━━━━━━━\\\\n`;\\n  message += `⚠️ *ТРЕБУЕТСЯ ВНИМАНИЕ:*\\\\n\\\\n`;\\n  \\n  errorActions.forEach((item, index) => {\\n    if (index < 3) {\\n      message += `${item.mpEmoji} ${item.title}\\\\n`;\\n      message += `└─ Ошибка: ${item.error}\\\\n\\\\n`;\\n    }\\n  });\\n  \\n  if (errorActions.length > 3) {\\n    message += `_...и ещё ${errorActions.length - 3} ошибок_\\\\n\\\\n`;\\n  }\\n}\\n\\nmessage += `━━━━━━━━━━━━━━━━━━━━\\\\n`;\\nmessage += `💡 *Viktor Margin*\\\\n`;\\nmessage += `_Защита вашей маржи 24/7_`;\\n\\nreturn {\\n  json: {\\n    message: message,\\n    successCount: successCount,\\n    criticalCount: criticalCount,\\n    errorCount: errorCount,\\n    totalProcessed: items.length,\\n    hasCritical: criticalCount > 0\\n  }\\n};
```

---

## 📊 ПРИМЕР НОВОГО ALERT

**До (старый формат):**

```
🛡️ Defense System Report

✅ Successful: 2
❌ Failed: 0
📊 Total Processed: 2

Successful Actions:
  • WB: 12345678 (price_correction)
  • OZON: 67890 (zero_stock)
```

**После (Viktor Margin формат):**

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

🔵 Кроссовки спортивные
├─ Обнаружена цена: 1200₽
├─ Лимит (Stop-Loss): 1500₽
├─ Падение: 20.0%
├─ Сохранено: 300₽ на заказ
├─ Годовой impact: 300,000₽ (на 1000 заказов)
└─ 🛡️ Обнулены остатки

━━━━━━━━━━━━━━━━━━━━
💡 Viktor Margin
_Защита вашей маржи 24/7_
```

---

## ✅ ПРОВЕРКА

После обновления проверьте:

1. **Workflow активен:**

   ```bash
   # В n8n UI
   Workflows → Sentinel → Status: Active
   ```

2. **Тест alert:**

   ```bash
   # Trigger manually
   Execute Workflow → Check Telegram
   ```

3. **Формат корректен:**
   - ✅ Есть emoji маркетплейсов (🟣/🔵)
   - ✅ Есть breakdown цен
   - ✅ Есть годовой impact
   - ✅ Есть Viktor Margin подпись

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

После обновления Sentinel workflow:

1. **Создать Unit Economics Monitoring Workflow** (2 часа)
   - Hourly checks всех товаров
   - Автоматическое обнаружение warnings
   - Daily digest с рисками

2. **Добавить Unit Economics calculation в Sentinel** (1 час)
   - Перед defense action вызывать `/api/calculate-unit-economics`
   - Включать полный breakdown в alert
   - Показывать Ozon Card impact

3. **Тестирование** (1 час)
   - Создать тестовые угрозы
   - Проверить все типы alerts
   - Убедиться что всё работает

---

**Готово к обновлению!** 🚀

Следуйте Вариант A (через n8n UI) для безопасности.
