# 🔧 ЧЕКЛИСТ СИНХРОНИЗАЦИИ NEUROGUARDIAN

> **Версия:** 1.0.0  
> **Дата:** 2025-12-29  
> **Статус:** Адаптированная архитектура (Вариант B)

---

## 📋 Этап 1: Локальная среда

### Системные требования

- [ ] **Node.js 20+** установлен (`node -v`)
- [ ] **npm 10+** установлен (`npm -v`)
- [ ] **Docker Desktop** установлен и **запущен**
- [ ] **Git** настроен (`git config --list`)
- [ ] **PowerShell 7+** (рекомендуется) или Windows PowerShell

### Проверка

```powershell
node -v          # Должно быть v20.x или выше
npm -v           # Должно быть 10.x или выше
docker --version # Docker Desktop
git --version    # Git for Windows
```

---

## 📋 Этап 2: Клонирование и настройка

### Файлы конфигурации

- [ ] Репозиторий склонирован
- [ ] `.env.local` создан из `.env.example`
- [ ] API ключи добавлены:

| Переменная            | Где взять                                 | Обязательно     |
| --------------------- | ----------------------------------------- | --------------- |
| `POSTGRES_URL`        | [Neon Console](https://console.neon.tech) | ✅ Да           |
| `TELEGRAM_BOT_TOKEN`  | [@BotFather](https://t.me/BotFather)      | ✅ Да           |
| `AGENTROUTER_API_KEY` | [AgentRouter](https://agentrouter.org)    | ⚠️ Для AI       |
| `GROQ_API_KEY`        | [Groq Console](https://console.groq.com)  | ⚠️ Альтернатива |
| `CRON_SECRET`         | Сгенерировать                             | ✅ Для n8n      |
| `ADMIN_API_KEY`       | Сгенерировать                             | ✅ Для админа   |

### Генерация секретов

```powershell
# Генерация случайного ключа (32 символа)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

---

## 📋 Этап 3: Docker контейнеры

### Запуск полного стека

```powershell
# Перейти в директорию docker
cd docker

# Скопировать .env
Copy-Item .env.docker .env

# Запустить контейнеры
docker compose up -d

# Проверить статус
docker compose ps
```

### Доступные сервисы

| Сервис              | URL                   | Credentials                      |
| ------------------- | --------------------- | -------------------------------- |
| **PostgreSQL**      | `localhost:5432`      | neuroguardian / localdevpassword |
| **Redis**           | `localhost:6379`      | Password: localredispass         |
| **n8n**             | http://localhost:5678 | admin / localn8npass             |
| **Adminer**         | http://localhost:8080 | Выбрать PostgreSQL               |
| **Redis Commander** | http://localhost:8081 | Автоматически                    |

### Чек-боксы

- [ ] PostgreSQL работает (порт 5432)
- [ ] Redis работает (порт 6379)
- [ ] n8n работает (порт 5678)
- [ ] Adminer доступен (порт 8080)
- [ ] Redis Commander доступен (порт 8081)

---

## 📋 Этап 4: База данных

### Применение миграций

```powershell
# Из корня проекта
npm run db:migrate
```

### Проверка через Adminer

1. Открыть http://localhost:8080
2. Система: PostgreSQL
3. Сервер: postgres (или ng_postgres)
4. Пользователь: neuroguardian
5. Пароль: localdevpassword
6. База данных: neuroguardian_dev

### Чек-боксы

- [ ] Миграции применены (`npm run db:migrate`)
- [ ] Таблицы видны в Adminer
- [ ] Подключение к Neon (production) проверено

---

## 📋 Этап 5: n8n Workflows

### Импорт workflow

1. Открыть http://localhost:5678
2. Войти: admin / localn8npass
3. Settings → Import → выбрать JSON файлы из `n8n-workflows/`

### Обязательные workflows

- [ ] `sentinel-workflow.json` - Мониторинг цен
- [ ] `sync-workflow.json` - Синхронизация данных
- [ ] `monitoring-workflow.json` - Системный мониторинг
- [ ] `analytics-workflow.json` - Аналитика
- [ ] `notifications-workflow.json` - Уведомления

### Настройка credentials в n8n

- [ ] HTTP Header Auth (для API_URL + CRON_SECRET)
- [ ] Telegram Bot (для уведомлений)

### Активация

- [ ] Все workflows активированы (toggle ON)

---

## 📋 Этап 6: GitHub

### Secrets в GitHub Repository

Перейти: Repository → Settings → Secrets and variables → Actions

| Secret              | Значение                        |
| ------------------- | ------------------------------- |
| `VERCEL_TOKEN`      | Токен из Vercel Settings        |
| `VERCEL_ORG_ID`     | ID организации Vercel           |
| `VERCEL_PROJECT_ID` | ID проекта Vercel               |
| `SNYK_TOKEN`        | (опционально) для security scan |

### Чек-боксы

- [ ] Secrets добавлены в GitHub
- [ ] GitHub Actions работают (проверить вкладку Actions)
- [ ] CI проходит на push в main

---

## 📋 Этап 7: Vercel

### Environment Variables

Перейти: Vercel Dashboard → Project → Settings → Environment Variables

Добавить все переменные из `.env.production`:

- [ ] `POSTGRES_URL` (Production)
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `AGENTROUTER_API_KEY` или `GROQ_API_KEY`
- [ ] `CRON_SECRET`
- [ ] `ADMIN_API_KEY`
- [ ] `API_KEY_ENCRYPTION_KEY`
- [ ] `WEBAPP_URL`

### Чек-боксы

- [ ] Все production переменные добавлены
- [ ] Deploy hook работает
- [ ] Preview deploys работают

---

## 📋 Этап 8: Тестирование

### Локальные тесты

```powershell
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run test          # Vitest
npm run check:regression  # Security checks
```

### E2E тесты

```powershell
npm run test:e2e      # Playwright
```

### API тесты

- [ ] `/api/health` отвечает 200
- [ ] `/api/agent` работает (с AI ключом)
- [ ] Telegram бот отвечает

### Чек-боксы

- [ ] Unit тесты проходят
- [ ] TypeScript без ошибок
- [ ] Build успешен
- [ ] Regression checks пройдены

---

## 📋 Этап 9: Финальная проверка

### Автоматическая проверка

```powershell
.\scripts\health-check.ps1
```

### Ручная проверка

- [ ] Приложение открывается http://localhost:3000
- [ ] Telegram бот отвечает
- [ ] AI агент работает
- [ ] n8n workflows выполняются по расписанию
- [ ] Логи без критических ошибок

---

## 🚀 Команды быстрого старта

```powershell
# 1. Полная установка с нуля
.\scripts\setup.ps1

# 2. Ежедневный запуск
cd docker; docker compose up -d; cd ..; npm run dev

# 3. Проверка здоровья
.\scripts\health-check.ps1

# 4. Просмотр Docker логов
cd docker; docker compose logs -f

# 5. Остановка
cd docker; docker compose down

# 6. Полный сброс (осторожно!)
cd docker; docker compose down -v
```

---

## 📊 Статус синхронизации

| Этап                  | Статус | Примечания |
| --------------------- | ------ | ---------- |
| 1. Локальная среда    | ⬜     |            |
| 2. Клонирование       | ⬜     |            |
| 3. Docker             | ⬜     |            |
| 4. База данных        | ⬜     |            |
| 5. n8n                | ⬜     |            |
| 6. GitHub             | ⬜     |            |
| 7. Vercel             | ⬜     |            |
| 8. Тестирование       | ⬜     |            |
| 9. Финальная проверка | ⬜     |            |

**Легенда:** ✅ Готово | ⬜ Не начато | 🔄 В процессе | ❌ Проблема

---

## 🆘 Troubleshooting

### Docker не запускается

```powershell
# Перезапустить Docker Desktop
# Проверить включение WSL2
wsl --status
```

### PostgreSQL connection refused

```powershell
# Проверить что контейнер запущен
docker ps | Select-String postgres

# Проверить логи
docker logs ng_postgres
```

### n8n не доступен

```powershell
# Проверить порт
Test-NetConnection localhost -Port 5678

# Проверить логи
docker logs ng_n8n
```

### Миграции не применяются

```powershell
# Проверить DATABASE_URL в .env.local
# Убедиться что PostgreSQL запущен
# Проверить права доступа
```

---

**Последнее обновление:** 2025-12-29T14:21:00+03:00
