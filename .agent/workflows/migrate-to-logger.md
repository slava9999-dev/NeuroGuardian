# 🔄 План миграции на структурированный логгер

## Цель

Заменить все `console.log/warn/error` на централизованный `logger` с автоматическим редактированием чувствительных данных.

## Приоритет

**P0 - Критический** (безопасность)

## Затронутые файлы (200+ вхождений)

### Критические (содержат чувствительные данные):

- `api/handlers/admin.ts` - тесты API ключей
- `api/handlers/sentinel.ts` - обработка цен и API запросов
- `api/handlers/products.ts` - синхронизация с маркетплейсами
- `api/handlers/agent-v4.ts` - обработка запросов агента
- `src/api-lib/agent/tool-executors.ts` - выполнение инструментов агента

### Средний приоритет:

- `api/handlers/payments.ts` - обработка платежей
- `src/api-lib/services/marketplace.ts` - интеграция с маркетплейсами
- `src/api-lib/services/database.ts` - операции с БД

### Низкий приоритет (dev-only):

- `scripts/*` - вспомогательные скрипты
- `tests/*` - тестовые файлы

## Этапы миграции

### Фаза 1: Критические файлы (сегодня)

```typescript
// Было:
console.log('🔑 getUserApiKeys: fetching keys for userId=', userId);
console.log('API key length:', apiKey.length);

// Стало:
import { logger } from '../lib/index.js';
logger.debug('Fetching user API keys', { userId });
// Длина ключа вообще не логируется
```

### Фаза 2: Добавление корреляционных ID (завтра)

```typescript
import { createLogger } from '../lib/index.js';

export async function handleAgentRequest(req, res) {
  const correlationId = crypto.randomUUID();
  const log = createLogger({ correlationId, userId: req.userId });

  log.info('Agent request started');
  // ... обработка
  log.info('Agent request completed', { duration: elapsed });
}
```

### Фаза 3: Интеграция с внешним сервисом (неделя)

- Настроить отправку логов в Vercel Logs / Datadog / Sentry
- Добавить алерты на ERROR уровне
- Настроить ротацию логов

## Автоматизация

### Поиск всех console.log:

```bash
grep -r "console\.log" --include="*.ts" --exclude-dir=node_modules
```

### Замена через sed (осторожно!):

```bash
# Не рекомендуется - лучше вручную проверить каждый случай
```

## Проверка

### Тесты:

```typescript
import { logger } from './logger';

describe('Logger', () => {
  it('should redact API keys', () => {
    const spy = jest.spyOn(console, 'log');
    logger.info('Test', { api_key: 'secret123456' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('secr***[REDACTED]'));
  });
});
```

### Мониторинг:

- Проверить, что в продакшн логах нет полных API ключей
- Убедиться, что DEBUG логи не попадают в production

## Откат

Если что-то пойдёт не так:

```bash
git revert <commit-hash>
```

## Чеклист

- [x] Создан `src/api-lib/lib/logger.ts`
- [x] Экспортирован из `src/api-lib/lib/index.ts`
- [ ] Заменены критические `console.log` в `admin.ts`
- [ ] Заменены критические `console.log` в `sentinel.ts`
- [ ] Заменены критические `console.log` в `tool-executors.ts`
- [ ] Написаны unit-тесты для логгера
- [ ] Обновлена документация
- [ ] Проверено в dev окружении
- [ ] Задеплоено в production
- [ ] Мониторинг логов 24 часа

## Следующие шаги

После завершения миграции рассмотреть переход на:

- **pino** (быстрый, структурированный JSON)
- **winston** (гибкий, множество транспортов)
- **Vercel Log Drain** (интеграция с Vercel)
