# Реализация упоминаний (Mentions) в Chat3

## Обзор

Упоминания (mentions) в Chat3 - это дополнительный список `userId` для дополнительной нотификации в виде update. С точки зрения архитектуры Chat3, это просто расширение существующей системы Events → Updates.

## Концепция

### 1. Хранение упоминаний

**Варианты реализации:**

**Вариант A: Meta теги (рекомендуется)**
- Хранить в `meta.mentions = [userId1, userId2]`
- Преимущества: гибкость, расширяемость, соответствует текущей архитектуре
- Недостатки: нужен парсинг meta тегов

**Вариант B: Отдельное поле в модели Message**
- Добавить поле `mentions: [userId1, userId2]` в модель Message
- Преимущества: явность, простота запросов
- Недостатки: изменение схемы БД

**Вариант C: Отдельная коллекция MessageMention**
- Создать коллекцию для хранения упоминаний с дополнительной информацией
- Преимущества: возможность хранить позиции в тексте, типы упоминаний
- Недостатки: усложнение архитектуры

**Рекомендация:** Вариант A (meta теги) - соответствует текущей архитектуре Chat3.

### 2. Создание события message.create

При создании сообщения с mentions:

1. Сохранить mentions в meta тегах сообщения: `meta.mentions = [userId1, userId2]`
2. В событии `message.create` добавить секцию `mentions` в `data`:

```json
{
  "message": { ... },
  "mentions": {
    "userIds": ["carl", "marta"],
    "count": 2
  }
}
```

### 3. Обработка в Update Worker

В `updateWorker.js` при обработке события `message.create`:

1. **Создать обычные updates** для участников диалога (как сейчас)
2. **Дополнительно создать updates** для упомянутых пользователей:
   - Проверить, что userId из mentions существует (опционально)
   - Создать update даже если пользователь не участник диалога (опционально)
   - Или создавать update только для упомянутых участников диалога

### 4. Структура Update для mentions

**Вариант A: Отдельный тип update (рекомендуется)**
- `eventType: "message.mention"` или `updateType: "mention"`
- Routing key: `user.{type}.{userId}.mention`
- Преимущества: можно подписаться только на mentions, более явная семантика

**Вариант B: Флаг в обычном message update**
- Обычный `message.create` update с флагом `data.context.isMention = true`
- Routing key: `user.{type}.{userId}.message`
- Преимущества: проще реализация
- Недостатки: менее гибко

**Рекомендация:** Вариант A - более явный и гибкий подход.

### 5. Логика создания Updates для mentions

В `updateUtils.js` добавить функцию `createMentionUpdate`:

1. Получить список userId из `eventData.mentions.userIds`
2. Для каждого userId:
   - Проверить существование пользователя (опционально)
   - Создать update с типом `message.mention`
   - Включить полную информацию о сообщении и диалоге
   - Добавить флаг `isMention: true` в context

**Особенности:**
- Упомянутый пользователь может не быть участником диалога - update все равно создается
- Если упомянутый пользователь уже участник - он получит два updates:
  - Обычный `message.create` (как участник)
  - `message.mention` (как упомянутый)
- Можно дедуплицировать: если пользователь участник, отправлять только mention update

### 6. Фильтрация и дедупликация

**Варианты:**

1. **Исключить упомянутых из обычных message updates**
   - Если пользователь упомянут, он получает только mention update
   - Если не упомянут, получает обычный message update

2. **Отправлять оба updates**
   - Участник получает обычный message update
   - Упомянутый получает дополнительный mention update

3. **Настройка на уровне tenant**
   - `settings.mentionStrategy = "replace" | "both"`
   - "replace" - только mention update для упомянутых
   - "both" - оба updates

**Рекомендация:** Вариант 1 (исключение) - избегает дублирования.

### 7. API изменения

В `POST /api/dialogs/{dialogId}/messages`:

1. Добавить опциональное поле `mentions: string[]` в request body
2. Валидация:
   - Массив userId
   - Проверка существования пользователей (опционально)
3. Сохранение в meta тегах: `meta.mentions = mentions`

**Пример запроса:**
```json
{
  "content": "Hello @carl and @marta!",
  "senderId": "john",
  "mentions": ["carl", "marta"]
}
```

### 8. Структура Update для mention

```json
{
  "tenantId": "tnt_default",
  "userId": "carl",  // упомянутый пользователь
  "dialogId": "dlg_...",
  "entityId": "msg_...",
  "eventId": "...",
  "eventType": "message.mention",
  "data": {
    "dialog": {
      "dialogId": "dlg_...",
      "name": "VIP чат",
      "meta": {}
    },
    "message": {
      "messageId": "msg_...",
      "dialogId": "dlg_...",
      "senderId": "john",
      "type": "internal.text",
      "content": "Hello @carl and @marta!",
      "meta": {
        "mentions": ["carl", "marta"]
      },
      "senderInfo": { ... }
    },
    "context": {
      "eventType": "message.mention",
      "dialogId": "dlg_...",
      "entityId": "msg_...",
      "messageId": "msg_...",
      "isMention": true,
      "includedSections": ["dialog", "message"]
    }
  }
}
```

### 9. RabbitMQ Routing

**Routing key для mentions:**
- `user.{type}.{userId}.mention` - отдельная подписка на mentions
- Или `user.{type}.{userId}.message` с фильтрацией по `isMention`

**Примеры routing keys:**
- `user.user.carl.mention` - mentions для пользователя carl
- `user.bot.bot1.mention` - mentions для бота bot1
- `user.contact.cnt_123.mention` - mentions для контакта cnt_123

### 10. Преимущества подхода

1. **Минимальные изменения** - использует существующую инфраструктуру Events → Updates
2. **Гибкость** - mentions в meta тегах, легко расширять
3. **Масштабируемость** - обработка через Update Worker
4. **Обратная совместимость** - mentions опциональны
5. **Разделение ответственности** - API сохраняет, Worker создает updates

### 11. Дополнительные возможности

#### Групповые упоминания
- `@all` - упомянуть всех участников диалога
- `@admins` - упомянуть только администраторов
- Расшифровка в Worker при обработке события

#### Типы упоминаний
- `direct` - прямое упоминание (@username)
- `reply` - ответ на сообщение (автоматическое упоминание)
- Хранение в meta тегах: `meta.mentionTypes = { "carl": "direct", "marta": "reply" }`

#### Уведомления
- Специальный флаг для push-уведомлений
- `meta.mentionNotify = true` - отправлять push-уведомление

#### Статистика
- Подсчет упоминаний пользователя
- API endpoint: `GET /api/users/{userId}/mentions`

## План реализации

### Фаза 1: Базовый функционал
1. Добавить поле `mentions` в API создания сообщения
2. Сохранять mentions в meta тегах сообщения
3. Добавить секцию `mentions` в событие `message.create`
4. Создать функцию `createMentionUpdate` в `updateUtils.js`
5. Обработать mentions в `updateWorker.js`

### Фаза 2: Оптимизация
1. Дедупликация updates (исключение упомянутых из обычных updates)
2. Валидация существования упомянутых пользователей
3. Настройки на уровне tenant

### Фаза 3: Расширенные возможности
1. Групповые упоминания (@all, @admins)
2. Типы упоминаний (direct, reply)
3. Статистика упоминаний
4. API для получения упоминаний пользователя

## Примеры использования

### Создание сообщения с упоминаниями

**Request:**
```http
POST /api/dialogs/dlg_123/messages
Content-Type: application/json
X-API-Key: your-api-key
X-TENANT-ID: tnt_default

{
  "content": "Hello @carl and @marta!",
  "senderId": "john",
  "mentions": ["carl", "marta"]
}
```

**Response:**
```json
{
  "data": {
    "messageId": "msg_...",
    "content": "Hello @carl and @marta!",
    "senderId": "john",
    "meta": {
      "mentions": ["carl", "marta"]
    }
  }
}
```

### Подписка на mentions через RabbitMQ

**Routing key:** `user.user.carl.mention`

**Update payload:**
```json
{
  "tenantId": "tnt_default",
  "userId": "carl",
  "dialogId": "dlg_...",
  "entityId": "msg_...",
  "eventType": "message.mention",
  "data": {
    "dialog": { ... },
    "message": { ... },
    "context": {
      "eventType": "message.mention",
      "isMention": true
    }
  }
}
```

## Заключение

Реализация mentions в Chat3 - это просто расширение существующей системы Events → Updates. Упоминания хранятся в meta тегах сообщения, обрабатываются через Update Worker и доставляются как отдельные updates с типом `message.mention`. Это позволяет внешним системам подписаться только на упоминания или обрабатывать их отдельно от обычных сообщений.

