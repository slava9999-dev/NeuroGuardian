# ⚡ N8N QUICK START — 5 МИНУТ

**NeuroGUARDIAN** — Быстрый запуск автоматизации

---

## 🚀 ЗА 5 ШАГОВ

### 1️⃣ Настройка переменных (2 мин)

```bash
# Скопируйте пример
copy .env.n8n.example .env.n8n

# Откройте в редакторе
notepad .env.n8n
```

**Обязательно заполните:**

- `API_URL` — ваш Vercel URL
- `CRON_SECRET` — сгенерируйте:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `TELEGRAM_BOT_TOKEN` — от @BotFather
- `ADMIN_CHAT_ID` — ваш Telegram ID
- `N8N_BASIC_AUTH_PASSWORD` — сильный пароль

---

### 2️⃣ Запуск n8n (1 мин)

```bash
.\start-n8n.bat
```

Откроется http://localhost:5678

---

### 3️⃣ Первый вход (30 сек)

1. Создайте аккаунт
2. Логин: `admin` (из `.env.n8n`)
3. Пароль: ваш `N8N_BASIC_AUTH_PASSWORD`

---

### 4️⃣ Получение API ключа (1 мин)

1. **Settings** → **API**
2. **Create API Key**
3. Скопируйте ключ
4. Добавьте в `.env.n8n`:
   ```
   N8N_API_KEY=n8n_api_...
   ```

---

### 5️⃣ Импорт workflows (30 сек)

```bash
cd scripts
node import-all-workflows.cjs
```

**Результат:**

```
✅ Импортировано: 5/5 workflows
  NeuroGUARDIAN Sentinel - Price Defense
  NeuroGUARDIAN Product Sync
  NeuroGUARDIAN Analytics Report
  NeuroGUARDIAN Health Monitor
  NeuroGUARDIAN User Notifications
```

---

## ✅ АКТИВАЦИЯ WORKFLOWS

1. Откройте http://localhost:5678/home/workflows
2. Для каждого workflow:
   - Откройте workflow
   - Переключите **Active** в правом верхнем углу
   - Должен загореться зеленым

---

## 🧪 ТЕСТ

### Быстрый тест всех workflows:

```bash
# 1. Health check
curl http://localhost:3000/api?action=health

# 2. Запустите Analytics вручную в n8n
# Должно прийти сообщение в Telegram

# 3. Проверьте логи
docker-compose -f docker-compose.n8n.yml logs -f
```

---

## 📊 ЧТО ДАЛЬШЕ?

### Автоматически работают:

- ⚡ **Sentinel** — каждые 5 минут защищает цены
- 🔄 **Sync** — каждые 6 часов синхронизирует товары
- 📊 **Analytics** — в полночь отправляет отчет
- 🔍 **Monitor** — каждый час проверяет здоровье
- 📬 **Notifications** — каждые 12 часов напоминает о подписке

### Мониторинг:

- **Executions:** http://localhost:5678/executions
- **Workflows:** http://localhost:5678/home/workflows

---

## 🆘 ПРОБЛЕМЫ?

### n8n не запускается

```bash
# Проверьте Docker
docker ps

# Перезапустите
docker-compose -f docker-compose.n8n.yml restart
```

### Workflow не работает

1. Проверьте, что **Active** включен
2. Откройте **Executions** → смотрите ошибки
3. Проверьте `.env.n8n` — все переменные заполнены?

### Telegram не отправляет

1. Проверьте `TELEGRAM_BOT_TOKEN`
2. Напишите боту `/start`
3. Проверьте `ADMIN_CHAT_ID` (должен быть числом)

---

## 📚 ПОЛНАЯ ДОКУМЕНТАЦИЯ

См. **N8N_SETUP_GUIDE.md** для:

- Детального описания каждого workflow
- Troubleshooting
- Production deployment
- Мониторинг и метрики

---

## ✅ CHECKLIST

- [ ] `.env.n8n` заполнен
- [ ] n8n запущен (http://localhost:5678)
- [ ] API ключ получен и добавлен в `.env.n8n`
- [ ] 5 workflows импортированы
- [ ] Все workflows активированы (зеленые)
- [ ] Тестовый запуск Analytics прошел успешно
- [ ] Telegram сообщение получено

---

**🎉 ГОТОВО! Автоматизация работает 24/7**

_NeuroGUARDIAN Automation System v1.0.0_
