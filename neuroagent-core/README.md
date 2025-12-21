# NeuroAgent Core

# AI Agent для продавцов маркетплейсов WB/Ozon

Мощный AI-ассистент на базе LangChain + OpenAI GPT.

## 🚀 Быстрый старт

### 1. Создание виртуального окружения

```bash
cd neuroagent-core
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 3. Настройка окружения

```bash
cp .env.example .env
# Отредактируй .env и добавь OPENAI_API_KEY
```

### 4. Запуск сервера

```bash
python -m app.main
# или
uvicorn app.main:app --reload --port 8000
```

Сервер будет доступен на http://localhost:8000

## 📡 API Endpoints

### POST /api/chat

Главный endpoint для общения с агентом.

```json
{
  "message": "Покажи мои продажи за неделю",
  "user_id": "123456789",
  "wb_api_key": "optional-encrypted-key"
}
```

### GET /health

Проверка статуса сервиса.

## 🏗 Архитектура

```
neuroagent-core/
├── app/
│   ├── main.py           # FastAPI приложение
│   ├── core/
│   │   ├── config.py     # Настройки
│   │   ├── llm_router.py # Маршрутизация LLM
│   │   └── orchestrator.py # Главный оркестратор
│   ├── tools/
│   │   └── wildberries.py # WB API tools
│   └── schemas/
│       └── messages.py   # Pydantic модели
├── requirements.txt
└── .env
```

## 🧠 Как работает

1. **LLM Router** — определяет сложность запроса
   - Простые запросы → GPT-4o-mini (дешевле, быстрее)
   - Сложные запросы → GPT-4o (умнее)

2. **Orchestrator** — обрабатывает сообщения
   - Хранит историю диалога
   - Управляет подтверждениями
   - Вызывает tools

3. **Tools** — инструменты для работы с API
   - `wb_search_products` — поиск товаров
   - `wb_get_sales` — статистика продаж
   - `wb_get_stocks` — остатки
   - `wb_update_prices` — изменение цен (с подтверждением!)
