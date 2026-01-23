# 🚀 Инструкция по настройке сервера NeuroGUARDIAN

Следуйте этим шагам после подключения к серверу через SSH (`ssh root@IP`).

## 1. Обновление и установка Docker, Node.js, Git

Скопируйте и вставьте этот блок команд целиком в терминал сервера:

```bash
# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем необходимые утилиты
apt install -y curl git unzip ufw build-essential

# Устанавливаем Node.js 20 (нужен для сборки фронтенда)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Устанавливаем Docker
curl -fsSL https://get.docker.com | sh

# Проверяем, что все установилось
docker --version
node -v
npm -v
```

## 2. Клонирование репозитория

```bash
# Переходим в домашнюю папку
cd /root

# Клонируем репозиторий (возможно потребуется ввести логин/пароль от GitHub, или настроить SSH ключи)
git clone https://github.com/slava9999-dev/NeuroGuardian.git

# Переходим в папку проекта
cd NeuroGuardian
```

## 3. Настройка переменных окружения (.env)

Вам нужно создать файл `.env` с секретами.
На сервере выполните:

```bash
nano .env
```

Откроется редактор. Скопируйте содержимое вашего локального файла `.env` (он у вас на компьютере) и вставьте туда (обычно правой кнопкой мыши).
**Важно:** Убедитесь, что там есть переменные:

- `POSTGRES_PASSWORD=...` (придумайте сложный пароль)
- `TELEGRAM_BOT_TOKEN=...`
- `CRON_SECRET=...`

Нажмите `Ctrl+X`, затем `Y`, затем `Enter` чтобы сохранить.

## 4. Сборка и Запуск

```bash
# Устанавливаем зависимости
npm install

# Собираем фронтенд (создастся папка dist)
npm run build

# Запускаем Docker
cd docker/production
docker compose up -d --build
```

## 5. Проверка

После запуска проверьте статус:

```bash
docker compose ps
```

Ваш сайт должен открываться по IP адресу сервера: `http://ВАШ_IP_SERVERA`

```

```
