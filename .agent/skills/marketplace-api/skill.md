---
name: Marketplace Intelligence
description: Навык работы с API маркетплейсов (Wildberries, Ozon) для синхронизации остатков, цен и аналитики.
triggers:
  - 'Обнови остатки'
  - 'Синхронизируй кабинет WB'
  - 'Какие продажи на Ozon?'
  - 'Добавь API ключ'
---

# 📊 Marketplace Intelligence Skill

## 🎯 Цель (Objective)

Обеспечение актуальности данных между NeuroGUARDIAN и личными кабинетами селлера на маркетплейсах.

## 🛠️ Инструментарий (Tools & Scripts)

- `src/api-lib/services/marketplace/WbService.ts`: Клиент для Wildberries (v2/v4 API).
- `src/api-lib/services/marketplace/OzonService.ts`: Клиент для Ozon Seller API.
- `src/api-lib/services/MarketplaceService.ts`: Унифицированный интерфейс для всех маркетплейсов.
- `scripts/diagnostic.ts`: Диагностика подключения к БД и наличия API ключей.
- `scripts/verify-keys.ts`: Проверка валидности API ключей (WB/Ozon) через внешний запрос.
- `scripts/test-marketplace-api.ts`: Верификация API ключей и доступа к методам.

## 📋 Протокол Действий (Workflow)

1. **Доступ**: Получить зашифрованные ключи из `MarketplaceAccountRepository`. Дешифровка происходит "на лету" (AES-256-GCM).
2. **Запрос**: Выполнить запрос к API. Для цен WB использовать `/api/v2/upload/task` (асинхронно).
3. **Парсинг**: Нормализовать ответ (например, `nm_id` или `product_id`) в стандарт `DBProduct`.
4. **Синхронизация**: При обновлении цен всегда ждать подтверждения от API или проверять историю задач (`history/tasks`).
5. **Безопасность**: При ошибке 401/403 помечать аккаунт как `isActive=false` и уведомлять пользователя через Telegram.

## ⚠️ Ограничения (Constraints)

- СТРОГО ЗАПРЕЩЕНО логировать API-ключи в plaintext.
- СОБЛЮДАТЬ Rate Limits: WB (10 req/min для некоторых методов), Ozon (зависит от API Key Tier).
- ЗАПРЕЩЕНО обновлять цены, если результирующая цена ниже `min_price` (Stop-Loss).
- Всегда использовать Proxy при массовых запросах к API.
