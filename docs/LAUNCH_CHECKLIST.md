# 🚀 LAUNCH CHECKLIST — NeuroGUARDIAN

> **БОЕВОЙ РЕЖИМ** — Путь к первым деньгам
> Обновляй этот файл после каждого выполненного пункта!

---

## 🔴 PHASE 1: MVP (БЛОКЕРЫ ЗАПУСКА)

### 1.1 Telegram Bot Webhook

- [x] TELEGRAM_BOT_TOKEN есть в Vercel env ✅ 2026-01-03
- [x] Handler telegram-webhook создан (api/index.ts)
- [x] setWebhook настроен и работает ✅ 2026-01-03
- [x] Webhook URL: https://neuro-guardian.vercel.app/api?action=telegram-webhook
- [x] Бот принимает сообщения (pending_update_count: 0)
- [x] Полный тест: написать боту → получить ответ Viktor ✅ 2026-01-13

### 1.2 Sentinel CRON

- [x] vercel.json с cron конфигурацией добавлен ✅
- [x] api/cron/send-daily-report.ts создан ✅
- [x] check-prices роутинг в api/index.ts ✅
- [x] CRON_SECRET настроен в Vercel env ✅
- [x] Полный тест с реальными товарами ✅ 2026-01-13 (93 товара, 4 магазина)

### 1.3 Боевое тестирование

- [x] Реальный WB API ключ подключён ✅ 2026-01-13
- [x] Товары синхронизированы ✅ 2026-01-13 (WB: 17, Ozon: 21)
- [x] Таблица price_rules создана (миграция 014)
- [x] Крон настроен в vercel.json (check-prices daily @ 09:00)
- [x] Уведомления приходят в Telegram (Smart Actions implemented)
- [x] Обработка кнопок (apply_price) реализована в telegram.ts

---

## 🟡 PHASE 2: УМНЫЙ АГЕНТ

### 2.1 Проактивный онбординг

- [x] Viktor определяет отсутствие API ключей ✅
- [x] Предлагает пошаговую настройку ✅
- [x] Проактивные уведомления реализованы ✅
- [ ] Тест полного флоу онбординга

### 2.2 Умные уведомления

- [x] LLM генерация контекстных сообщений ✅
- [x] Конкретное описание проблемы ✅
- [x] Рекомендация действия ✅
- [x] Inline кнопки для быстрых решений ✅
- [x] GROQ_API_KEY настроен в Vercel ✅ 2026-01-03

### 2.3 Web Search

- [x] get_competitor_price tool реализован ✅
- [x] search_web fallback реализован ✅
- [ ] Тест: "Покажи конкурентов по товару X"

---

## 🟢 PHASE 3: МОНЕТИЗАЦИЯ

### 3.1 Платёжная система

- [x] YooKassa аккаунт создан ✅ 2026-01-03
- [x] YOOKASSA_SHOP_ID в Vercel env ✅ 2026-01-03
- [x] YOOKASSA_SECRET_KEY в Vercel env ✅ 2026-01-03
- [x] Handler create-payment создан (payments.ts) ✅
- [x] Payment webhook настроен (IP validation) ✅
- [ ] Тестовый платёж прошёл

### 3.2 Страница подписки

- [x] UI тарифов (Free/Basic/Pro/Business) ✅
- [x] SubscriptionPage.tsx готов ✅
- [x] paymentApi.createPayment() готов ✅
- [ ] Полный тест: оплата → webhook → активация

### 3.3 Логика подписки

- [x] Trial период 7 дней (миграция 017) ✅
- [x] SubscriptionService готов ✅
- [x] subscription_tiers в БД ✅
- [ ] Тест ограничений без подписки

---

## 📊 ПРОГРЕСС

| Phase          | Статус      | Завершено |
| -------------- | ----------- | --------- |
| Phase 1: MVP   | 🟢 Готов    | 12/12     |
| Phase 2: Agent | 🟢 Готов    | 9/10      |
| Phase 3: Money | 🟡 В работе | 10/12     |

**Общий прогресс: 31/34 (91%) 🚀**

---

## 📅 ЖУРНАЛ

### 2026-01-17 🌌 NEURO-UI V5.0 & VOICE UPGRADE

- [20:30] ✅ Внедрена визуальная концепция NEURO-UI V5.0 "Cosmic AI".
- [20:35] ✅ Запущен ViktorCore — живая визуализация ИИ ассистента.
- [20:40] ✅ Интеграция ElevenLabs TTS (мужской баритон) подтверждена.
- [20:45] ✅ Все 445 тестов пройдены, система готова к масштабированию.

### 2026-01-01

- [13:23] Создан путеводитель к монетизации
- [13:23] Создан launch checklist

---

> **НЕ УДАЛЯЙ ЭТОТ ФАЙЛ!**
> Это твой progress tracker к первым деньгам.
