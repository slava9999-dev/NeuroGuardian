# 📋 __ТЗ: Исследование Ozon Seller API для NeuroGUARDIAN

## 🎯 Цель

Найти рабочий способ получения текущих цен товаров продавца через Ozon Seller API.

## 📌 Контекст проблемы

### Текущая ситуация:

- **Проект**: NeuroGUARDIAN - автоматизированный мониторинг цен для селлеров на маркетплейсах
- **Проблема**: Все известные эндпоинты Ozon Prices API возвращают `404 page not found`
- **Workaround**: Используем цены из БД (обновляются через sync), но нужно real-time решение

### Проверенные эндпоинты (все возвращают 404):

1. `POST https://api-seller.ozon.ru/v1/product/info/prices`
2. `POST https://api-seller.ozon.ru/v2/product/info/prices`
3. `POST https://api-seller.ozon.ru/v3/product/info/prices`
4. `POST https://api-seller.ozon.ru/v4/product/info/prices`
5. `POST https://api-seller.ozon.ru/v3/product/info/list` (работает, но 0 цен)

### Используемые заголовки:

```http
Content-Type: application/json
Client-Id: [CLIENT_ID]
Api-Key: [API_KEY]
```

### Пример запроса:

```json
{
  "product_id": [12345, 67890]
}
```

## 🔍 Задачи для исследования

### 1. Актуальный эндпоинт Ozon Prices API (2024-2025)

- Найти официальную документацию Ozon Seller API
- Проверить актуальные версии API (v5, v6?)
- Найти примеры рабочих запросов на GitHub, StackOverflow, форумах

### 2. Возможные причины 404:

- Изменились URL эндпоинтов?
- Добавились новые обязательные параметры?
- Нужна специальная активация API в кабинете продавца?
- Проблемы с типом аккаунта (FBS/FBO/realFBS)?

### 3. Альтернативные способы получения цен:

- Через `/v3/product/info/list` - какие поля там есть?
- Через `/v1/product/list` + `/v2/product/info`?
- Парсинг из карточки товара?
- Использование Ozon Performance API?

### 4. Известные проблемы и решения:

- Поиск на форумах разработчиков Ozon
- Telegram-чаты интеграторов
- GitHub issues в проектах интеграции с Ozon

## 📚 Источники для поиска

1. **Официальная документация**: https://docs.ozon.ru/api/seller
2. **Postman коллекции**: https://www.postman.com/ozon-seller/
3. **GitHub**: поиск по "ozon seller api prices"
4. **StackOverflow**: тег [ozon-api]
5. **Telegram**: чаты разработчиков/интеграторов Ozon
6. **Habr**: статьи про интеграцию с Ozon

## ✅ Ожидаемый результат

1. Рабочий эндпоинт для получения цен товаров
2. Пример JSON запроса и ответа
3. Список обязательных параметров
4. Любая информация о rate limits и ограничениях

## 📝 Формат ответа

````markdown
## Найденное решение

### Эндпоинт:

POST https://api-seller.ozon.ru/v?/...

### Request Headers:

...

### Request Body:

```json
{...}
```
````

### Response:

```json
{...}
```

### Источник:

[ссылка]

```

---
**Дата создания**: 2025-01-05
**Приоритет**: HIGH
**Статус**: OPEN
```
__