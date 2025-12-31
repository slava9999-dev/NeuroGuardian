# 🚀 ПОЛНАЯ ИНСТРУКЦИЯ РАЗВЁРТЫВАНИЯ NeuroGUARDIAN

## Содержание

1. [Firebase](#1-firebase)
2. [Telegram Bot](#2-telegram-bot)
3. [Ozon API](#3-ozon-api)
4. [WB API](#4-wb-api-опционально)
5. [ЮКасса / CloudPayments](#5-юкасса--cloudpayments)
6. [Google Cloud](#6-google-cloud)
7. [Vercel](#7-vercel)
8. [Финальная настройка](#8-финальная-настройка)

---

## 1. FIREBASE

### 1.1 Создание проекта (если нет)

1. Открой [Firebase Console](https://console.firebase.google.com/)
2. Нажми **"Создать проект"**
3. Введи имя: `neuroguardian` или `arbarea-mobile-app`
4. Включи Google Analytics (опционально)

### 1.2 Получение API ключей

1. ⚙️ **Project Settings** → **General**
2. Прокрути до **"Your apps"**
3. Нажми **"Add app"** → выбери **Web** (</🌐>)
4. Зарегистрируй приложение
5. Скопируй конфигурацию:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...", // ← ЭТОТ КЛЮЧ
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc",
  measurementId: "G-XXX",
};
```

### 1.3 Включение Firestore

1. **Build** → **Firestore Database**
2. Нажми **"Create database"**
3. Выбери **Production mode**
4. Выбери регион: `us-central1` или `europe-west1`

### 1.4 Включение Cloud Functions

1. **Build** → **Functions**
2. Нажми **"Get started"**
3. Выбери план **Blaze** (pay-as-you-go) — требуется для Cloud Functions

---

## 2. TELEGRAM BOT

### 2.1 Создание бота

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. Отправь `/newbot`
3. Введи имя: `NeuroGUARDIAN`
4. Введи username: `neuroguardian_bot` (должен заканчиваться на `_bot`)
5. Скопируй **BOT TOKEN**:

```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 2.2 Настройка Mini App

1. Отправь `/mybots` в BotFather
2. Выбери своего бота
3. **Bot Settings** → **Menu Button** → **Configure menu button**
4. Введи URL: `https://neuro-guardian.vercel.app` (твой Vercel URL)
5. Введи текст кнопки: `Открыть`

### 2.3 Настройка Inline Mode (опционально)

1. В BotFather: **Bot Settings** → **Inline Mode** → **Turn on**

### 2.4 Получение Webhook Secret

1. Сгенерируй случайную строку (32 символа):

```
openssl rand -hex 16
```

Или просто придумай: `mySecretWebhook123abc`

---

## 3. OZON API

### 3.1 Получение ключей

1. Открой [seller.ozon.ru](https://seller.ozon.ru)
2. Войди в личный кабинет
3. **Настройки** (⚙️) → **API ключи**
4. Нажми **"Создать ключ"**
5. Скопируй:
   - **Client ID**: `123456`
   - **API-ключ**: `abc123-def456-...`

### 3.2 Необходимые права

При создании ключа выбери:

- ✅ Товары и цены (Products)
- ✅ Склады и остатки (Stocks)
- ✅ Аналитика (Analytics) — опционально

---

## 4. WB API (опционально)

### 4.1 Получение ключей

1. Открой [seller.wildberries.ru](https://seller.wildberries.ru)
2. **Профиль** → **Настройки** → **Доступ к API**
3. Нажми **"Создать новый токен"**
4. Выбери права:
   - ✅ Контент
   - ✅ Цены
   - ✅ Склад
5. Скопируй токен (показывается только 1 раз!)

---

## 5. ЮКАССА / CLOUDPAYMENTS

### Вариант A: ЮКасса (YooKassa)

#### 5.1 Регистрация

1. Открой [yookassa.ru](https://yookassa.ru)
2. Зарегистрируйся как ИП или ООО
3. Пройди верификацию (1-3 дня)

#### 5.2 Получение ключей

1. **Настройки** → **API ключи**
2. Скопируй:
   - **Shop ID**: `123456`
   - **Secret Key**: `test_xxx` или `live_xxx`

#### 5.3 Настройка Webhook

1. **Настройки** → **Уведомления**
2. Добавь URL: `https://us-central1-YOUR-PROJECT.cloudfunctions.net/paymentWebhook`
3. Выбери события: `payment.succeeded`, `payment.canceled`, `refund.succeeded`

---

### Вариант B: CloudPayments

#### 5.1 Регистрация

1. Открой [cloudpayments.ru](https://cloudpayments.ru)
2. Зарегистрируйся

#### 5.2 Получение ключей

1. **Настройки сайта** → **API**
2. Скопируй:
   - **Public ID**: `pk_xxx`
   - **API Secret**: `xxx`

---

## 6. GOOGLE CLOUD

### 6.1 Включение API

Открой [Google Cloud Console](https://console.cloud.google.com) и включи API:

1. **Secret Manager API**:

   - https://console.cloud.google.com/apis/library/secretmanager.googleapis.com

2. **Cloud Tasks API**:

   - https://console.cloud.google.com/apis/library/cloudtasks.googleapis.com

3. **Artifact Registry API**:
   - https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com

### 6.2 Создание очереди Cloud Tasks

В терминале (если установлен gcloud):

```bash
gcloud tasks queues create sentinel-worker-queue --location=us-central1
```

Или через консоль:

1. Открой [Cloud Tasks](https://console.cloud.google.com/cloudtasks)
2. **Create Queue**
3. Имя: `sentinel-worker-queue`
4. Регион: `us-central1`

---

## 7. VERCEL

### 7.1 Подключение репозитория

1. Открой [vercel.com](https://vercel.com)
2. **Add New** → **Project**
3. **Import Git Repository** → выбери `NeuroGuardian`
4. Настройки:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 7.2 Environment Variables

В **Settings** → **Environment Variables** добавь:

| Переменная                          | Значение                                     | Описание               |
| ----------------------------------- | -------------------------------------------- | ---------------------- |
| `VITE_FIREBASE_API_KEY`             | `AIzaSy...`                                  | Firebase API ключ      |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `xxx.firebaseapp.com`                        | Firebase Auth Domain   |
| `VITE_FIREBASE_PROJECT_ID`          | `arbarea-mobile-app`                         | ID проекта             |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `xxx.appspot.com`                            | Storage bucket         |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789`                                  | Sender ID              |
| `VITE_FIREBASE_APP_ID`              | `1:123:web:abc`                              | App ID                 |
| `VITE_FIREBASE_MEASUREMENT_ID`      | `G-XXX`                                      | Analytics ID           |
| `VITE_API_BASE_URL`                 | `https://us-central1-xxx.cloudfunctions.net` | URL Cloud Functions    |
| `VITE_USE_EMULATORS`                | `false`                                      | Использовать эмуляторы |

---

## 8. ФИНАЛЬНАЯ НАСТРОЙКА

### 8.1 Файл .env для Functions

Создай `functions/.env`:

```env
# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Payments (CloudPayments)
CLOUDPAYMENTS_PUBLIC_ID=pk_xxx
CLOUDPAYMENTS_API_SECRET=xxx

# ИЛИ ЮКасса
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=live_xxx

# Google Cloud
GOOGLE_CLOUD_PROJECT=arbarea-mobile-app
FUNCTIONS_REGION=us-central1
TASKS_QUEUE_NAME=sentinel-worker-queue
```

### 8.2 Деплой Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 8.3 Настройка Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 8.4 Обновление Telegram Webhook

После деплоя функций, установи webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://us-central1-<PROJECT_ID>.cloudfunctions.net/telegramWebhook"
```

---

## 📋 ИТОГОВЫЙ ЧЕКЛИСТ

| Сервис                   | Что получить        | Куда добавить         |
| ------------------------ | ------------------- | --------------------- |
| **Firebase**             | API Key, Project ID | `.env`, Vercel        |
| **Telegram**             | Bot Token           | `functions/.env`      |
| **Ozon**                 | Client ID, API Key  | Вводится в приложении |
| **WB**                   | API Token           | Вводится в приложении |
| **ЮКасса/CloudPayments** | Shop ID, Secret     | `functions/.env`      |
| **Google Cloud**         | Включить APIs       | Console               |

---

## 🔗 ПОЛЕЗНЫЕ ССЫЛКИ

- [Firebase Console](https://console.firebase.google.com/)
- [Telegram BotFather](https://t.me/BotFather)
- [Ozon Seller](https://seller.ozon.ru)
- [WB Seller](https://seller.wildberries.ru)
- [ЮКасса](https://yookassa.ru)
- [CloudPayments](https://cloudpayments.ru)
- [Google Cloud Console](https://console.cloud.google.com)
- [Vercel Dashboard](https://vercel.com)

---

## ❓ ПОДДЕРЖКА

Если возникли проблемы:

1. Проверь логи: `firebase functions:log`
2. Проверь консоль браузера (F12)
3. Проверь Vercel Logs в Dashboard

---

**Удачного запуска! 🚀**
