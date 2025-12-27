# 📊 Прогресс миграции на структурированный логгер

**Дата:** 2025-12-28 00:51  
**Статус:** В процессе (Фаза 1)

---

## ✅ Выполнено

### 1. Подготовка инфраструктуры

- ✅ Создан `src/api-lib/lib/logger.ts` с PII-редактированием
- ✅ Экспортирован из `src/api-lib/lib/index.ts`
- ✅ Добавлен импорт в `api/handlers/sentinel.ts`

### 2. Анализ кодовой базы

- ✅ Проверены критические файлы API
- ✅ Обнаружено: `api/handlers/sentinel.ts` - 40+ вхождений `console.log`
- ✅ Обнаружено: клиентский код (React) - 200+ вхождений (не критично)

---

## 📋 Следующие шаги (приоритет)

### Шаг 1: Завершить миграцию `sentinel.ts` (ВЫСОКИЙ ПРИОРИТЕТ)

**Файл:** `api/handlers/sentinel.ts` (766 строк)  
**Вхождений:** 40+ `console.log/warn/error`  
**Критичность:** P0 - обрабатывает цены, может логировать чувствительные данные

**План:**

1. Заменить все `console.log` на `logger.info`
2. Заменить все `console.warn` на `logger.warn`
3. Заменить все `console.error` на `logger.error`
4. Удалить кастомные `safeLog`/`safeError` (строки 129-141)
5. Тестировать после каждого изменения

**Команда для поиска:**

```bash
grep -n "console\." api/handlers/sentinel.ts
```

### Шаг 2: Мигрировать остальные API handlers

**Файлы:**

- `api/handlers/products.ts` - 10+ вхождений
- `api/handlers/sentinel-status.ts` - 8 вхождений
- `api/handlers/payments.ts` - 5 вхождений
- `api/index.ts` - 1 вхождение

### Шаг 3: Написать unit-тесты для logger

**Файл:** `tests/lib/logger.test.ts` (создать)  
**Тесты:**

- Редактирование API ключей
- Редактирование паролей
- Редактирование токенов
- Уровни логирования (debug только в dev)

---

## ⚠️ Важные замечания

### Клиентский код (React) НЕ МИГРИРОВАТЬ

Файлы в `src/pages/`, `src/components/`, `src/stores/` используют `console.log` для **браузерной отладки**.  
Это **нормально** и **безопасно** - логгер предназначен только для серверного кода.

### Файлы, которые МОЖНО оставить с console.log:

- `tests/**/*.test.ts` - тестовые файлы
- `src/pages/**/*.tsx` - React компоненты
- `src/components/**/*.tsx` - UI компоненты
- `src/stores/**/*.ts` - Zustand stores
- `src/lib/**/*.ts` - клиентские утилиты
- `scripts/**/*.cjs` - вспомогательные скрипты

### Файлы, которые НУЖНО мигрировать:

- `api/handlers/**/*.ts` - ✅ **КРИТИЧНО**
- `src/api-lib/services/**/*.ts` - ⚠️ **ВАЖНО**
- `src/api-lib/agent/**/*.ts` - ⚠️ **ВАЖНО**

---

## 🎯 Метрики прогресса

| Категория               | Всего | Мигрировано | Осталось |
| ----------------------- | ----- | ----------- | -------- |
| **API Handlers**        | ~60   | 1 (импорт)  | 59       |
| **Services**            | ~20   | 0           | 20       |
| **Agent**               | ~30   | 0           | 30       |
| **Клиент (игнорируем)** | ~200  | N/A         | N/A      |

---

## 📝 Шаблон миграции

### Было:

```typescript
console.log('🛡️ SENTINEL: Starting price check for', targetUsers.length, 'users');
console.warn('⚠️ No price found for product', productId);
console.error('Error checking Ozon:', error);
```

### Стало:

```typescript
logger.info('SENTINEL: Starting price check', { userCount: targetUsers.length });
logger.warn('No price found for product', { productId });
logger.error('Error checking Ozon', error, { userId: user.id });
```

### Преимущества:

- ✅ Автоматическое редактирование PII
- ✅ Структурированные логи (JSON)
- ✅ Контекст (userId, correlationId)
- ✅ Уровни логирования (debug только в dev)

---

## 🚀 Рекомендации для следующей сессии

### Вариант A: Продолжить миграцию (1-2 часа)

1. Завершить `sentinel.ts`
2. Мигрировать `products.ts`
3. Написать тесты для logger
4. Закоммитить: `feat(logging): migrate api handlers to structured logger`

### Вариант B: Переключиться на другую фазу

Если миграция логгера кажется слишком объёмной, можно:

1. Оставить текущий прогресс (импорт добавлен)
2. Перейти к Фазе 2: Rate-limiting (более быстрый результат)
3. Вернуться к миграции логгера позже

---

## 📞 Помощь

**Автоматизация миграции:**

```bash
# Найти все console.log в API handlers
grep -rn "console\." api/handlers/ --include="*.ts"

# Заменить автоматически (ОСТОРОЖНО!)
# Лучше делать вручную для каждого файла
```

**Проверка после миграции:**

```bash
npm run check:regression  # Убедиться, что ничего не сломалось
npm run build             # Проверить TypeScript
npm test                  # Запустить тесты
```

---

## 🎯 Цель Фазы 1

**Критерий завершения:**

- ✅ Все `console.log` в `api/handlers/*.ts` заменены на `logger.*`
- ✅ Все `console.log` в `src/api-lib/services/*.ts` заменены на `logger.*`
- ✅ Написаны unit-тесты для `logger.ts`
- ✅ Регрессионные тесты проходят
- ✅ Проект собирается без ошибок

**Ожидаемый результат:**

- 0 утечек чувствительных данных в логах
- Структурированные логи для мониторинга
- Готовность к интеграции с Vercel Log Drain / Datadog

---

**Статус:** 🟡 В процессе (10% завершено)  
**Следующий файл:** `api/handlers/sentinel.ts` (40+ замен)
