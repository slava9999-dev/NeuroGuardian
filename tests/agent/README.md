# 🧪 NeuroGUARDIAN — Professional E2E Tests

## Быстрый старт

```bash
# 1. Запустить тестовую БД (Docker)
docker run -d --name neuroguardian-test-db \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_PASSWORD=testpass123 \
  -e POSTGRES_DB=neuroguardian_test \
  -p 5433:5432 postgres:15-alpine

# 2. Запустить тесты
npm run test:agent:pro
```

## Требования

### LLM Provider (один из):

- ✅ **OpenAI API** (рекомендуется, но заблокирован в РФ)
- ✅ **Groq API** (бесплатный, но иногда 403)
- ✅ **Ollama** (локальный, без ограничений)

### База данных:

- PostgreSQL 15+ (через Docker или локально)

---

## Решение проблем

### ❌ OpenAI: "unsupported_country_region_territory"

**Проблема:** OpenAI заблокирован в России.

**Решение 1 — Использовать Groq:**

```bash
# Получить бесплатный ключ: https://console.groq.com
# Добавить в .env:
GROQ_API_KEY=gsk_your_key_here
```

**Решение 2 — Использовать Ollama (локально):**

```bash
# Установить Ollama
winget install Ollama.Ollama

# Скачать модель
ollama pull mistral-nemo

# Запустить сервер
ollama serve

# Добавить в .env:
USE_OLLAMA=true
OLLAMA_MODEL=mistral-nemo:latest
```

**Решение 3 — Использовать OpenRouter (прокси):**

```bash
# Получить ключ: https://openrouter.ai
# Добавить в orchestrator-v4.ts новый провайдер:
{
  name: 'OpenRouter',
  url: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'meta-llama/llama-3.1-70b-instruct',
  ...
}
```

---

### ❌ Groq: 403 Forbidden

**Причины:**

1. Ключ истёк или невалиден
2. Модель требует платный план
3. Rate limit превышен

**Решение:**

```bash
# 1. Проверить ключ на https://console.groq.com
# 2. Попробовать другую модель:
#    - llama-3.1-8b-instant (бесплатная)
#    - llama-3.1-70b-versatile (может требовать оплату)
# 3. Подождать 1 минуту (rate limit)
```

---

### ❌ Ollama: 502 Bad Gateway

**Причина:** Ollama serve не запущена.

**Решение:**

```bash
# Windows:
ollama serve

# Linux/Mac:
ollama serve &

# Проверка:
curl http://localhost:11434/api/tags
```

---

## Структура тестов

```
tests/agent/
├── run-pro-tests.ts          # Основной раннер
├── fixtures/
│   └── test-config.ts         # Тестовые данные и сценарии
└── README.md                  # Эта документация
```

### Сценарии тестов

**CRITICAL** (обязательно должны проходить):

- ✅ Приветствие и представление
- ✅ Показать товары пользователя
- ✅ Поиск товара по названию

**HIGH** (важные функции):

- ✅ Понимание контекста (себестоимость, период)
- ✅ Уточняющие вопросы
- ✅ Запрет search_web для конкурентов

**MEDIUM** (дополнительные):

- ✅ ABC анализ
- ✅ Благодарность
- ✅ Запрос возможностей

---

## CI/CD Integration

Exit codes:

- `0` — Все тесты прошли
- `1` — Есть провалы (не критичные)
- `2` — Критические провалы

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: npm run test:agent:pro
  continue-on-error: false
```

---

## Метрики

Тесты измеряют:

- ⏱️ Время выполнения (планирование, выполнение, ответ)
- 🔧 Вызванные инструменты
- 📊 Pass rate по категориям
- 🎯 Точность выбора инструментов

---

## Troubleshooting

### Тесты зависают

```bash
# Проверить что БД доступна:
docker ps | grep neuroguardian-test-db

# Проверить что LLM отвечает:
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mistral-nemo","messages":[{"role":"user","content":"test"}]}'
```

### Все тесты падают

```bash
# Проверить переменные окружения:
node -e "console.log(process.env.GROQ_API_KEY ? 'GROQ: OK' : 'GROQ: MISSING')"
node -e "console.log(process.env.OPENAI_API_KEY ? 'OPENAI: OK' : 'OPENAI: MISSING')"

# Проверить БД:
docker exec neuroguardian-test-db psql -U testuser -d neuroguardian_test -c "SELECT 1"
```

---

## Контакты

Вопросы и баги: создайте Issue в репозитории.
