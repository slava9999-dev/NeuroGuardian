# 💰 Система монетизации NeuroGUARDIAN

> **Статус:** 🟢 PRODUCTION READY
> **Интеграция:** YooKassa (API v3)
> **Тип:** Ежемесячная/Годовая подписка

---

## 📋 Тарифная сетка

| Тариф        | Цена (RU)   | Товаров | Магазинов (Аккаунтов) | Фичи             |
| ------------ | ----------- | ------- | --------------------- | ---------------- |
| **Trial**    | 0₽ / 7 дней | 10      | 1                     | Весь функционал  |
| **Basic**    | 999₽ / мес  | 50      | 1                     | -                |
| **Pro**      | 2999₽ / мес | 500     | 3                     | Приоритет        |
| **Business** | 9999₽ / мес | ∞       | 10                    | API, White Label |

_Скидка при оплате за год: **~17%** (фактически 2 месяца бесплатно)._

---

## 🔄 Схема работы платежа

1. **User** нажимает кнопку в Telegram WebApp (`SubscriptionPage.tsx`).
2. **Frontend** делает запрос `POST /api?action=create-payment` с `tier` и `billing_period`.
3. **Backend (`handleCreatePayment`)**:
   - Проверяет `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`.
   - Создает платеж в YooKassa API с `return_url`.
   - Сохраняет `payment_id` в таблице `payments` со статусом `pending`.
   - Возвращает ссылку на оплату.
4. **Переадресация**: Пользователь платит на сайте ЮKassa.
5. **Webhook**: YooKassa шлет `succeeded` на `/api?action=payment-webhook`.
6. **Обработка (`handlePaymentWebhook`)**:
   - Проверяет IP адреса YooKassa (White list).
   - Обновляет статус платежа в БД на `succeeded`.
   - **Активирует подписку** через `SubscriptionService`.
   - Шлет уведомление в Telegram: "✅ Оплата успешна!".

---

## 🛠 Управление и Администрирование

### Полезные SQL запросы (через Neon Console)

**Проверить последние платежи:**

```sql
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

**Проверить активные подписки:**

```sql
SELECT id, username, subscription_tier, subscription_expires_at
FROM users
WHERE subscription_active = true;
```

**Вручную выдать подписку (если нужно):**

```sql
UPDATE users
SET subscription_active = true,
    subscription_tier = 'pro',
    subscription_expires_at = NOW() + INTERVAL '1 month'
WHERE username = 'username';
```

---

## 🚨 Troubleshooting

**Проблема:** "Payment system unavailable" (503)
**Решение:** Проверьте переменные окружения в Vercel. Ключи YooKassa не заданы или некорректны.

**Проблема:** Платеж прошел, но подписка не активировалась.
**Решение:**

1. Проверьте логи Vercel (`handlePaymentWebhook`).
2. Убедитесь, что webhook URL в настройках YooKassa — верный (`https://neuro-guardian.vercel.app/api?action=payment-webhook`).
3. Проверьте IP фильтрацию, если YooKassa сменила адреса.

---
