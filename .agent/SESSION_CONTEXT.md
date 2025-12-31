# Session Context: Local Development Setup (2025-12-31)

## 🎯 Цель сессии

Настроить полностью функциональную локальную среду разработки для NeuroGUARDIAN с работающим AI-агентом "Виктор".

## ✅ Что было достигнуто

### 1. Инфраструктура запущена

- ✅ ChromaDB (localhost:8001) - векторная БД для памяти
- ✅ Redis (localhost:6379) с паролем `localredispass`
- ✅ PostgreSQL (Neon cloud) - основная БД
- ✅ API Server (localhost:3001)

### 2. Аутентификация настроена

- ✅ Admin bypass через `X-Admin-Key` работает
- ✅ Security Agent в permissive mode
- ✅ Пропуск проверок БД, rate limiting, загрузки продуктов для admin

### 3. Простые запросы работают

- ✅ "привет" → мгновенный ответ через `handleSimpleIntent`
- ✅ Ответ: "Привет! 👋 Я — AI-ассистент для управления ценами на маркетплейсах. Чем могу помочь?"

### 4. Код изменен

**Файлы с изменениями:**

- `src/api-lib/handlers/agent-v4.ts` - добавлен admin bypass для БД, rate limit, продуктов
- `src/api-lib/agent/orchestrator-v4.ts` - добавлена поддержка локального LLM
- `scripts/local-api-server.mjs` - форсирован SECURITY_PERMISSIVE_MODE
- `docker/gpu/docker-compose.yml` - обновлен для Mistral Nemo (не работает из-за VRAM)
- `.env` - добавлен OPENAI_API_KEY

## ❌ Текущие проблемы

### 1. LLM не работает

**Проблема:** Сложные запросы (требующие планирования) возвращают ошибку "Ошибка планирования"

**Причины:**

- OpenAI API недоступен из России без VPN
- Mistral Nemo 12B требует >8GB VRAM (у вас 8GB)
- Qwen 1.5B слишком слабая для JSON structured output

**Что пробовали:**

1. Локальный Qwen 1.5B → не справляется с JSON планированием
2. Mistral Nemo 12B → недостаточно VRAM (требует 7.2GB, доступно 6.87GB)
3. OpenAI API → `unsupported_country_region_territory`
4. OpenAI API + VPN → сервер падает с 502 Bad Gateway

### 2. API Server нестабилен

- Периодически падает с 502 Bad Gateway
- Проблема возникает при вызове LLM через OpenAI

## 🔧 Технические детали

### Environment Variables (.env)

```bash
ADMIN_API_KEY="VhDeoXcrFiab8dREpvu4xlfqPBJMN7IC"
POSTGRES_URL="postgresql://neondb_owner:npg_oTBa8XY0mjyQ@ep-late-salad-agr4ecke-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"
REDIS_URL=redis://:localredispass@localhost:6379
SECURITY_PERMISSIVE_MODE="true"
OPENAI_API_KEY="sk-proj-..." # Не работает без VPN
```

### Тестовые команды

```powershell
# Запуск API сервера
npm run dev:api

# Тест простого запроса (работает)
Invoke-WebRequest -Uri "http://localhost:3001/api?action=agent-v4&telegramId=7548070478" -Method POST -Headers @{"X-Admin-Key"="VhDeoXcrFiab8dREpvu4xlfqPBJMN7IC"; "Content-Type"="application/json"} -Body '{"message":"привет"}' -UseBasicParsing

# Тест сложного запроса (не работает)
Invoke-WebRequest -Uri "http://localhost:3001/api?action=agent-v4&telegramId=7548070478" -Method POST -Headers @{"X-Admin-Key"="VhDeoXcrFiab8dREpvu4xlfqPBJMN7IC"; "Content-Type"="application/json"} -Body '{"message":"расскажи о своих возможностях"}' -UseBasicParsing
```

## 🎯 Следующие шаги

### Вариант 1: Groq API (рекомендуется)

1. Зарегистрироваться на https://console.groq.com/keys
2. Получить бесплатный API ключ
3. Добавить в `.env`: `GROQ_API_KEY="gsk_..."`
4. Перезапустить API сервер
5. Протестировать сложные запросы

**Преимущества:**

- Бесплатный
- Быстрый (Llama 3.1 70B)
- Доступен из России
- Хорошо справляется с JSON

### Вариант 2: Локальная модель меньшего размера

1. Использовать Phi-3-mini (3.8B) или Qwen2.5-7B
2. Упростить систему планирования (убрать JSON schema)
3. Использовать простые промпты

### Вариант 3: Стабильный VPN + OpenAI

1. Настроить стабильное VPN соединение
2. Использовать существующий OpenAI ключ
3. Отладить причину падения сервера

## 📝 Важные заметки

1. **Admin bypass работает** - можно тестировать без реальных пользователей
2. **Простые интенты обрабатываются локально** - не требуют LLM
3. **Инфраструктура стабильна** - ChromaDB, Redis, PostgreSQL работают
4. **Frontend не тестировался** - нужно запустить `npm run dev` и проверить UI

## 🔍 Для отладки

### Проверка логов

```powershell
# Логи API сервера - смотреть в терминале с npm run dev:api

# Логи Docker контейнеров
docker logs neuro-llm-router --tail 50
docker logs neuro-gpu-chroma --tail 20
```

### Проверка здоровья сервисов

```powershell
# ChromaDB
curl http://localhost:8001/api/v1/heartbeat

# Redis
redis-cli -a localredispass ping

# API Server
curl http://localhost:3001/api?action=health
```
