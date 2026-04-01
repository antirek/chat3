# API Документация Chat3

## Базовый URL

```
http://localhost:3000/api
```

## Аутентификация

Все API запросы требуют заголовок `X-API-Key`:

```http
X-API-Key: your-api-key-here
X-Tenant-ID: tnt_default
```

### Генерация API ключа

```bash
npm run generate-key
```

## Общие заголовки

- `X-API-Key` (обязательно) - API ключ для аутентификации
- `X-Tenant-ID` (опционально) - ID тенанта, по умолчанию `tnt_default`
- `X-Idempotency-Key` (опционально) - Ключ для идемпотентности запросов

## Формат ответов

### Успешный ответ

```json
{
  "data": { ... },
  "message": "Опциональное сообщение"
}
```

### Ошибка

```json
{
  "error": "Error Type",
  "message": "Описание ошибки"
}
```

## Пагинация

Большинство endpoints поддерживают пагинацию:

- `page` - номер страницы (по умолчанию: 1)
- `limit` - количество элементов на странице (по умолчанию: 10-50)

Ответ с пагинацией:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Фильтрация

Поддерживается два формата фильтров:

### 1. JSON формат

```json
{
  "meta": {
    "type": "internal"
  }
}
```

### 2. Операторный формат (рекомендуется)

```
(field,operator,value)
```

**Операторы:**
- `eq` - равно
- `ne` - не равно
- `in` - в массиве: `(type,in,[user,bot])`
- `nin` - не в массиве
- `gt` - больше
- `gte` - больше или равно
- `lt` - меньше
- `lte` - меньше или равно
- `regex` - регулярное выражение
- `exists` - существование поля

**Комбинирование (AND):**
```
(meta.type,eq,internal)&(meta.channelType,ne,telegram)
```

**ИЛИ (OR) и группировка скобками:**
- Условия можно объединять через `&` (И) и `|` (ИЛИ).
- Группировка задаётся **только скобками**; внутри одной группы допускается один тип оператора (`&` или `|`).
- При одновременном использовании `&` и `|` скобки обязательны. Недопустимо: `a&b|c` без скобок.
- Лимит **5**: не более 5 веток в `$or` и не более 5 операндов в одной группе. При превышении запрос отклоняется с ошибкой валидации.
- Недопустимые формы (смешанные операторы в одной группе без скобок, превышение лимита) возвращают ошибку 400 (Filter validation failed).
- JSON в параметре `filter` не поддерживается (используйте операторный формат).

**Примеры с ИЛИ:**
- `(meta.name,eq,a)|(meta.name,eq,b)` — meta.name равен a или b
- `((meta.type,eq,internal)&(meta.channelType,eq,whatsapp))|(meta.name,eq,personal)` — (type=internal и channel=whatsapp) или name=personal

**Примеры:**
- `(userId,eq,cnt_72a454kho)` - точное совпадение
- `(name,regex,^John)` - имя начинается с John
- `(type,in,[user,bot])` - тип в списке
- `(meta.role,eq,manager)` - фильтр по meta тегу

**Алфавит meta-ключа:**  
Ключ meta может содержать только буквы (a–z, A–Z), цифры и подчёркивание. Точка и дефис запрещены; в качестве разделителя используйте подчёркивание (например, `contact_phone`). Ограничение действует во всех endpoint'ах: PUT/DELETE meta, body с полем `meta` (диалог, сообщение, топик, tenant и т.д.), а также в параметре `filter`. Недопустимые ключи приводят к 400 (Bad Request или Filter validation failed).

**Где применяется:** один и тот же синтаксис фильтра (операторы, AND/OR, группировка скобками, лимиты) используется во всех endpoint'ах, принимающих query-параметр `filter`: пользователи, диалоги, сообщения, топики, участники диалогов, диалоги пользователя.

## Endpoints

### Tenants (Организации)

#### GET /api/tenants
Получить список организаций

**Query параметры:**
- `page` - номер страницы
- `limit` - количество на странице

#### GET /api/tenants/:id
Получить организацию по ID

#### POST /api/tenants
Создать организацию

**Body:**
```json
{
  "tenantId": "tnt_myorg",
  "name": "My Organization",
  "domain": "myorg.chat3.com",
  "type": "client",
  "isActive": true
}
```

#### PUT /api/tenants/:id
Обновить организацию

#### DELETE /api/tenants/:id
Удалить организацию

---

### Users (Пользователи)

#### GET /api/users
Получить список пользователей

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр (например: `(userId,eq,carl)`)
- `sort` - сортировка в формате JSON: `{"createdAt":-1}`

**Примеры фильтров:**
- `(userId,eq,carl)` - пользователь с userId = carl
- `(type,in,[user,bot])` - пользователи типа user или bot
- `(name,regex,^John)` - имя начинается с John
- `(meta.role,eq,manager)` - фильтр по meta тегу

**Ответ включает:**
- `dialogCount` - общее количество активных диалогов пользователя (всегда включено)
- `unreadDialogsCount` - количество диалогов с непрочитанными сообщениями (всегда включено)

#### GET /api/users/:userId
Получить пользователя по userId

#### POST /api/users
Создать пользователя

**Body:**
```json
{
  "userId": "carl",
  "name": "Carl Johnson",
  "type": "user"
}
```

**Валидация:**
- `userId` не может содержать точку (`.`)
- `type` по умолчанию: `user`

#### PUT /api/users/:userId
Обновить пользователя

**Body:**
```json
{
  "name": "New Name",
  "type": "bot"
}
```

#### DELETE /api/users/:userId
Удалить пользователя

**Примечания:**
- Удаляет пользователя из системы
- Удаляет все связи пользователя с диалогами (DialogMember)

---

### Dialogs (Диалоги)

#### GET /api/dialogs
Получить список диалогов

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в операторном формате (AND/OR и группировка скобками — см. раздел «Фильтрация»)
- `sort` - сортировка

**Примеры фильтров:**
- `(meta.type,eq,internal)` - диалоги типа internal
- `(meta.channelType,eq,whatsapp)` - WhatsApp диалоги
- `(dialogId,eq,dlg_...)` - конкретный диалог
- `(meta.type,eq,internal)|(meta.type,eq,support)` - диалоги типа internal или support

#### GET /api/dialogs/:id
Получить диалог по ID

**Ответ включает:**
- Основные данные диалога (dialogId, tenantId, name, createdAt и т.д.)
- `meta` - мета-теги диалога
- `memberCount` - количество участников диалога
- `stats` - статистика диалога:
  - `topicCount` - количество топиков
  - `memberCount` - количество участников
  - `messageCount` - количество сообщений

**Примечания:**
- Ответ имеет вид `{ data: dialog }`. Не возвращает массивы `topics` и `members` — для топиков используйте `GET /api/dialogs/:dialogId/topics`, для участников — `GET /api/dialogs/:dialogId/members`
- Статистика берется из `DialogStats` или пересчитывается при отсутствии

#### POST /api/dialogs
Создать диалог

**Body:**
```json
{
  "name": "VIP чат",
  "createdBy": "agent_42",
  "members": [
    {
      "userId": "carl",
      "type": "user",
      "name": "Carl Johnson"
    },
    {
      "userId": "bot_123",
      "type": "bot",
      "name": "Support Bot"
    }
  ],
  "meta": {
    "channel": "whatsapp",
    "greeting": {
      "value": "Здравствуйте!",
      "dataType": "string",
      "scope": "user_alice"
    }
  }
}
```

**Примечания:**
- При создании диалога с `members`, пользователи автоматически создаются/обновляются в коллекции `User`
- Если участник уже существует в диалоге, он игнорируется

#### DELETE /api/dialogs/:id
Удалить диалог

---

### Messages (Сообщения)

#### GET /api/dialogs/:dialogId/messages
Получить сообщения диалога

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в операторном формате (AND/OR и группировка — см. раздел «Фильтрация»)
- `sort` - сортировка

**Примеры фильтров:**
- `(type,eq,internal.text)` - текстовые сообщения
- `(senderId,eq,carl)` - сообщения от carl
- `(meta.channelType,eq,whatsapp)` - WhatsApp сообщения
- `(topicId,eq,topic_abc123...)` - сообщения конкретного топика
- `(topicId,eq,null)` - сообщения без топика
- `(topicId,eq,topic_a)|(topicId,eq,topic_b)` - сообщения из топика topic_a или topic_b
- `(topicId,eq,null)|(topicId,eq,topic_abc)` - сообщения без топика или из указанного топика

#### POST /api/dialogs/:dialogId/messages
Создать сообщение

**Body:**
```json
{
  "senderId": "carl",
  "content": "Hello!",
  "type": "internal.text",
  "topicId": "topic_abc123..."  // Опционально: ID топика, если сообщение в топике
}
```

**Примечания:**
- `topicId` опционально - если не указан, сообщение создается без топика
- Если указан `topicId`, сообщение привязывается к топику
- В ответе сообщение содержит поле `topic` с информацией о топике (если привязано)

#### GET /api/messages
Получить список всех сообщений

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в операторном формате (AND/OR и группировка — см. раздел «Фильтрация»)
- `sort` - сортировка в формате `(field,direction)`

**Примеры фильтров:**
- `(type,eq,internal.text)` - текстовые сообщения
- `(senderId,eq,carl)` - сообщения от carl
- `(content,regex,привет)` - сообщения содержащие "привет"
- `(type,eq,internal.text)&(senderId,eq,carl)` - текстовые сообщения от carl
- `(topicId,eq,topic_a)|(topicId,eq,topic_b)` - сообщения из одного из указанных топиков

#### GET /api/messages/:messageId
Получить сообщение по ID

**Ответ включает:**
- Полные данные сообщения
- Массив статусов (statuses) с историей изменений
- Meta теги

#### PUT /api/messages/:messageId
Обновить содержимое сообщения

**Body:**
```json
{
  "content": "Updated content"
}
```

**Примечания:**
- Можно изменить только поле `content`
- Автоматически создается событие `message.update`
- Устанавливается meta тег `updated`

#### PATCH /api/messages/:messageId/topic
Установить или сбросить топик сообщения

**Body:**
```json
{
  "topicId": "topic_abc123..."   // или null для сброса
}
```

**Правила (вариант 1.3):**
- Установить топик: разрешено только если у сообщения ещё нет топика (`topicId = null`). Передайте `topicId` в формате `topic_` + 20 символов.
- Сбросить топик: разрешено только если у сообщения уже есть топик. Передайте `"topicId": null`.
- Нельзя менять один топик на другой (A → B).
- `topicId` должен принадлежать тому же диалогу, что и сообщение (проверяется по `dialogId` топика).

**Коды ошибок:**
- `404` — сообщение или топик не найдены (в т.ч. топик не в этом диалоге).
- `400` с кодом `ERROR_TOPIC_CHANGE_NOT_ALLOWED` — у сообщения уже есть топик, нельзя установить другой.
- `400` с кодом `ERROR_TOPIC_CLEAR_NOT_ALLOWED` — у сообщения нет топика, сбрасывать нечего.

**Примечания:**
- Создаётся событие `message.update` с `updatedFields: ['message.topicId']`.
- В ответе возвращается полный объект сообщения (включая `topic`, `meta`, `statusMessageMatrix`, `reactionSet`).

---

### Message Status (Статусы сообщений)

#### POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/:status
Создать новую запись в истории статусов сообщения

**Параметр status:** произвольный статус. Формат: буквы, цифры, `_` или `-`, 1–64 символа (в БД сохраняется в нижнем регистре). Примеры:
- `unread` — не прочитано (по умолчанию для новых сообщений)
- `delivered` — доставлено
- `read` — прочитано
- `error2`, `failed`, `pending` и т.п. — любые свои статусы по формату

**Примечания:**
- Каждое изменение статуса создает новую запись в истории (не обновляет существующую)
- Автоматически заполняется поле `userType` на основе типа пользователя
- Автоматически обновляются счетчики непрочитанных сообщений (unreadCount)
- Генерируется событие изменения статуса для других участников диалога
- Доступен только для участников диалога

#### GET /api/users/:userId/dialogs/:dialogId/messages/:messageId/statuses
Получить историю статусов сообщения для пользователя

---

### Message Reactions (Реакции)

#### GET /api/users/:userId/dialogs/:dialogId/messages/:messageId/reactions
Получить реакции на сообщение

**Query параметры:**
- `userId` - фильтр по пользователю (опционально)

**Примечания:**
- Доступен только для участников диалога
- Возвращает все реакции на сообщение с количеством и информацией о текущем пользователе

#### POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action
Установить или снять реакцию на сообщение

**Path параметры:**
- `action` - действие: `set` (добавить) или `unset` (удалить)

**Body:**
```json
{
  "reaction": "👍"
}
```

**Примечания:**
- Доступен только для участников диалога
- `action=set` - добавляет реакцию (если её еще нет)
- `action=unset` - удаляет реакцию (если она существует)

---

### Topics (Топики)

Топики позволяют организовывать сообщения внутри диалога по темам. Каждое сообщение может быть привязано к топику через поле `topicId`. Список топиков (по диалогу и по диалогу пользователя) поддерживает фильтрацию по полям `topicId`, `dialogId` и любым meta-тегам топика (`meta.*`) в том же операторном формате, что и остальные endpoint'ы (AND/OR, группировка, лимиты).

#### GET /api/dialogs/:dialogId/topics
Получить список топиков диалога

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в операторном формате (AND/OR и группировка — см. раздел «Фильтрация»). Доступные поля: `topicId`, `dialogId`, `meta.*` (meta-теги топика).
- `sort` - сортировка

**Примеры фильтров по топикам:**
- `(topicId,eq,topic_abc123...)` - конкретный топик
- `(meta.name,eq,Важная тема)` - топики с именем по meta
- `(meta.channelId,eq,whatsapp.chn_6kgxljk)` — по meta-ключу (значение с точкой можно писать без кавычек)
- `(meta.priority,in,[support,general])` - топики с приоритетом support или general
- `(meta.priority,ne,archived)` - топики с приоритетом не archived
- `(meta.name,regex,^support)` - топики, имя которых начинается с "support"
- `(meta.name,eq,a)|(meta.name,eq,b)` - топики с именем a или b
- `((meta.priority,eq,high)&(meta.category,eq,support))|(meta.name,eq,personal)` - (priority=high и category=support) или name=personal

**Если фильтр по meta ничего не находит (ни с кавычками, ни без):**
1. **Проверьте, что meta вообще заданы у топиков.** Фильтр ищет записи в коллекции `Meta` (`entityType=topic`, `key`, `value`). Если meta ни разу не задавали — записей нет и результат пустой. Задать meta: **PATCH** `/api/dialogs/:dialogId/topics/:topicId` с телом `{ "meta": { "channelId": "whatsapp.chn_6kgxljk" } }` или **PUT** `/api/meta/topic/:topicId/channelId` с телом `{ "value": "whatsapp.chn_6kgxljk" }`.
2. **Проверьте tenant.** Список топиков и фильтр работают в контексте tenant из заголовка `X-TENANT-ID` (или `tnt_default`, если заголовка нет). В коллекции `Meta` у записей должен быть тот же `tenantId`. Убедитесь, что запрос к `GET /api/topics` идёт с тем же tenant, с которым создавали/обновляли meta.
3. **Проверка через API:** возьмите любой `topicId` из `GET /api/topics` (без фильтра) или из `GET /api/dialogs/:dialogId/topics`, затем вызовите **GET** `/api/meta/topic/:topicId`. В ответе должно быть поле `channelId` со значением `whatsapp.chn_6kgxljk`. Если его нет — meta для этого топика не задан.
4. При пустом результате с фильтром по `meta.*` API возвращает в теле ответа поле `hint` с краткой подсказкой.

**Ответ:**
```json
{
  "data": [
    {
      "topicId": "topic_abc123...",
      "dialogId": "dlg_...",
      "createdAt": 1234567890,
      "meta": {
        "name": "Важная тема",
        "color": "#FF5733"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

#### GET /api/users/:userId/dialogs/:dialogId/topics
Получить топики диалога в контексте пользователя (с количеством непрочитанных сообщений)

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в том же формате, что и для GET /api/dialogs/:dialogId/topics (поля: topicId, dialogId, meta.*; AND/OR и группировка)
- `sort` - сортировка

**Ответ включает `unreadCount` для каждого топика:**
```json
{
  "data": [
    {
      "topicId": "topic_abc123...",
      "dialogId": "dlg_...",
      "createdAt": 1234567890,
      "meta": {
        "name": "Важная тема"
      },
      "unreadCount": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

#### POST /api/dialogs/:dialogId/topics
Создать топик в диалоге

**Body:**
```json
{
  "meta": {
    "name": "Новый топик",
    "color": "#FF5733"
  }
}
```

**Примечания:**
- Топик создается с автоматически сгенерированным `topicId`
- Мета-теги сохраняются в коллекции `Meta` (entityType: 'topic')
- Автоматически обновляется `DialogStats.topicCount`

#### GET /api/dialogs/:dialogId/topics/:topicId
Получить топик по ID

**Ответ включает:**
- Основные данные топика (topicId, dialogId, tenantId, createdAt)
- `meta` — мета-теги топика
- `dialog` — объект диалога с метаданными: `{ dialogId, tenantId, createdAt?, meta }` (meta диалога; всегда присутствует)

#### PATCH /api/dialogs/:dialogId/topics/:topicId
Обновить мета-теги топика

**Body:**
```json
{
  "meta": {
    "name": "Обновленное название",
    "color": "#00FF00"
  }
}
```

**Примечания:**
- Можно обновлять только мета-теги
- Удаление топиков запрещено (защита от потери данных)

---

### Dialog Members (Участники диалогов)

#### GET /api/dialogs/:dialogId/members
Получить участников диалога

**Query параметры:**
- `filter` - фильтр
- `sort` - сортировка

#### POST /api/dialogs/:dialogId/members/add
Добавить участника в диалог

**Body:**
```json
{
  "userId": "carl",
  "type": "user",
  "name": "Carl Johnson"
}
```

**Примечания:**
- Пользователь автоматически создается/обновляется в коллекции `User`
- Если участник уже существует в диалоге, возвращается 200 без создания дубликата

#### POST /api/dialogs/:dialogId/members/:userId/remove
Удалить участника из диалога

#### PATCH /api/dialogs/:dialogId/members/:userId/unread
Установить количество непрочитанных сообщений

**Body:**
```json
{
  "unreadCount": 5,
  "lastSeenAt": 1763551369397.6482,
  "reason": "Manual update"
}
```

---

### User Dialogs (Диалоги пользователя)

#### GET /api/users/:userId/dialogs
Получить диалоги пользователя

**Query параметры:**
- `page`, `limit` - пагинация
- `includeLastMessage` - включить последнее сообщение (`true` или `false`, по умолчанию: `false`)
- `filter` - фильтрация в формате операторов: `(field,operator,value)`
- `sort` - сортировка в формате `(field,direction)`
- `unreadCount` - фильтр по количеству непрочитанных сообщений (число или `gte:N`, `gt:N`, `lte:N`, `lt:N`)
- `lastSeenAt` - фильтр по времени последнего просмотра (`gte:timestamp`, `gt:timestamp`, `lte:timestamp`, `lt:timestamp`)

**Примеры фильтров:**
- `(meta.type,eq,internal)` - диалоги типа internal
- `(meta.channelType,eq,whatsapp)` - WhatsApp диалоги
- `(meta.members,in,[john,sara])` - диалоги с участниками john или sara
- `(meta.members,$all,[john,sara])` - диалоги где есть ВСЕ указанные участники (john И sara)
- `(meta.members,$ne,john)` - диалоги БЕЗ участника john
- `(dialogId,eq,dlg_abc123)` - конкретный диалог
- Комбинированные: `(meta.type,eq,internal)&(meta.channelType,ne,telegram)`
- С ИЛИ: `(meta.type,eq,internal)|(meta.type,eq,support)` — диалоги типа internal или support
- Группировка: `((topic.meta.category,eq,support)&(topic.meta.priority,eq,high))|(meta.channelType,eq,whatsapp)` — (топики support и high) или WhatsApp

**Фильтры по топикам:**
- `(topic.topicId,eq,topic_abc123...)` - диалоги с конкретным топиком
- `(topic.topicId,ne,null)` - диалоги с любыми топиками
- `(topic.topicId,in,[topic1,topic2])` - диалоги с любым из указанных топиков
- `(topic.topicId,nin,[topic1,topic2])` - диалоги без указанных топиков
- `(topic.meta.category,eq,support)` - диалоги с топиками категории "support"
- `(topic.meta.priority,in,[high,urgent])` - диалоги с топиками приоритета "high" или "urgent"
- `(topic.meta.status,ne,archived)` - диалоги с топиками, статус которых НЕ "archived"
- `(topic.meta.assignedTo,exists,true)` - диалоги с топиками, имеющими мета-тег assignedTo
- `(topic.topicCount,gt,0)` - диалоги с хотя бы одним топиком
- `(topic.topicCount,eq,0)` - диалоги без топиков
- `(topic.topicCount,gte,5)` - диалоги с 5 и более топиками
- Комбинированные: `(topic.meta.category,eq,support)&(topic.meta.priority,eq,high)` - диалоги с топиками категории "support" и приоритетом "high"
- С ИЛИ по топикам: `(topic.meta.category,eq,support)|(topic.meta.category,eq,sales)` - диалоги с топиками категории support или sales

**Примеры сортировки:**
- `(lastInteractionAt,desc)` - по последнему взаимодействию (новые первыми)
- `(lastInteractionAt,asc)` - по последнему взаимодействию (старые первыми)
- `(unreadCount,desc)` - по количеству непрочитанных (больше первыми)

**Примеры фильтров unreadCount:**
- `unreadCount=5` - точно 5 непрочитанных
- `unreadCount=gte:1` - 1 или больше непрочитанных
- `unreadCount=gt:0` - больше 0 непрочитанных

**Примечания:**
- Возвращает диалоги пользователя с информацией о состоянии участника (unreadCount, lastSeenAt, isActive)
- По умолчанию сортировка по `lastInteractionAt` (последнее взаимодействие) в порядке убывания
- Если `includeLastMessage=true`, включает последнее сообщение в каждом диалоге
- Фильтрация по `meta.members` работает только для диалогов текущего пользователя
- Поддерживается комбинирование фильтров через `&` (AND), `|` (OR) и группировку скобками (см. раздел «Фильтрация»)

#### GET /api/users/:userId/dialogs/:dialogId/messages
Получить сообщения диалога пользователя

**Query параметры:**
- `page`, `limit` - пагинация
- `filter` - фильтр в операторном формате (AND/OR и группировка — см. раздел «Фильтрация»)
- `sort` - сортировка

**Примеры фильтров:**
- `(topicId,eq,topic_abc123...)` - сообщения конкретного топика
- `(topicId,eq,null)` - сообщения без топика
- `(topicId,eq,topic_a)|(topicId,eq,topic_b)` - сообщения из топика topic_a или topic_b
- `(type,eq,internal.text)` - текстовые сообщения
- `(senderId,eq,carl)` - сообщения от carl

**Примечания:**
- Доступен только для участников диалога
- Возвращает сообщения с полной информацией (statusMessageMatrix, reactionSet)
- Каждое сообщение содержит поле `topic` с информацией о топике (если привязано) или `null`

#### GET /api/users/:userId/dialogs/:dialogId/messages/:messageId
Получить сообщение из диалога пользователя

**Примечания:**
- Доступен только для участников диалога
- Возвращает полную информацию о сообщении

---

### Packs (Паки)

Пак — сущность, объединяющая 0, 1 или более диалогов в один «виртуальный» диалог. Состав хранится в PackLink (packId, dialogId, addedAt). Мета-теги для паков: `entityType=pack`, `entityId=packId` (формат `pck_[a-z0-9]{20}`).

#### POST /api/packs
Создать пак

**Body:** пустой объект `{}` или не передавать.

**Ответ:** `packId`, `tenantId`, `createdAt`

#### GET /api/packs
Список паков тенанта (все паки по текущему X-Tenant-ID).

**Query параметры:** `page`, `limit` (макс. 50), `filter` (по meta, напр. `(meta.category,eq,support)`), `sort` (поле, по умолчанию `createdAt`), `sortDirection` (`asc` / `desc`).

**Ответ:** массив паков с полями пака и `meta`; `pagination`: page, limit, total, pages.

#### GET /api/packs/:packId
Получить пак по ID

**Ответ включает:** данные пака (packId, tenantId, createdAt), объект `meta`, объект `stats` (dialogCount). Список диалогов — отдельный endpoint GET /api/packs/:packId/dialogs с пагинацией.

#### DELETE /api/packs/:packId
Удалить пак (каскадно удаляются PackLink)

#### POST /api/packs/:packId/dialogs
Добавить диалог в пак

**Body:**
```json
{
  "dialogId": "dlg_abcdefghij1234567890"
}
```
- Диалог и пак должны принадлежать одному tenantId
- Идемпотентно: если диалог уже в паке — успех без смены addedAt

#### DELETE /api/packs/:packId/dialogs/:dialogId
Убрать диалог из пака

#### GET /api/packs/:packId/dialogs
Список диалогов пака (с пагинацией)

**Query параметры:** `page`, `limit` (по умолчанию 10, макс. 50)

**Ответ:** массив `{ dialogId, addedAt }`, сортировка по addedAt desc

#### GET /api/packs/:packId/messages
Единый поток сообщений пака. Возвращает сообщения всех диалогов, входящих в пак, в порядке убывания `createdAt`. Пагинация — курсорная.

**Query параметры:**
- `limit` (число, по умолчанию 50, максимум 100)
- `cursor` (base64-строка, полученная из предыдущего ответа)
- `filter` (опционально, синтаксис как у `/api/dialogs/:dialogId/messages`)

**Ответ:**
```json
{
  "data": [
    {
      "messageId": "msg_abcd",
      "dialogId": "dlg_main",
      "content": "Пример сообщения",
      "senderId": "user_alpha",
      "senderInfo": {
        "userId": "user_alpha",
        "createdAt": 1720000000.123456,
        "meta": {}
      },
      "createdAt": 1721122334.654321,
      "meta": {},
      "statusMessageMatrix": [],
      "reactionSet": []
    }
  ],
  "cursor": {
    "next": "MTcyMTEyMjMzNC42NTQzMjF8bXNnX2FiY2Q",
    "prev": null
  },
  "hasMore": true
}
```

- `cursor.next` содержит base64 курсор (`createdAt|messageId`), который нужно передать в следующем запросе для получения следующей страницы.
- `cursor.prev` зарезервирован для обратной навигации (сейчас `null` для первой страницы).

**Мета-теги пака:** `PUT /api/meta/pack/:packId/:key`, `DELETE /api/meta/pack/:packId/:key`, `GET /api/meta/pack/:packId`

#### GET /api/users/:userId/packs
Список паков пользователя (паки, в диалогах которых пользователь участвует)

**Query параметры:** `page`, `limit` (макс. 50), `filter`, `sort` (по умолчанию `createdAt`), `sortDirection` (`asc` / `desc`)

**Фильтр:**
- по meta пака: `(meta.category,eq,support)`
- по unreadCount (UserPackStats): `(unreadCount,gt,0)`, `(unreadCount,gte,1)`, `(unreadCount,eq,0)` и т.д.

**Сортировка:** `sort=createdAt` (по умолчанию) или `sort=unreadCount`; `sortDirection=asc` / `desc`

**Ответ:** массив паков с полями пака, `meta` и секцией **`stats`** (данные UserPackStats для пользователя):
- `stats.unreadCount` — количество непрочитанных сообщений в паке
- `stats.lastUpdatedAt`, `stats.createdAt` — timestamps

`pagination`: page, limit, total, pages

#### GET /api/users/:userId/dialogs/:dialogId/packs
Список паков, в которые входит данный диалог

**Доступ:** только если пользователь — участник диалога (иначе 404)

**Ответ:** массив объектов `{ packId, addedAt, createdAt?, meta }`

---

### Meta Tags (Мета-теги)

#### GET /api/meta/:entityType/:entityId
Получить все meta теги сущности

**Query параметры:**
- `scope` - персональный scope для приоритетных значений (опционально)

**Entity Types:**
- `dialog` - диалог
- `message` - сообщение
- `user` - пользователь
- `tenant` - тенант
- `system` - системная сущность
- `dialogMember` - участник диалога
- `topic` - топик
- `pack` - пак

**Пример:**
```
GET /api/meta/dialog/dlg_abc123?scope=user_alice
```

**Примечания:**
- При получении meta тегов, scoped значения имеют приоритет над глобальными
- Если указан `scope`, возвращаются только значения с этим scope или глобальные

#### PUT /api/meta/:entityType/:entityId/:key
Установить или обновить meta тег

**Body (простое значение):**
```json
{
  "value": "whatsapp"
}
```

**Body (расширенное значение):**
```json
{
  "value": "Здравствуйте!",
  "dataType": "string",
  "scope": "user_alice"
}
```

**Параметры:**
- `value` (обязательно) - значение любого типа (string, number, boolean, object, array)
- `dataType` (опционально) - тип данных: `string`, `number`, `boolean`, `object`, `array` (по умолчанию: `string`)
- `scope` (опционально) - персональный scope для приоритетных значений

**Примечания:**
- `scope` позволяет создавать персональные значения для конкретных пользователей
- При получении meta тегов, scoped значения имеют приоритет над глобальными

#### DELETE /api/meta/:entityType/:entityId/:key
Удалить meta тег

**Path параметр `key`:** тот же алфавит, что и для PUT (буквы, цифры, подчёркивание).

**Query параметры:**
- `scope` (опционально) - удалить только scoped значение

**Примечания:**
- Если `scope` не указан, удаляется глобальное значение
- Если `scope` указан, удаляется только значение с этим scope

---

### Typing (Индикатор печати)

#### POST /api/dialogs/:dialogId/member/:userId/typing
Отправить индикатор печати

**Body:**
```json
{
  "isTyping": true
}
```

**Примечания:**
- Отправляет событие `dialog.typing` в RabbitMQ
- Создает TypingUpdate для всех участников диалога (кроме инициатора)
- Индикатор автоматически истекает через 5 секунд

---

## Коды ответов

- `200` - Успешно
- `201` - Создано
- `204` - Нет содержимого (успешное удаление)
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Не найдено
- `409` - Конфликт (например, пользователь уже существует)
- `500` - Внутренняя ошибка сервера

## Swagger UI

Интерактивная документация доступна по адресу:

```
http://localhost:3000/api-docs
```

