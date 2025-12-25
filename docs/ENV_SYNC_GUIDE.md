# 🔄 Автоматическая Синхронизация Переменных

## Способы добавления переменных в n8n

---

## ✅ Способ 1: Скрипт (Рекомендуется)

### Установка:

```bash
# 1. Установить зависимости
npm install node-fetch dotenv

# 2. Создать .env файл
cat > .env << EOF
N8N_URL=https://your-n8n.com
N8N_API_KEY=your-n8n-api-key
VERCEL_TOKEN=your-vercel-token
VERCEL_PROJECT_ID=your-project-id
EOF

# 3. Запустить синхронизацию
node scripts/sync-env-to-n8n.js
```

### Получить токены:

**n8n API Key:**

1. Открыть n8n → Settings → API
2. Generate new API key
3. Скопировать ключ

**Vercel Token:**

1. https://vercel.com/account/tokens
2. Create Token
3. Скопировать

**Vercel Project ID:**

```bash
vercel project ls
# Или в Vercel Dashboard → Settings → General
```

---

## 🔧 Способ 2: Vercel CLI + jq

```bash
#!/bin/bash
# sync-env.sh

# Получить переменные из Vercel
vercel env pull .env.production

# Конвертировать в n8n формат
cat .env.production | while IFS='=' read -r key value; do
  curl -X POST "https://your-n8n.com/api/v1/variables" \
    -H "X-N8N-API-KEY: your-api-key" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$key\",\"value\":\"$value\",\"type\":\"string\"}"
done
```

**Запуск:**

```bash
chmod +x sync-env.sh
./sync-env.sh
```

---

## 📦 Способ 3: n8n Workflow (Автоматический)

Создать workflow в n8n:

```
Cron (1x в день)
    ↓
HTTP: Get Vercel Env
    ↓
Loop Each Variable
    ↓
Set n8n Variable
```

**Ноды:**

### 1. HTTP: Get Vercel Env

```
GET https://api.vercel.com/v9/projects/{{$env.VERCEL_PROJECT_ID}}/env
Header: Authorization: Bearer {{$env.VERCEL_TOKEN}}
```

### 2. Loop

```javascript
{
  {
    $json.envs;
  }
}
```

### 3. Set Variable

```
POST {{$env.N8N_URL}}/api/v1/variables
Body: {
  "key": "{{$json.key}}",
  "value": "{{$json.value}}"
}
```

---

## 🎯 Способ 4: .env файл → n8n UI (Ручной)

```bash
# 1. Экспорт из Vercel
vercel env pull .env.production

# 2. Конвертировать в JSON
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.production', 'utf8');
const vars = env.split('\n')
  .filter(line => line.includes('='))
  .map(line => {
    const [key, ...value] = line.split('=');
    return { key, value: value.join('=') };
  });
console.log(JSON.stringify(vars, null, 2));
" > env-vars.json

# 3. Скопировать и вставить в n8n UI
cat env-vars.json
```

Затем в n8n:

- Settings → Variables
- Add Variable (для каждой)

---

## 🚀 Способ 5: GitHub Actions (CI/CD)

```yaml
# .github/workflows/sync-env.yml
name: Sync Env to n8n

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *' # Каждый день

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install deps
        run: npm install node-fetch dotenv

      - name: Sync variables
        env:
          N8N_URL: ${{ secrets.N8N_URL }}
          N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: node scripts/sync-env-to-n8n.js
```

---

## 📋 Какие переменные синхронизировать?

**Обязательные для n8n:**

```bash
CRON_SECRET
TELEGRAM_BOT_TOKEN
ADMIN_API_KEY
```

**Опциональные:**

```bash
OPENAI_API_KEY
ENCRYPTION_KEY
DATABASE_URL
KV_REST_API_URL
KV_REST_API_TOKEN
```

**НЕ синхронизировать (секреты):**

```bash
POSTGRES_PASSWORD
YOOKASSA_SECRET_KEY
```

---

## ⚡ Quick Start (Рекомендуемый путь)

```bash
# 1. Установить
npm install node-fetch dotenv

# 2. Настроить .env
echo "N8N_URL=https://your-n8n.com" > .env
echo "N8N_API_KEY=your-key" >> .env
echo "VERCEL_TOKEN=your-token" >> .env
echo "VERCEL_PROJECT_ID=prj_xxx" >> .env

# 3. Запустить
node scripts/sync-env-to-n8n.js

# 4. Проверить в n8n
# Settings → Variables → должны появиться переменные
```

---

## 🔍 Troubleshooting

**401 Unauthorized:**

- Проверить N8N_API_KEY
- Проверить VERCEL_TOKEN

**404 Not Found:**

- Проверить N8N_URL (без trailing slash)
- Проверить VERCEL_PROJECT_ID

**409 Conflict:**

- Переменная уже существует
- Скрипт автоматически обновит её

---

**Готово!** 🚀
