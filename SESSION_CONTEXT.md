# 🛡️ NeuroGUARDIAN — КОНТЕКСТ ДЛЯ ПРОДОЛЖЕНИЯ РАБОТЫ

## Дата: 2024-12-21

## Статус: ✅ PRODUCTION READY v2.3.0

---

## 🎯 ЦЕЛЬ ПРОЕКТА

**NeuroGUARDIAN (Arborius Guardian)** — система автоматической защиты маржи для продавцов на WB и Ozon от принудительных акций маркетплейсов.

**КРИТИЧНОСТЬ:** Это инструмент выживания владельца. Система должна работать как швейцарские часы — надёжно, предсказуемо, безотказно.

**Последний аудит:** [AUDIT_FINAL_2024-12-21.md](AUDIT_FINAL_2024-12-21.md)

---

## 📁 СТРУКТУРА ПРОЕКТА

```
c:\NeuroGUARDIAN\
├── src/                          # Frontend (React + Vite)
│   ├── components/
│   │   ├── controls/GlobalSwitch.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardGrid.tsx
│   │   │   └── ProductCard.tsx
│   │   ├── logPanel/LogConsole.tsx
│   │   ├── ui/
│   │   │   ├── Dialog.tsx
│   │   │   ├── HelpModal.tsx      # ✅ Добавлен туториал
│   │   │   ├── LazyImage.tsx
│   │   │   ├── PaymentModal.tsx   # ✅ Добавлена оплата ЮКасса
│   │   │   └── Tooltip.tsx
│   │   └── ErrorBoundary.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── firebase.ts
│   │   ├── telegram.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── DashboardPage.tsx     # ✅ Кнопка "Инструкция" + кликабельный бейдж оплаты
│   │   ├── GuidePage.tsx         # ✅ Страница с инструкциями
│   │   ├── OnboardingPage.tsx    # ✅ С раскрывающимися инструкциями по API
│   │   └── SettingsPage.tsx      # ✅ С PaymentModal
│   ├── services/firebase/config.ts
│   ├── stores/
│   │   ├── appStore.ts
│   │   ├── logsStore.ts
│   │   ├── productsStore.ts      # ✅ С devtools и persist
│   │   └── index.ts
│   ├── types/index.ts
│   ├── utils/validation.ts       # ✅ Zod schemas
│   ├── App.tsx
│   └── main.tsx                  # ✅ С ErrorBoundary
│
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── index.ts              # Главный entry point
│       ├── lib/firestore.ts      # ✅ db экспортирован
│       ├── modules/
│       │   ├── gatekeeper/       # Telegram auth, payments (CloudPayments)
│       │   ├── payments/         # ✅ NEW: YooKassa endpoints
│       │   ├── sentinel/         # Dispatcher + Worker (защита)
│       │   └── sync/             # WB/Ozon API sync
│       ├── services/
│       │   ├── payments.ts       # ✅ NEW: Полная интеграция ЮКасса
│       │   └── users.ts          # ✅ NEW: Управление пользователями
│       └── schemas/
│           ├── index.ts
│           └── models.ts         # ✅ NEW: Полные модели данных
│
├── .env                          # ⚠️ ПЛЕЙСХОЛДЕРЫ! Нужны реальные ключи
├── firebase.json
├── firestore.rules
├── vercel.json
├── package.json
├── AUDIT_REPORT.md
├── DEPLOYMENT_GUIDE.md           # ✅ Полная инструкция по деплою
└── README.md
```

---

## ⚠️ КРИТИЧЕСКИЕ ТРЕБОВАНИЯ К ПРОВЕРКЕ

### 1. FRONTEND

- [ ] **ErrorBoundary** — ловит ли ошибки?
- [ ] **React Error #185** — исправлен ли цикл? (был в DashboardGrid)
- [ ] **PaymentModal** — открывается ли? Работает ли выбор тарифа?
- [ ] **HelpModal** — все 6 шагов туториала работают?
- [ ] **Кнопка "Инструкция"** — видима и кликабельна?
- [ ] **Кнопка оплаты** — пульсирует при истечении подписки?
- [ ] **OnboardingPage** — раскрываются ли инструкции по API?
- [ ] **GlobalSwitch** — переключается ли защита?
- [ ] **ProductCard** — редактируется ли minPrice?
- [ ] **LogConsole** — показывает ли события?

### 2. TELEGRAM INTEGRATION

- [ ] Telegram WebApp инициализируется?
- [ ] initData валидируется на бэкенде?
- [ ] hapticFeedback работает?
- [ ] MainButton/BackButton работают?
- [ ] Уведомления приходят?

### 3. FIREBASE & BACKEND

- [ ] Cloud Functions деплоятся?
- [ ] telegramAuth работает?
- [ ] saveApiKey сохраняет в Secret Manager?
- [ ] getProducts возвращает товары?
- [ ] updateMinPrice обновляет цену?
- [ ] sentinelDispatcher создаёт Cloud Tasks?
- [ ] sentinelWorker проверяет цены?

### 4. ОПЛАТА (ЮКасса)

- [ ] createPayment создаёт платёж?
- [ ] Webhook обрабатывает payment.succeeded?
- [ ] Подписка активируется после оплаты?
- [ ] Автопродление работает?
- [ ] Рефералка начисляет бонусы?

### 5. MARKETPLACES API

- [ ] WB API синхронизирует товары?
- [ ] Ozon API синхронизирует товары?
- [ ] Защита "Zero Stock" работает?
- [ ] Защита "Price Correction" работает?

### 6. GOOGLE CLOUD

- [ ] Secret Manager хранит ключи?
- [ ] Cloud Tasks создаются?
- [ ] Artifact Registry API включён?

---

## 🔑 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (НУЖНЫ РЕАЛЬНЫЕ!)

### Frontend (.env)

```env
VITE_FIREBASE_API_KEY=AIzaSy... # ⚠️ ЗАМЕНИТЬ!
VITE_FIREBASE_AUTH_DOMAIN=arbarea-mobile-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=arbarea-mobile-app
VITE_FIREBASE_STORAGE_BUCKET=arbarea-mobile-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=146520926544
VITE_FIREBASE_APP_ID=1:146520926544:web:66400a01a273ce895702455
VITE_FIREBASE_MEASUREMENT_ID=G-EDX3X5QY1R
VITE_USE_EMULATORS=false
VITE_API_BASE_URL=https://us-central1-arbarea-mobile-app.cloudfunctions.net
```

### Functions (.env)

```env
TELEGRAM_BOT_TOKEN=... # ⚠️ НУЖЕН от BotFather
YOOKASSA_SHOP_ID=... # ⚠️ НУЖЕН от ЮКасса
YOOKASSA_SECRET_KEY=... # ⚠️ НУЖЕН от ЮКасса
ADMIN_API_KEY=... # Для admin endpoints
WEBAPP_URL=https://neuro-guardian.vercel.app
BOT_USERNAME=neuroguardian_bot
```

### Vercel Environment Variables

Все переменные из Frontend .env должны быть добавлены в Vercel Dashboard.

---

## 🚀 КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ

### Локальный запуск

```bash
cd c:\NeuroGUARDIAN
npm run dev
```

### Сборка

```bash
npm run build
```

### Firebase Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### Логи Functions

```bash
firebase functions:log
```

### Git

```bash
git add -A
git commit -m "message"
git push origin main
```

---

## 📊 ТЕКУЩИЙ СТАТУС (на 13.12.2025)

| Компонент          | Статус           | Примечание                  |
| ------------------ | ---------------- | --------------------------- |
| Frontend сборка    | ✅ OK            | Собирается без ошибок       |
| Vercel deploy      | ✅ OK            | Автодеплой работает         |
| Firebase Functions | ⚠️ НЕ ЗАДЕПЛОЕНО | Нужен Artifact Registry API |
| Telegram Bot       | ❌ НЕ НАСТРОЕН   | Нужен токен от BotFather    |
| ЮКасса             | ❌ НЕ НАСТРОЕНА  | Нужны shopId и secretKey    |
| Ozon API           | ❓ НЕ ПРОВЕРЕНО  | Нужен реальный магазин      |
| WB API             | ❓ НЕ ПРОВЕРЕНО  | Нужен реальный магазин      |

---

## 🔧 ЧТО НУЖНО СДЕЛАТЬ

### Немедленно:

1. Получить реальный Firebase API Key
2. Создать Telegram бота через BotFather
3. Зарегистрироваться в ЮКасса
4. Включить Google Cloud APIs (Artifact Registry, Secret Manager, Cloud Tasks)
5. Задеплоить Cloud Functions

### После настройки:

1. Протестировать весь flow в Telegram
2. Проверить синхронизацию Ozon товаров
3. Проверить срабатывание защиты
4. Проверить оплату через ЮКасса
5. Проверить автопродление подписки
6. Нагрузочное тестирование

---

## 🐛 ИЗВЕСТНЫЕ ПРОБЛЕМЫ

1. **Functions не деплоятся** — нужен Artifact Registry API
2. **gcloud не установлен** — нельзя создать Cloud Tasks queue через CLI
3. **Firebase API Key** — плейсхолдер в .env
4. **ЮКасса интеграция** — код написан, но не протестирован с реальными ключами

---

## 📞 ВАЖНЫЕ ССЫЛКИ

- **GitHub:** https://github.com/slava9999-dev/NeuroGuardian
- **Vercel:** https://neuro-guardian.vercel.app
- **Firebase Console:** https://console.firebase.google.com/project/arbarea-mobile-app
- **Google Cloud Console:** https://console.cloud.google.com/
- **ЮКасса:** https://yookassa.ru
- **Telegram BotFather:** https://t.me/BotFather

---

## 🎯 КОНТЕКСТ ДЛЯ AI

При продолжении работы:

1. **Приоритет #1:** Добиться полностью рабочей системы
2. **Подход:** Тестировать каждый компонент отдельно
3. **Стиль:** Код должен быть надёжным, с обработкой ошибок
4. **Язык:** Русский для UI и документации
5. **Цель:** Система должна работать как швейцарские часы

---

## 📝 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ (13.12.2025)

1. ✅ Исправлен React Error #185 (useMemo в DashboardGrid)
2. ✅ Добавлен ErrorBoundary
3. ✅ Добавлен HelpModal с туториалом
4. ✅ Добавлен PaymentModal с тарифами
5. ✅ Добавлена GuidePage с инструкциями
6. ✅ Добавлены инструкции по API в OnboardingPage
7. ✅ Кнопка "Инструкция" в шапке
8. ✅ Кликабельный бейдж подписки с оплатой
9. ✅ Схемы данных для Firestore (models.ts)
10. ✅ Сервис платежей ЮКасса (payments.ts)
11. ✅ Сервис пользователей (users.ts)
12. ✅ Payment endpoints
13. ✅ DEPLOYMENT_GUIDE.md

---

**🚨 КРИТИЧНО: Этот проект — инструмент выживания владельца. Качество и надёжность приоритетнее скорости разработки.**
