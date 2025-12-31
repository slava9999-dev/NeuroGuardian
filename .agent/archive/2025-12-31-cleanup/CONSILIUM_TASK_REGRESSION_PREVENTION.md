# 🧠 ЗАДАНИЕ КОНСИЛИУМУ НЕЙРОСЕТЕЙ

**Проект:** NeuroGUARDIAN  
**Дата:** 2025-12-28  
**Версия:** 2.11.0  
**Цель:** Критический анализ и улучшение системы защиты от регрессий

---

## 📋 КОНТЕКСТ ПРОЕКТА

### Что это за проект?

**NeuroGUARDIAN** — AI-powered система управления товарами на маркетплейсах (Wildberries, Ozon).

**Стек:**

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend: Vercel Serverless Functions, PostgreSQL (Neon)
- AI: Google Gemini (AI SDK)
- Automation: n8n (Docker)
- Testing: Vitest (120 тестов), Playwright (4 E2E теста)

**Архитектура:**

```
Telegram Bot ←→ React UI ←→ Vercel API ←→ PostgreSQL
                    ↓
              AI Agent (Gemini)
                    ↓
         Marketplace APIs (WB/Ozon)
                    ↓
              n8n Workflows
```

### Критические компоненты:

1. **AI Agent V4** (`src/api-lib/agent/`) — мозг системы
2. **Sentinel** (`api/handlers/sentinel.ts`) — мониторинг цен
3. **Marketplace Services** (`src/api-lib/services/marketplace.ts`) — интеграция с WB/Ozon
4. **Admin API** (`api/handlers/admin.ts`) — управление системой

---

## 🎯 ТЕКУЩЕЕ СОСТОЯНИЕ ЗАЩИТЫ

### ✅ Что уже работает:

#### 1. CI/CD Pipeline (GitHub Actions)

```yaml
Job 1: lint-build-test
  ✅ ESLint
  ✅ TypeScript typecheck
  ✅ Production build
  ✅ 120 unit/integration тестов (Vitest)
  ✅ Bundle size check (<500KB)
  ✅ npm audit

Job 2: policy-checks
  ✅ Статические проверки (check-regression.cjs)

Job 3: security-scan
  ✅ Snyk vulnerability scan
```

#### 2. Pre-commit Hooks (Husky)

```bash
✅ lint-staged (auto-format)
✅ check:regression (статические проверки)
```

#### 3. Тестовое покрытие

```
✅ 120 unit/integration тестов
✅ 4 E2E теста (Playwright)
✅ Покрытие: ~70% (оценочно)
```

#### 4. Статические проверки (`scripts/check-regression.cjs`)

```javascript
✅ Наличие критических файлов
✅ Отсутствие логирования API ключей
✅ .env в .gitignore
✅ Production guard в handleResetDb
✅ Правильный экспорт логгера
✅ Отсутствие хардкод-секретов
```

### ⚠️ Известные проблемы:

1. **Покрытие тестами недостаточное** (~70%, цель 80%+)
2. **E2E тестов мало** (4 теста, цель 10+)
3. **Нет регрессионных тестов для исправленных багов**
4. **Нет мониторинга production-метрик**
5. **Нет автоматического rollback при деплое**

---

## 🚨 КРИТИЧЕСКИЕ РЕГРЕССИИ ИЗ ИСТОРИИ

### Регрессия #1: Тесты не запускались в CI

**Когда:** До коммита `aad6970`  
**Проблема:** CI был зелёным, но тесты фактически не выполнялись  
**Последствия:** Ложное чувство безопасности  
**Исправление:** Добавлен `npm test` в `.github/workflows/ci.yml`

### Регрессия #2: Фейковая аналитика

**Когда:** До коммита `39e3397`  
**Проблема:** ABC-анализ и прогноз остатков использовали моковые данные  
**Последствия:** Пользователи принимали решения на основе фейковых данных  
**Исправление:** Реализована синхронизация реальных заказов из WB/Ozon API

### Регрессия #3: "Слепой" Sentinel

**Когда:** До коммита `399c587`  
**Проблема:** Sentinel проверял цены по устаревшим данным из БД  
**Последствия:** Защита цен не работала в реальном времени  
**Исправление:** Добавлен `fetchOzonCurrentPrices` для live-проверки

### Регрессия #4: Опасный endpoint сброса БД

**Когда:** До коммита `399c587`  
**Проблема:** `handleResetDb` работал в production без защиты  
**Последствия:** Риск потери всех данных  
**Исправление:** Добавлен `if (isProduction) return 403`

### Регрессия #5: Логирование API ключей

**Когда:** Периодически возвращается  
**Проблема:** `console.log` с чувствительными данными  
**Последствия:** Утечка секретов в логи  
**Исправление:** Централизованный logger с PII redaction

---

## 🎯 ЗАДАНИЕ КОНСИЛИУМУ

### Роли участников:

1. **🔴 Security Auditor** — анализ безопасности
2. **🟡 QA Engineer** — анализ тестового покрытия
3. **🟢 DevOps Architect** — анализ CI/CD и деплоя
4. **🔵 Code Reviewer** — анализ качества кода
5. **🟣 Product Owner** — анализ бизнес-рисков

---

## 📝 ВОПРОСЫ ДЛЯ АНАЛИЗА

### Блок 1: Тестирование (QA Engineer)

1. **Какие критические сценарии не покрыты тестами?**
   - Hint: Изучите `tests/` и сравните с `src/api-lib/agent/tool-executors.ts`
   - Вопрос: Есть ли тесты для `executeUpdatePrices`, `executeUpdateStocks`, `executeSetStopLoss`?

2. **Какие edge cases не протестированы?**
   - Что если API маркетплейса вернёт 500?
   - Что если пользователь отменит подтверждение?
   - Что если БД недоступна?

3. **Достаточно ли E2E тестов?**
   - Текущие: 4 теста (smoke tests)
   - Покрывают ли они критические user flows?
   - Что нужно добавить?

4. **Есть ли флакающие тесты?**
   - Проверьте историю CI runs
   - Есть ли тесты с таймаутами?

### Блок 2: Безопасность (Security Auditor)

1. **Какие векторы атак не защищены?**
   - SQL injection?
   - XSS в agent responses?
   - CSRF в API endpoints?
   - Rate limiting?

2. **Правильно ли хранятся секреты?**
   - Изучите `.env.example`, `.env.n8n.example`
   - Есть ли хардкод-ключи в коде?
   - Безопасен ли `ADMIN_API_KEY`?

3. **Защищены ли критические endpoints?**
   - `api/handlers/admin.ts` — кто может вызвать?
   - `api/handlers/agent-v4.ts` — есть ли rate limiting?
   - `api/handlers/sentinel.ts` — можно ли спамить?

4. **Логируются ли чувствительные данные?**
   - Проверьте все `logger.info()` вызовы
   - Работает ли PII redaction?
   - Есть ли `console.log` с секретами?

### Блок 3: CI/CD (DevOps Architect)

1. **Достаточно ли проверок перед деплоем?**
   - Что происходит, если тесты упали?
   - Есть ли автоматический rollback?
   - Проверяется ли production перед деплоем?

2. **Можно ли улучшить скорость CI?**
   - Текущее время: ~3-5 минут
   - Можно ли распараллелить?
   - Нужен ли кеш?

3. **Защищён ли production от плохого деплоя?**
   - Есть ли staging environment?
   - Есть ли canary deployment?
   - Есть ли health checks после деплоя?

4. **Мониторится ли production?**
   - Есть ли алерты на ошибки?
   - Логируются ли метрики?
   - Есть ли дашборд?

### Блок 4: Качество кода (Code Reviewer)

1. **Есть ли технический долг, который может вызвать регрессии?**
   - Дублирование кода?
   - Сложные функции (>50 строк)?
   - Неявные зависимости?

2. **Правильно ли обрабатываются ошибки?**
   - Изучите `src/api-lib/agent/tool-executors.ts`
   - Все ли `try/catch` логируют ошибки?
   - Есть ли silent failures?

3. **Соблюдаются ли best practices?**
   - TypeScript strict mode?
   - Zod validation для всех inputs?
   - Immutability?

4. **Есть ли "code smells"?**
   - Magic numbers?
   - Hardcoded strings?
   - God objects?

### Блок 5: Бизнес-риски (Product Owner)

1. **Какие функции критичны для бизнеса?**
   - Обновление цен?
   - Мониторинг конкурентов?
   - Аналитика?

2. **Что произойдёт, если они сломаются?**
   - Потеря денег?
   - Потеря клиентов?
   - Репутационный ущерб?

3. **Достаточно ли защищены критические функции?**
   - Есть ли для них отдельные тесты?
   - Есть ли мониторинг?
   - Есть ли fallback?

4. **Какие метрики нужно отслеживать?**
   - Uptime?
   - Response time?
   - Error rate?
   - User satisfaction?

---

## 📊 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

### Формат отчёта от каждой роли:

```markdown
## [Роль]: [Имя участника]

### 🔴 Критические проблемы (P0)

1. [Проблема] — [Почему критично] — [Как исправить]

### 🟡 Важные проблемы (P1)

1. [Проблема] — [Почему важно] — [Как исправить]

### 🟢 Улучшения (P2)

1. [Предложение] — [Зачем] — [Как реализовать]

### 📋 Конкретные задачи

- [ ] [Задача 1]
- [ ] [Задача 2]
```

### Итоговый консолидированный отчёт:

```markdown
# КОНСОЛИДИРОВАННЫЙ ПЛАН ЗАЩИТЫ ОТ РЕГРЕССИЙ

## Фаза 1: Критические исправления (1-2 дня)

- [ ] [P0 задачи от всех ролей]

## Фаза 2: Важные улучшения (1 неделя)

- [ ] [P1 задачи от всех ролей]

## Фаза 3: Долгосрочные улучшения (1 месяц)

- [ ] [P2 задачи от всех ролей]

## Метрики успеха

- [ ] Test coverage ≥ 80%
- [ ] E2E tests ≥ 10
- [ ] CI success rate ≥ 95%
- [ ] Zero P0 security issues
- [ ] Production uptime ≥ 99.9%
```

---

## 🔍 МАТЕРИАЛЫ ДЛЯ АНАЛИЗА

### Критические файлы для изучения:

#### Backend (API)

- `api/handlers/agent-v4.ts` — AI agent endpoint
- `api/handlers/admin.ts` — admin operations
- `api/handlers/sentinel.ts` — price monitoring
- `api/handlers/analytics.ts` — analytics API

#### Agent Core

- `src/api-lib/agent/orchestrator-v4.ts` — agent orchestration
- `src/api-lib/agent/tool-executors.ts` — tool implementations
- `src/api-lib/agent/schemas-v4.ts` — JSON schemas
- `src/api-lib/agent/validators.ts` — Zod validators

#### Services

- `src/api-lib/services/marketplace.ts` — WB/Ozon integration
- `src/api-lib/services/database.ts` — DB operations
- `src/api-lib/services/unit-economics.ts` — business logic
- `src/api-lib/lib/logger.ts` — centralized logging

#### Tests

- `tests/agent/` — agent tests
- `tests/marketplace/` — marketplace tests
- `tests/e2e/` — E2E tests
- `tests/utils/` — utility tests

#### CI/CD

- `.github/workflows/ci.yml` — CI pipeline
- `.husky/pre-commit` — pre-commit hooks
- `scripts/check-regression.cjs` — static checks

#### Documentation

- `CRITICAL_AUDIT_REPORT.md` — audit findings
- `REGRESSION_PREVENTION.md` — current protection system
- `CLAUDE.md` — project memory
- `.agent/PROJECT_STATE.md` — current state

---

## 🎯 СПЕЦИАЛЬНЫЕ ИНСТРУКЦИИ

### Для Security Auditor:

- Используйте OWASP Top 10 как чек-лист
- Проверьте все endpoints на authentication/authorization
- Изучите все места, где обрабатываются user inputs
- Проверьте, нет ли SQL injection vectors

### Для QA Engineer:

- Постройте матрицу покрытия: функция × тип теста
- Найдите все `TODO` и `FIXME` в тестах
- Проверьте, есть ли тесты для каждого `executeXxx` в tool-executors
- Оцените качество существующих тестов (не только количество)

### Для DevOps Architect:

- Нарисуйте диаграмму deployment pipeline
- Найдите single points of failure
- Предложите стратегию zero-downtime deployment
- Спроектируйте систему мониторинга

### Для Code Reviewer:

- Используйте статический анализ (ESLint, TypeScript)
- Найдите все функции >50 строк
- Проверьте cyclomatic complexity
- Найдите дублирование кода

### Для Product Owner:

- Составьте список user stories
- Оцените impact каждой функции
- Приоритизируйте по бизнес-ценности
- Предложите метрики для отслеживания

---

## 📞 КООРДИНАЦИЯ

### Процесс работы:

1. **Индивидуальный анализ** (каждая роль работает независимо)
2. **Обмен находками** (выявление пересечений)
3. **Консолидация** (объединение в единый план)
4. **Приоритизация** (P0 → P1 → P2)
5. **Roadmap** (разбивка на фазы)

### Критерии приоритизации:

**P0 (Критично):**

- Угроза безопасности
- Потеря данных
- Финансовые потери
- Полная неработоспособность

**P1 (Важно):**

- Частичная неработоспособность
- Плохой UX
- Технический долг
- Недостаточное покрытие тестами

**P2 (Улучшение):**

- Оптимизация
- Новые фичи
- Рефакторинг
- Документация

---

## ✅ ЧЕКЛИСТ ДЛЯ КАЖДОЙ РОЛИ

### Перед началом:

- [ ] Прочитал весь документ
- [ ] Изучил структуру проекта
- [ ] Понял свою роль и зону ответственности
- [ ] Знаю, какие файлы нужно проверить

### Во время анализа:

- [ ] Делаю заметки по каждой находке
- [ ] Классифицирую по приоритету (P0/P1/P2)
- [ ] Предлагаю конкретные решения
- [ ] Оцениваю трудозатраты

### После анализа:

- [ ] Оформил отчёт в требуемом формате
- [ ] Проверил, что все критические области покрыты
- [ ] Готов обсудить находки с другими ролями
- [ ] Готов помочь в реализации исправлений

---

## 🚀 НАЧАЛО РАБОТЫ

**Консилиум, приступайте к анализу!**

Каждая роль должна:

1. Изучить указанные файлы
2. Ответить на вопросы из своего блока
3. Найти дополнительные проблемы
4. Предложить конкретные решения
5. Оформить отчёт

**Срок:** 2-3 часа на роль  
**Формат:** Markdown отчёт  
**Цель:** Создать bulletproof систему защиты от регрессий

---

## 📌 ВАЖНО

Это не академическое упражнение. Это **production-система**, которая управляет реальными товарами и ценами на маркетплейсах. Каждая регрессия может привести к:

- ❌ Потере денег (неправильные цены)
- ❌ Потере клиентов (сломанная функциональность)
- ❌ Утечке данных (security issues)
- ❌ Репутационному ущербу

**Будьте критичны. Будьте честны. Будьте конкретны.**

---

**Удачи, консилиум! 🧠**
