# 📱 NeuroGUARDIAN — Описание UI Интерфейсов

## 🏗️ Архитектура Frontend

**Stack:** React 18 + TypeScript + Framer Motion + Zustand
**Deploy:** Telegram WebApp (Mini App)
**Стиль:** Dark theme, stone/violet цвета, glassmorphism

---

## 📂 Структура Страниц

```
src/
├── App.tsx              # Главный роутер + Bottom Tab Bar
├── pages/
│   ├── AgentPage.tsx     # 🤖 Чат с AI-агентом (ГЛАВНАЯ)
│   ├── ProductsPage.tsx  # 📦 Список товаров + Unit-экономика
│   ├── SettingsPage.tsx  # ⚙️ Настройки + API ключи
│   ├── SubscriptionPage  # 💳 Тарифы и оплата
│   ├── GodModePage.tsx   # 🔒 Admin панель (ReactFlow визуализация)
│   ├── OpsPanelPage.tsx  # 📊 Операционный дашборд
│   └── LegalPage.tsx     # 📋 Юридическая информация
├── components/
│   ├── dashboard/        # Компоненты дашборда
│   │   ├── ProductCard.tsx         # Карточка товара
│   │   ├── BulkStopLossModal.tsx   # Массовый Stop-Loss
│   │   ├── BulkUpdateCostsModal.tsx # Массовое обновление себест.
│   │   ├── PriceCalculator.tsx     # Калькулятор Unit-экономики
│   │   ├── LogHistory.tsx          # История Sentinel
│   │   ├── SentinelDashboard.tsx   # Статистика защиты
│   │   └── ProductMediaManager.tsx # Управление медиа (SMM)
│   └── ui/               # UI компоненты
│       ├── HelpModal.tsx
│       ├── SecurityBadge.tsx
│       └── ...
└── stores/               # Zustand state management
    ├── appStore.ts       # User, auth state
    └── productsStore.ts  # Products state
```

---

## 📱 СТРАНИЦА 1: AgentPage (Главная)

**Путь:** `src/pages/AgentPage.tsx` (~800 строк)
**Назначение:** Чат-интерфейс с AI-агентом Виктором

### UI Элементы:

1. **Header** - Аватар агента + статус "Online"
2. **Chat Area** - Scrollable список сообщений
3. **Quick Actions** - Быстрые кнопки под чатом:
   - 📊 "Статистика"
   - 🔒 "Защита"
   - 💰 "Unit-экономика"
   - 📦 "Синхронизация"
4. **Input Area** - Текстовое поле + кнопки:
   - 🎤 Голосовой ввод (Web Speech API)
   - 📎 Файл (для загрузки изображений)
   - ➤ Отправить

### Ключевые функции:

```typescript
handleSendMessage(text: string)    // Отправка в agentApi
handleConfirmation(id, confirmed)  // Подтверждение опасных действий
handleVoiceClick()                 // Голосовой ввод
handleFileChange()                 // Загрузка файла
```

### Состояние:

```typescript
messages: ChatMessage[]          // История чата
input: string                    // Текущий ввод
isLoading: boolean               // AI думает
isListening: boolean             // Голосовой ввод
```

### API:

```typescript
agentApi.chat({ message, userId, threadId });
agentApi.confirm({ threadId, messageId, confirmed });
```

---

## 📱 СТРАНИЦА 2: ProductsPage

**Путь:** `src/pages/ProductsPage.tsx` (~245 строк)
**Назначение:** Список товаров с фильтрами и батч-операциями

### UI Элементы:

1. **Header** - "Товары" + кнопка "Назад"
2. **Summary Cards** - Статистика:
   - Всего товаров
   - Под защитой
   - Сэкономлено ₽
3. **Filters** - Маркетплейс (WB/Ozon/Все)
4. **Product Grid** - Сетка ProductCard
5. **Batch Actions** - Модалки:
   - BulkStopLossModal
   - BulkUpdateCostsModal

### Компоненты:

- **ProductCard.tsx** - Карточка товара:
  - Фото, название, цена
  - Stop-Loss индикатор
  - Статус защиты
  - Кнопки: Edit минимальную цену, Open медиа

---

## 📱 СТРАНИЦА 3: SettingsPage

**Путь:** `src/pages/SettingsPage.tsx` (~880 строк)
**Назначение:** Настройки пользователя и API ключи

### Секции:

1. **Профиль** - Аватар, имя, Telegram ID
2. **Подписка** - Текущий тариф, дата окончания, кнопка "Управлять"
3. **API Ключи** - Карточки WB и Ozon:
   - Поле ввода API ключа (маскированное)
   - "Подключить" / "Отключить"
   - Статус синхронизации
4. **Режим защиты** - Radio buttons:
   - `notify_only` - Только уведомления
   - `price_correction` - Автоматическая коррекция
   - `zero_stock` - Обнуление остатков
5. **Буферы защиты** - Sliders:
   - Card Discount Buffer (5-20%)
   - Warning Threshold (5-30%)
6. **Дополнительно** - Кнопки:
   - "God Mode" (для админов)
   - "Ops Panel" (для админов)
   - "Юридическая информация"

### API:

```typescript
marketplaceAccountsApi.get()           // Загрузить аккаунты
marketplaceAccountsApi.save({...})     // Сохранить ключи
productsApi.sync(marketplace)          // Синхронизировать товары
settingsApi.update({...})              // Обновить настройки
```

---

## 📱 СТРАНИЦА 4: SubscriptionPage

**Путь:** `src/pages/SubscriptionPage.tsx` (~275 строк)
**Назначение:** Выбор и оплата тарифа

### Тарифы (TIERS):

| ID       | Название | Цена      | Товаров | Магазинов |
| -------- | -------- | --------- | ------- | --------- |
| free     | Старт    | 0₽        | 10      | 1         |
| basic    | Базовый  | 999₽/мес  | 100     | 2         |
| pro      | Про      | 2999₽/мес | 500     | 5         |
| business | Бизнес   | 9999₽/мес | ∞       | 10        |

### UI:

1. **Header** - "Тарифы"
2. **Tier Cards** - Вертикальный список карточек:
   - Название
   - Цена
   - Список фич
   - Кнопка "Подключить"
   - Badge "Популярный" для Pro

### API:

```typescript
paymentApi.createPayment({ tier, billingPeriod, returnUrl });
```

---

## 📱 СТРАНИЦА 5: GodModePage (Admin)

**Путь:** `src/pages/GodModePage.tsx` (~371 строк)
**Назначение:** Визуализация системы для администраторов

### UI:

1. **System Status Cards**:
   - Database (latency, status)
   - Sentinel (lastRun, products)
   - LLM (available, latency)
2. **ReactFlow Graph** - Визуализация архитектуры
3. **Emergency Controls**:
   - "Run Sentinel Now" кнопка
   - "Emergency Stop" кнопка

### Зависимости:

```typescript
import ReactFlow from 'reactflow';
import { Activity, Shield, Cpu, Server } from 'lucide-react';
```

---

## 📱 СТРАНИЦА 6: OpsPanelPage

**Путь:** `src/pages/OpsPanelPage.tsx` (~900 строк)
**Назначение:** Операционный мониторинг

### Секции:

1. **Overview** - Ключевые метрики
2. **Events Log** - Список событий системы
3. **Clients** - Список пользователей (для поддержки)
4. **Audit Trail** - История действий

---

## 🧩 КЛЮЧЕВЫЕ КОМПОНЕНТЫ

### ProductCard.tsx

```typescript
interface ProductCardProps {
  product: Product;
  onEdit: (id, minPrice) => void;
  onMediaClick?: () => void;
}
```

- Показывает: фото, название, цену, маркетплейс
- Статус защиты (защищён/не настроен)
- Кнопка редактирования Stop-Loss

### PriceCalculator.tsx

- Полноценный калькулятор Unit-экономики
- Inputs: себестоимость, цена, объём, категория
- Outputs: комиссия WB, логистика, прибыль, маржа

### SentinelDashboard.tsx

- Статистика Sentinel за период
- График активаций
- Сумма сэкономленных денег

---

## 🎨 СТИЛИСТИКА

### Цветовая палитра:

- **Background:** `stone-900`, `stone-800`
- **Primary:** `violet-500`, `violet-400`
- **Success:** `emerald-400`, `emerald-500`
- **Warning:** `amber-400`, `amber-500`
- **Danger:** `rose-500`, `rose-400`
- **Text:** `white`, `stone-300`, `stone-400`

### Анимации (Framer Motion):

```typescript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

### Glassmorphism:

```css
bg-stone-800/80 backdrop-blur-lg border border-stone-700/50
```

---

## 📡 API ИНТЕГРАЦИЯ

### Файлы:

- `src/lib/api.ts` - Основные API вызовы
- `src/lib/agentApi.ts` - Agent V5 API

### Endpoints используемые UI:

| Action         | Endpoint                          | Описание             |
| -------------- | --------------------------------- | -------------------- |
| auth           | `POST /api?action=auth`           | Авторизация Telegram |
| products       | `GET /api?action=products`        | Список товаров       |
| sync-products  | `POST /api?action=sync-products`  | Синхронизация        |
| settings       | `GET/POST /api?action=settings`   | Настройки            |
| agent-v5       | `POST /api?action=agent-v5`       | Чат с агентом        |
| create-payment | `POST /api?action=create-payment` | Создание платежа     |

---

## 🚀 ЧТО МОЖНО УЛУЧШИТЬ

### 1. Добавить SMM-интерфейс

- Кнопка "📸 Генерировать контент" на ProductCard
- Модалка выбора платформы (Instagram/Telegram/WB desc)
- Превью сгенерированного контента

### 2. Dashboard Alert для убыточных товаров

- Баннер наверху ProductsPage: "⚠️ 5 товаров торгуются в минус"
- Фильтр "Показать убыточные"

### 3. Mobile-First улучшения

- Swipe-to-action на ProductCard
- Pull-to-refresh на ProductsPage
- Bottom Sheet модалки вместо обычных

### 4. Onboarding Flow

- Пошаговый мастер для новых пользователей
- Подключение API ключей с подсказками
- Первый запуск Sentinel с объяснениями
