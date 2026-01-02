# 🗄️ n8n Complete Removal Archive

**Дата архивации:** 2026-01-02  
**Причина:** Упрощение архитектуры согласно AUTOMATION_AUDIT.md

## 📋 Что заархивировано

### 1. Docker конфигурация n8n

- `n8n/` — полная Docker конфигурация n8n
  - docker-compose.yml
  - .env файлы
  - credentials и workflows

### 2. Скрипты

- `scripts/n8n-import.mjs` — импорт workflows
- `scripts/n8n-export.mjs` — экспорт workflows
- `scripts/import-n8n-workflows.mjs` — массовый импорт
- `scripts/import-n8n-workflow.cjs` — импорт одного workflow
- `scripts/list-n8n-workflows.ps1` — список workflows
- `scripts/sync-vercel-to-n8n.cjs` — синхронизация с Vercel

### 3. Документация

- `N8N_WORKFLOWS_PASSPORT.md` — паспорт всех workflows
- `.env.n8n.example` — пример конфигурации

### 4. Утилиты

- `start-n8n.bat` — скрипт запуска n8n в Docker

## 🎯 Почему заархивировано

Согласно аудиту автоматизации (docs/AUTOMATION_AUDIT.md):

1. **Дублирование функционала** — n8n workflows дублировали 100% функционала Vercel API + Telegram
2. **Избыточная сложность** — требовал Docker/VPS, усложнял поддержку
3. **Нет связи с production** — workflows не использовались в production
4. **Стоимость** — требовал дополнительную инфраструктуру

## ✅ Что используется вместо n8n

**Минимальный production стек:**

- Telegram Bot — главный интерфейс пользователя
- Vercel API — все endpoints и бизнес-логика
- Vercel Cron — автоматические задачи (Sentinel)
- Neon PostgreSQL — база данных
- Groq — AI агент (llama-3.3-70b-versatile)

**Стоимость:** $0/месяц для MVP с 1000+ пользователей

## 🔄 Как восстановить (если понадобится)

```bash
# 1. Восстановить Docker конфигурацию
cp -r .agent/archive/2026-01-02-n8n-complete-removal/n8n docker/

# 2. Восстановить скрипты
cp .agent/archive/2026-01-02-n8n-complete-removal/scripts/* scripts/

# 3. Восстановить утилиты
cp .agent/archive/2026-01-02-n8n-complete-removal/start-n8n.bat .
cp .agent/archive/2026-01-02-n8n-complete-removal/.env.n8n.example .

# 4. Запустить n8n
./start-n8n.bat
```

## 📊 Статистика

- **Workflows заархивировано:** 19 (уже в 2026-01-01-automation-cleanup)
- **Скриптов заархивировано:** 6
- **Docker файлов:** 9
- **Документации:** 2 файла

---

> **Примечание:** Workflows уже были заархивированы 2026-01-01 в `2026-01-01-automation-cleanup/n8n-workflows/`.
> Этот архив содержит оставшуюся инфраструктуру n8n.
