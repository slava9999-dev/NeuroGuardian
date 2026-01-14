# NeuroGUARDIAN Playbook: Алгоритмы стабильной работы

**Версия:** 1.0.0 | **Дата:** Январь 2026

> Этот документ содержит проверенные паттерны, предсказуемые сценарии и алгоритмы для стабильной работы системы и увеличения прибыли пользователей. Основано на реальных кейсах, официальной документации WB/Ozon и анализе ошибок.

---

## 📋 Оглавление

1. [API и синхронизация — известные проблемы и решения](#1-api-и-синхронизация)
2. [Безопасность аккаунта — защита от взлома и мошенничества](#2-безопасность-аккаунта)
3. [Ценообразование — алгоритмы увеличения прибыли](#3-ценообразование)
4. [Защита от конкурентов — паттерны атак и противодействие](#4-защита-от-конкурентов)
5. [Юнит-экономика — формулы расчёта](#5-юнит-экономика)
6. [Sentinel — предсказуемые сценарии защиты](#6-sentinel-сценарии)

---

## 1. API и синхронизация

### 1.1 Известные проблемы API (2024-2025)

| Маркетплейс | Проблема                                                         | Решение в NeuroGUARDIAN                                          |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **WB**      | Смена доменов API (suppliers-api → content-api, marketplace-api) | Используем актуальные эндпоинты, мониторим changelog WB          |
| **WB**      | Ошибки 429/503 при высокой нагрузке                              | `fetchWithRetry` с экспоненциальным backoff (3-5 попыток)        |
| **WB**      | Изменение структуры ответов без предупреждения                   | Defensive parsing (?.optional chaining)                          |
| **Ozon**    | `Circle is open` — rate limit при большом кол-ве запросов        | Rate limiter: max 10 req/sec                                     |
| **Ozon**    | Расширенные ошибки API ключей (invalid, deactivated, no role)    | Валидация ключа при подключении + информативные сообщения        |
| **Оба**     | Устаревание методов API (v2 → v3 → v4)                           | Отслеживаем changelog, priority alerts для критических изменений |

### 1.2 Алгоритм безопасной синхронизации

```typescript
// ПРАВИЛО: Chunk-based sync с защитой от таймаутов
async function syncProducts(userId: number) {
  const CHUNK_SIZE = 50; // Не более 50 товаров за раз
  const DELAY_BETWEEN_CHUNKS = 1000; // 1 сек между чанками

  const products = await fetchFromMarketplace();
  const chunks = splitIntoChunks(products, CHUNK_SIZE);

  for (const chunk of chunks) {
    await processChunk(chunk);
    await sleep(DELAY_BETWEEN_CHUNKS);
  }
}

// ПРАВИЛО: Валидация ключа ПЕРЕД сохранением
async function validateApiKey(key: string, marketplace: string): Promise<boolean> {
  try {
    // Делаем тестовый запрос (getProducts limit 1)
    const test = await testApiCall(key, marketplace);
    return test.success;
  } catch (e) {
    // Логируем причину отказа
    logger.warn('API key validation failed', { marketplace, error: e.message });
    return false;
  }
}
```

### 1.3 Частые ошибки при работе с API

| Ошибка                                   | Причина                        | Как избежать                            |
| ---------------------------------------- | ------------------------------ | --------------------------------------- |
| `401 Unauthorized`                       | Невалидный или отозванный ключ | Проверять ключ при каждом сеансе        |
| `429 Too Many Requests`                  | Превышен лимит запросов        | Rate limiting на уровне приложения      |
| `504 Gateway Timeout`                    | Медленный ответ от MP          | Увеличить timeout до 30-60 сек          |
| Пустой массив товаров                    | Нет прав на ключе              | Проверить scope прав при создании ключа |
| `NOAUTH Authentication required` (Redis) | Локальный Redis без пароля     | Настроить URL с паролем или отключить   |

---

## 2. Безопасность аккаунта

### 2.1 Угрозы (реальные кейсы 2024-2025)

| Тип угрозы                 | Описание                                                         | Частота            |
| -------------------------- | ---------------------------------------------------------------- | ------------------ |
| **Фишинг**                 | Поддельные письма/SMS от "маркетплейса" с просьбой ввести данные | Очень часто        |
| **Социальная инженерия**   | Звонки "из поддержки" с просьбой назвать код из SMS              | Часто              |
| **Взлом через сотрудника** | Сотрудник с полным доступом уходит и "забирает" аккаунт          | Редко, но критично |
| **Перехват API ключа**     | Ключ утёк в логах, репозитории или чате                          | Средне             |
| **Конкурентная атака**     | Накрутка фейковых заказов, скликивание рекламы                   | Часто              |

### 2.2 Алгоритмы защиты в NeuroGUARDIAN

```typescript
// ПРАВИЛО 1: Шифрование API ключей в БД
const encryptedKey = encrypt(apiKey, process.env.API_KEY_ENCRYPTION_KEY);
await db.save({ api_key_wb: encryptedKey }); // Никогда plain text!

// ПРАВИЛО 2: Аудит всех критических действий
async function setStopLoss(userId: number, productId: string, price: number) {
  await auditLog.create({
    userId,
    action: 'SET_STOP_LOSS',
    details: { productId, price },
    ip: request.ip,
    timestamp: new Date(),
  });
}

// ПРАВИЛО 3: Rate limiting по пользователю
const rateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 минута
  maxRequests: 100, // Макс 100 запросов
  keyPrefix: 'user:',
});

// ПРАВИЛО 4: Санитизация всех входных данных
function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Удалить HTML
    .replace(/['"`;]/g, '') // Удалить SQL-опасные символы
    .trim()
    .slice(0, 1000); // Ограничить длину
}
```

### 2.3 Рекомендации для пользователей (интегрировать в бота)

```markdown
🔒 **Правила безопасности вашего магазина:**

1. **Никогда не передавайте** коды из SMS никому, даже "поддержке"
2. **Регистрируйте кабинет** только на свой телефон и email
3. **Давайте сотрудникам** ограниченный доступ (роль "Управляющий")
4. **Меняйте API ключ** при увольнении сотрудника
5. **Проверяйте URL** перед входом: seller.wildberries.ru, не seller-wb.ru
6. **Не переходите** по ссылкам из подозрительных писем
```

---

## 3. Ценообразование

### 3.1 Проверенные стратегии

| Стратегия           | Когда использовать                   | Формула                                                        |
| ------------------- | ------------------------------------ | -------------------------------------------------------------- |
| **Затратный метод** | Новый товар, неизвестный рынок       | `Цена = Себестоимость + Логистика + Комиссия + Желаемая маржа` |
| **Конкурентное**    | Устоявшийся рынок, много аналогов    | `Цена = Медианная цена конкурентов ± 5%`                       |
| **Проникновение**   | Захват ниши, есть ресурсы на "минус" | `Цена = Себестоимость + Комиссия` (без маржи, временно)        |
| **Премиум**         | Уникальный товар, сильный бренд      | `Цена = Конкурент + 15-30%`                                    |

### 3.2 Алгоритм расчёта оптимальной цены (NeuroGUARDIAN)

```typescript
interface PriceCalculation {
  costPrice: number; // Закупка
  logistics: number; // Доставка до склада + хранение
  commission: number; // Комиссия маркетплейса (%)
  targetMargin: number; // Желаемая маржа (%)
  sppBuffer: number; // Буфер на СПП (25% для WB)
  returnRate: number; // % возвратов
}

function calculateOptimalPrice(calc: PriceCalculation): number {
  // Базовые затраты
  const baseCost = calc.costPrice + calc.logistics;

  // Учёт комиссии (обратный расчёт: если комиссия 15%, делим на 0.85)
  const afterCommission = baseCost / (1 - calc.commission / 100);

  // Добавляем маржу
  const withMargin = afterCommission / (1 - calc.targetMargin / 100);

  // Учитываем СПП (цена для покупателя будет ниже!)
  const withSppBuffer = withMargin / (1 - calc.sppBuffer / 100);

  // Закладываем стоимость возвратов
  const withReturns = withSppBuffer * (1 + calc.returnRate / 100);

  return Math.ceil(withReturns);
}

// Пример:
// costPrice: 500, logistics: 100, commission: 15%, margin: 20%, spp: 25%, returns: 5%
// Результат: ~1105₽ (вместо наивных 720₽)
```

### 3.3 Типичные ошибки ценообразования

| Ошибка                          | Последствие                           | Как избежать                              |
| ------------------------------- | ------------------------------------- | ----------------------------------------- |
| Не учтён СПП                    | Маржа ниже ожидаемой на 20-30%        | Использовать `target_buyer_price` + буфер |
| Забыта стоимость возвратов      | Убыток 5-15% от оборота               | Закладывать return_rate в цену            |
| Демпинг без плана выхода        | Конкуренты тоже снизят, убыток у всех | Устанавливать чёткий срок акции           |
| Одинаковая цена на всех складах | Упущенная прибыль в регионах          | Региональное ценообразование (2026)       |

---

## 4. Защита от конкурентов

### 4.1 Паттерны атак конкурентов

| Атака                   | Как работает                                 | Как детектировать                       |
| ----------------------- | -------------------------------------------- | --------------------------------------- |
| **Фейковые заказы**     | Заказывают в отдалённые регионы, не выкупают | Резкий рост невыкупов с новых аккаунтов |
| **Скликивание рекламы** | Кликают по рекламе без покупки               | CTR высокий, конверсия 0%               |
| **Негативные отзывы**   | Массовые фейковые 1-звёздочные отзывы        | Кластер негатива без заказов            |
| **Ценовой демпинг**     | Продают ниже себестоимости                   | Мониторинг цен конкурентов              |
| **Патентный троллинг**  | Патентуют популярный товар, требуют убрать   | Жалоба на нарушение патента             |
| **Порча при возврате**  | Возвращают испорченный/подменённый товар     | Видеофиксация на ПВЗ                    |

### 4.2 Алгоритмы защиты в Sentinel

```typescript
// ДЕТЕКЦИЯ: Аномальный рост невыкупов
async function detectFakeOrdersAttack(userId: number): Promise<boolean> {
  const stats = await getOrderStats(userId, '7days');

  const avgNonBuyoutRate = stats.historical_non_buyout_rate; // Обычно 5-10%
  const currentNonBuyoutRate = stats.current_non_buyout_rate;

  // Если невыкуп вырос более чем в 2 раза — подозрительно
  if (currentNonBuyoutRate > avgNonBuyoutRate * 2 && currentNonBuyoutRate > 15) {
    await sendAlert(userId, {
      type: 'FAKE_ORDERS_SUSPECTED',
      message: `Невыкуп вырос с ${avgNonBuyoutRate}% до ${currentNonBuyoutRate}%`,
      recommendation: 'Проверьте регионы заказов, возможно атака конкурентов',
    });
    return true;
  }

  return false;
}

// ДЕТЕКЦИЯ: Резкое падение цены конкурента
async function detectCompetitorDumping(productId: string): Promise<void> {
  const myPrice = await getMyPrice(productId);
  const competitorPrices = await getCompetitorPrices(productId);

  for (const comp of competitorPrices) {
    // Если конкурент упал более чем на 30% за день
    if (comp.priceDropPercent > 30 && comp.priceDropPercent < myPrice.margin) {
      await sendAlert({
        type: 'COMPETITOR_DUMPING',
        message: `${comp.sellerName} снизил цену на ${comp.priceDropPercent}%`,
        recommendation: 'Не демпингуйте в ответ, это может быть ловушка. Подождите 3-5 дней.',
      });
    }
  }
}
```

---

## 5. Юнит-экономика

### 5.1 Формула расчёта (стандартная)

```typescript
interface UnitEconomics {
  // Входные данные
  sellingPrice: number; // Цена продажи
  costPrice: number; // Закупочная цена
  marketplace: 'WB' | 'Ozon';
  category: string;
  weight: number; // Вес в кг
  volume: number; // Объём в литрах
  returnRate: number; // % возвратов (0-100)

  // Выходные данные
  revenue: number; // Выручка
  commission: number; // Комиссия маркетплейса
  logistics: number; // Логистика
  storage: number; // Хранение
  ads: number; // Реклама (средний CPO)
  returnCost: number; // Стоимость возвратов
  profit: number; // Чистая прибыль
  margin: number; // Маржинальность (%)
  roi: number; // ROI (%)
}

function calculateUnitEconomics(data: UnitEconomicsInput): UnitEconomics {
  // 1. Комиссия маркетплейса (зависит от категории)
  const commissionRate = getCommissionRate(data.marketplace, data.category);
  const commission = data.sellingPrice * commissionRate;

  // 2. Логистика (зависит от веса/объёма)
  const logistics = calculateLogistics(data.marketplace, data.weight, data.volume);

  // 3. Хранение (30 дней среднее)
  const storage = calculateStorage(data.marketplace, data.volume, 30);

  // 4. Реклама (средний CPO по категории)
  const ads = getAverageCPO(data.category);

  // 5. Стоимость возвратов
  const returnCost = (data.returnRate / 100) * (logistics * 2 + data.costPrice * 0.1);

  // 6. Итоговые расчёты
  const revenue = data.sellingPrice;
  const totalCosts = data.costPrice + commission + logistics + storage + ads + returnCost;
  const profit = revenue - totalCosts;
  const margin = (profit / revenue) * 100;
  const roi = (profit / data.costPrice) * 100;

  return {
    revenue,
    commission,
    logistics,
    storage,
    ads,
    returnCost,
    profit,
    margin: Math.round(margin * 10) / 10,
    roi: Math.round(roi * 10) / 10,
  };
}
```

### 5.2 Референсные значения по категориям (WB 2025)

| Категория       | Комиссия WB | Средний CPO | Средний возврат |
| --------------- | ----------- | ----------- | --------------- |
| Одежда          | 15%         | 150₽        | 25%             |
| Обувь           | 15%         | 200₽        | 30%             |
| Электроника     | 10%         | 100₽        | 5%              |
| Косметика       | 15%         | 80₽         | 3%              |
| Товары для дома | 12%         | 120₽        | 10%             |
| Детские товары  | 13%         | 100₽        | 15%             |

---

## 6. Sentinel — предсказуемые сценарии

### 6.1 Матрица сценариев

| Сценарий                    | Триггер                             | Действие Sentinel                    | Уведомление         |
| --------------------------- | ----------------------------------- | ------------------------------------ | ------------------- |
| **Цена ниже стоп-лосса**    | `current_price < min_price`         | Обнуление остатка ИЛИ Коррекция цены | Немедленно          |
| **СПП съедает маржу**       | `buyer_price < target_buyer_price`  | Поднятие базовой цены                | При следующем цикле |
| **Принудительная акция WB** | Цена упала без действий продавца    | Логирование + Алерт                  | Немедленно          |
| **Конкурент снизил цену**   | `competitor_price < my_price - 10%` | Опциональная подстройка              | Ежедневный отчёт    |
| **Товар закончился**        | `stock = 0` И были продажи          | Напоминание о пополнении             | 1 раз в день        |
| **API ключ невалиден**      | 401/403 от маркетплейса             | Блокировка мониторинга + Алерт       | Немедленно          |

### 6.2 Приоритеты действий

```typescript
enum ActionPriority {
  CRITICAL = 1, // Выполнить немедленно (потеря денег)
  HIGH = 2, // Выполнить в течение 30 минут
  MEDIUM = 3, // Выполнить в течение дня
  LOW = 4, // Информационно
}

const scenarioPriorities: Record<string, ActionPriority> = {
  PRICE_BELOW_STOP_LOSS: ActionPriority.CRITICAL,
  SPP_MARGIN_EROSION: ActionPriority.HIGH,
  FORCED_DISCOUNT: ActionPriority.HIGH,
  COMPETITOR_PRICE_DROP: ActionPriority.MEDIUM,
  STOCK_OUT: ActionPriority.LOW,
  API_KEY_INVALID: ActionPriority.CRITICAL,
};
```

### 6.3 Алгоритм принятия решений

```
┌─────────────────────────────────────────────────────────┐
│                   ЦИКЛ SENTINEL (каждые 30 мин)         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────┐                                  │
│  │ 1. Fetch prices   │──→ API WB/Ozon                   │
│  └─────────┬─────────┘                                  │
│            ▼                                            │
│  ┌───────────────────┐                                  │
│  │ 2. For each prod  │                                  │
│  └─────────┬─────────┘                                  │
│            ▼                                            │
│  ┌───────────────────┐    ┌────────────────────┐        │
│  │ live_price <      │ Да │ EXECUTE DEFENSE    │        │
│  │ min_price?        │───→│ (zero stock / fix) │        │
│  └─────────┬─────────┘    └────────────────────┘        │
│            │ Нет                                        │
│            ▼                                            │
│  ┌───────────────────┐    ┌────────────────────┐        │
│  │ auto_adjust &&    │ Да │ RECALC min_price   │        │
│  │ target_buyer_set? │───→│ with SPP buffer    │        │
│  └─────────┬─────────┘    └────────────────────┘        │
│            │ Нет                                        │
│            ▼                                            │
│  ┌───────────────────┐    ┌────────────────────┐        │
│  │ competitor_track? │ Да │ CHECK COMPETITOR   │        │
│  │                   │───→│ ADJUST IF NEEDED   │        │
│  └─────────┬─────────┘    └────────────────────┘        │
│            │ Нет                                        │
│            ▼                                            │
│  ┌───────────────────┐                                  │
│  │ Update DB, Log    │                                  │
│  └───────────────────┘                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📎 Приложение: Чеклист для пользователя

### Перед запуском продаж:

- [ ] API ключ создан с нужными правами (Контент, Цены, Статистика)
- [ ] Товары синхронизированы в NeuroGUARDIAN
- [ ] Установлены `cost_price` для всех товаров
- [ ] Установлены `min_price` (стоп-лоссы)
- [ ] Включена авто-защита (`protection_enabled = true`)

### Еженедельно:

- [ ] Проверить отчёты Sentinel за неделю
- [ ] Обновить `cost_price` если изменилась закупка
- [ ] Пересмотреть `spp_buffer_percent` если СПП изменился
- [ ] Проверить конкурентов (топ-5)

### Ежемесячно:

- [ ] Анализ юнит-экономики всех товаров
- [ ] ABC-анализ (удалить/снизить убыточные)
- [ ] Обновить API ключи (ротация для безопасности)
- [ ] Проверить changelog API маркетплейсов

---

_Документ поддерживается командой NeuroGUARDIAN. Обновления при изменении API или бизнес-правил маркетплейсов._
