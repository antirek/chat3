# Фильтры для поиска диалогов по топикам

## Концепция

Диалоги могут содержать топики. У каждого топика есть:
- `topicId` - уникальный идентификатор топика
- Мета-теги (`meta`) - произвольные ключ-значение пары

Фильтры позволяют находить диалоги на основе:
1. Наличия конкретного топика (`topicId`)
2. Наличия топиков с определенными мета-тегами
3. Комбинации условий

## Варианты формулировок фильтров

### 1. Фильтрация по topicId

#### Вариант A: Прямое указание topicId
```
(topicId,eq,{topicId})           - диалоги, содержащие топик с указанным topicId
(topicId,ne,null)                - диалоги, содержащие хотя бы один топик
(topicId,in,[topic1,topic2,...]) - диалоги, содержащие любой из указанных топиков
(topicId,nin,[topic1,topic2])    - диалоги, НЕ содержащие указанные топики
```

#### Вариант B: Использование префикса `topic.` ✅ **ВЫБРАНО ДЛЯ РЕАЛИЗАЦИИ**
```
(topic.topicId,eq,{topicId})     - диалоги, содержащие топик с указанным topicId
(topic.topicId,ne,null)          - диалоги, содержащие хотя бы один топик
(topic.topicId,in,[topic1,topic2]) - диалоги, содержащие любой из указанных топиков
(topic.topicId,nin,[topic1,topic2]) - диалоги, НЕ содержащие указанные топики
```

#### Вариант C: Использование префикса `hasTopic`
```
(hasTopic,eq,true)               - диалоги, содержащие хотя бы один топик
(hasTopic,eq,false)             - диалоги без топиков
(topicId,eq,{topicId})           - диалоги, содержащие конкретный топик
```

**Рекомендация:** Вариант B - единообразный с фильтрами по мета-тегам (`topic.meta.{key}`).

---

### 2. Фильтрация по мета-тегам топиков

#### Вариант A: Префикс `topic.meta.` ✅ **ВЫБРАНО ДЛЯ РЕАЛИЗАЦИИ**
```
(topic.meta.{key},eq,{value})              - диалоги с топиками, имеющими мета-тег {key}={value}
(topic.meta.{key},ne,{value})              - диалоги с топиками, НЕ имеющими мета-тег {key}={value}
(topic.meta.{key},in,[value1,value2])      - диалоги с топиками, имеющими мета-тег {key} из списка
(topic.meta.{key},nin,[value1,value2])     - диалоги с топиками, НЕ имеющими мета-тег {key} из списка
(topic.meta.{key},exists,true)            - диалоги с топиками, имеющими мета-тег {key} (любое значение)
(topic.meta.{key},exists,false)           - диалоги с топиками, НЕ имеющими мета-тег {key}
```

**Примеры:**
```
(topic.meta.category,eq,support)          - диалоги с топиками категории "support"
(topic.meta.priority,in,[high,urgent])   - диалоги с топиками приоритета "high" или "urgent"
(topic.meta.status,ne,archived)          - диалоги с топиками, статус которых НЕ "archived"
(topic.meta.assignedTo,exists,true)      - диалоги с топиками, имеющими назначенного пользователя
```

#### Вариант B: Префикс `topicMeta.`
```
(topicMeta.{key},eq,{value})             - диалоги с топиками, имеющими мета-тег {key}={value}
(topicMeta.{key},in,[value1,value2])      - диалоги с топиками, имеющими мета-тег {key} из списка
```

#### Вариант C: Вложенная структура `topic[meta.{key}]`
```
(topic[meta.{key}],eq,{value})           - диалоги с топиками, имеющими мета-тег {key}={value}
```

---

### 3. Комбинированные фильтры

#### Примеры комбинаций:
```
(topic.topicId,ne,null)&(topic.meta.category,eq,support)
  - диалоги с топиками, имеющими категорию "support"

(topic.meta.priority,eq,high)&(topic.meta.status,ne,closed)
  - диалоги с топиками приоритета "high" и статусом не "closed"

(topic.topicId,in,[topic1,topic2])&(topic.meta.assignedTo,eq,userId)
  - диалоги с топиками topic1 или topic2, назначенными пользователю userId

(topic.topicId,ne,null)&(topic.meta.priority,in,[high,urgent])&(topic.meta.status,ne,archived)
  - диалоги с топиками приоритета "high" или "urgent", не архивными

(topic.topicId,eq,topic_abc123)&(topic.meta.assignedTo,exists,true)
  - диалоги с конкретным топиком, имеющим назначенного пользователя
```

---

### 4. Специальные фильтры

#### Количество топиков в диалоге (с префиксом `topic.`)
```
(topic.topicCount,gt,0)          - диалоги с хотя бы одним топиком
(topic.topicCount,eq,0)          - диалоги без топиков
(topic.topicCount,gte,5)         - диалоги с 5 и более топиками
(topic.topicCount,in,[1,2,3])    - диалоги с 1, 2 или 3 топиками
(topic.topicCount,lt,10)         - диалоги с менее чем 10 топиками
(topic.topicCount,lte,3)         - диалоги с 3 или менее топиками
```

**Примечание:** Требует использования `DialogStats.topicCount`. Использует префикс `topic.` для единообразия с другими фильтрами топиков.

---

## Рекомендуемый набор фильтров ✅ **ФИНАЛЬНЫЙ ВЫБОР**

### Базовые фильтры по topicId:
- `(topic.topicId,eq,{topicId})` - диалоги с конкретным топиком
- `(topic.topicId,ne,null)` - диалоги с любыми топиками
- `(topic.topicId,in,[topic1,topic2,...])` - диалоги с любым из указанных топиков
- `(topic.topicId,nin,[topic1,topic2])` - диалоги без указанных топиков

### Фильтры по мета-тегам топиков:
- `(topic.meta.{key},eq,{value})` - диалоги с топиками, имеющими мета-тег
- `(topic.meta.{key},ne,{value})` - диалоги с топиками, НЕ имеющими мета-тег
- `(topic.meta.{key},in,[value1,value2])` - диалоги с топиками, мета-тег из списка
- `(topic.meta.{key},nin,[value1,value2])` - диалоги с топиками, НЕ имеющими мета-тег из списка
- `(topic.meta.{key},exists,true)` - диалоги с топиками, имеющими мета-тег (любое значение)
- `(topic.meta.{key},exists,false)` - диалоги с топиками, НЕ имеющими мета-тег

### Фильтры по количеству топиков:
- `(topic.topicCount,gt,0)` - диалоги с топиками
- `(topic.topicCount,eq,0)` - диалоги без топиков
- `(topic.topicCount,gte,{n})` - диалоги с n и более топиками
- `(topic.topicCount,lte,{n})` - диалоги с n или менее топиками
- `(topic.topicCount,in,[1,2,3])` - диалоги с 1, 2 или 3 топиками

---

## Примеры использования

### Найти диалоги с топиками поддержки:
```
(topic.meta.category,eq,support)
```

### Найти диалоги с высокоприоритетными топиками:
```
(topic.meta.priority,eq,high)
```

### Найти диалоги с топиками, назначенными конкретному пользователю:
```
(topic.meta.assignedTo,eq,alice)
```

### Найти диалоги с топиками категории "support" или "technical":
```
(topic.meta.category,in,[support,technical])
```

### Найти диалоги с топиками, но не архивными:
```
(topic.topicId,ne,null)&(topic.meta.status,ne,archived)
```

### Найти диалоги с 3 и более топиками:
```
(topic.topicCount,gte,3)
```

### Найти диалоги с конкретным топиком:
```
(topic.topicId,eq,topic_abc123...)
```

### Найти диалоги с высокоприоритетными топиками, но не закрытыми:
```
(topic.meta.priority,eq,high)&(topic.meta.status,ne,closed)
```

### Найти диалоги с 1-3 топиками категории "support":
```
(topic.topicCount,in,[1,2,3])&(topic.meta.category,eq,support)
```

---

## Вопросы для обсуждения

1. **Префикс для мета-тегов:** `topic.meta.{key}` vs `topicMeta.{key}` vs другой вариант?
2. **Фильтр "есть топики":** `(topicId,ne,null)` vs `(hasTopic,eq,true)` vs `(topicCount,gt,0)`?
3. **Фильтр "нет топиков":** `(topicId,eq,null)` vs `(hasTopic,eq,false)` vs `(topicCount,eq,0)`?
4. **Поддержка сложных условий:** нужны ли фильтры типа "диалоги с топиками, у которых мета-тег A И мета-тег B"?
5. **Производительность:** как оптимизировать запросы при большом количестве топиков?

---

## Текущая реализация

На данный момент поддерживаются:
- ✅ `(topic.meta.{key},eq,{value})` - диалоги с топиками по мета-тегам (базовая поддержка)

**Примечание:** Старый формат `(topicId,*)` больше не поддерживается. Используйте новый формат `(topic.topicId,*)`.

---

## План реализации фильтров

### Этап 1: Фильтры по topicId (новый формат)

#### 1.1. Базовые фильтры
- [ ] `(topic.topicId,eq,{topicId})` - диалоги с конкретным топиком
- [ ] `(topic.topicId,ne,null)` - диалоги с любыми топиками
- [ ] `(topic.topicId,in,[topic1,topic2,...])` - диалоги с любым из указанных топиков
- [ ] `(topic.topicId,nin,[topic1,topic2])` - диалоги без указанных топиков

**Файлы для изменения:**
- `src/apps/tenant-api/controllers/userDialogController.js` - метод `getUserDialogs`
- `src/apps/tenant-api/utils/queryParser.js` - парсинг фильтров (если нужно)

**Логика:**
- Распознавать `topic.topicId` в `regularFilters` (после парсинга)
- Для `eq`: найти топик по `topicId`, вернуть его `dialogId` (если пользователь участник)
- Для `ne,null`: найти все топики в диалогах пользователя, вернуть уникальные `dialogId`
- Для `in`: найти все топики с `topicId` из списка, вернуть уникальные `dialogId`
- Для `nin`: найти все топики в диалогах пользователя, исключить те, что в списке

### Этап 2: Расширение фильтров по мета-тегам

#### 2.1. Дополнительные операторы для мета-тегов
- [ ] `(topic.meta.{key},ne,{value})` - исключение по мета-тегам
- [ ] `(topic.meta.{key},in,[value1,value2])` - множественный выбор значений
- [ ] `(topic.meta.{key},nin,[value1,value2])` - исключение значений из списка
- [ ] `(topic.meta.{key},exists,true)` - проверка наличия мета-тега
- [ ] `(topic.meta.{key},exists,false)` - проверка отсутствия мета-тега

**Файлы для изменения:**
- `src/apps/tenant-api/controllers/userDialogController.js` - метод `getUserDialogs`
- Обработка `topicMetaFilters` (уже есть базовая логика)

**Логика:**
- Для `ne`: найти топики с мета-тегом, но не равным значению
- Для `in`: найти топики с мета-тегом, значение которого в списке
- Для `nin`: найти топики с мета-тегом, значение которого НЕ в списке
- Для `exists,true`: найти топики, имеющие мета-тег (любое значение)
- Для `exists,false`: найти топики, НЕ имеющие мета-тег

### Этап 3: Фильтры по количеству топиков

#### 3.1. Фильтрация по topicCount
- [ ] `(topic.topicCount,gt,0)` - диалоги с топиками
- [ ] `(topic.topicCount,eq,0)` - диалоги без топиков
- [ ] `(topic.topicCount,gte,{n})` - диалоги с n и более топиками
- [ ] `(topic.topicCount,lte,{n})` - диалоги с n или менее топиками
- [ ] `(topic.topicCount,in,[1,2,3])` - диалоги с количеством из списка

**Файлы для изменения:**
- `src/apps/tenant-api/controllers/userDialogController.js` - метод `getUserDialogs`
- Использовать `DialogStats.topicCount`

**Логика:**
- Распознавать `topic.topicCount` в `regularFilters`
- Загрузить `DialogStats` для всех диалогов пользователя
- Применить фильтр по `topicCount` с указанным оператором
- Вернуть `dialogId`, удовлетворяющие условию

### Этап 4: Обновление api-test интерфейса

#### 4.1. Добавление примеров фильтров topic* в UI
- [ ] Обновить раздел "Фильтры по топикам" в `select#filterExample`:
  - [ ] Заменить старый формат `(topicId,eq,...)` на `(topic.topicId,eq,...)`
  - [ ] Добавить примеры для всех операторов `topic.topicId`:
    - `(topic.topicId,eq,{topicId})` - диалоги с конкретным топиком
    - `(topic.topicId,ne,null)` - диалоги с любыми топиками
    - `(topic.topicId,in,[topic1,topic2])` - диалоги с любым из указанных топиков
    - `(topic.topicId,nin,[topic1,topic2])` - диалоги без указанных топиков
  - [ ] Расширить примеры фильтров по мета-тегам:
    - `(topic.meta.{key},ne,{value})` - исключение по мета-тегам
    - `(topic.meta.{key},in,[value1,value2])` - множественный выбор значений
    - `(topic.meta.{key},nin,[value1,value2])` - исключение значений из списка
    - `(topic.meta.{key},exists,true)` - проверка наличия мета-тега
    - `(topic.meta.{key},exists,false)` - проверка отсутствия мета-тега
  - [ ] Добавить примеры фильтров по количеству топиков:
    - `(topic.topicCount,gt,0)` - диалоги с топиками
    - `(topic.topicCount,eq,0)` - диалоги без топиков
    - `(topic.topicCount,gte,3)` - диалоги с 3 и более топиками
    - `(topic.topicCount,lte,5)` - диалоги с 5 или менее топиками
    - `(topic.topicCount,in,[1,2,3])` - диалоги с 1, 2 или 3 топиками
- [ ] Обновить раздел "Комбинированные фильтры":
  - [ ] Добавить примеры комбинаций с `topic.topicId`:
    - `(topic.topicId,ne,null)&(topic.meta.category,eq,support)`
    - `(topic.topicId,in,[topic1,topic2])&(topic.meta.assignedTo,eq,userId)`
    - `(topic.topicId,ne,null)&(topic.meta.priority,in,[high,urgent])&(topic.meta.status,ne,archived)`
  - [ ] Добавить примеры с `topic.topicCount`:
    - `(topic.topicCount,gte,3)&(topic.meta.category,eq,support)`
    - `(topic.topicCount,in,[1,2,3])&(topic.meta.priority,eq,high)`
    - `(member,in,[carl])&(topic.topicCount,gt,0)&(topic.meta.status,ne,archived)`
- [ ] Обновить фильтры сообщений (если нужно):
  - [ ] Заменить `(topicId,eq,...)` на `(topic.topicId,eq,...)` в примерах фильтров сообщений

**Файлы для изменения:**
- `src/apps/api-test/public/api-test-user-dialogs.html`:
  - Раздел `<optgroup label="Фильтры по топикам">` (строка ~1293)
  - Раздел `<optgroup label="Комбинированные фильтры">` (строка ~1299)
  - Раздел фильтров сообщений (если используется `topicId`)

**Требования:**
- Все примеры должны использовать новый формат `topic.topicId` вместо `topicId`
- Примеры должны быть практичными и отражать реальные сценарии использования
- Добавить комментарии/подсказки для сложных комбинаций

### Этап 5: Удаление поддержки старого формата

#### 5.1. Удаление обработки `(topicId,*)` фильтров
- [ ] Удалить обработку `topicId` из `regularFilters` в `userDialogController.js`
- [ ] Удалить обработку `topicId` из фильтров сообщений (если есть)
- [ ] Обновить документацию API (Swagger), убрав упоминания старого формата
- [ ] Добавить валидацию, которая отклоняет запросы со старым форматом с понятным сообщением об ошибке

**Файлы для изменения:**
- `src/apps/tenant-api/controllers/userDialogController.js` - удалить обработку `topicId` в `getUserDialogs`
- `src/apps/tenant-api/controllers/messageController.js` - удалить обработку `topicId` (если есть)
- `src/apps/tenant-api/routes/*.js` - обновить Swagger документацию

**Логика:**
- При обнаружении фильтра `(topicId,*)` возвращать ошибку 400 с сообщением:
  ```
  Error: Filter format (topicId,*) is deprecated. Use (topic.topicId,*) instead.
  ```

### Этап 6: Оптимизация и тестирование

#### 5.1. Оптимизация запросов
- [ ] Батчинг запросов к `Topic` и `Meta` для множественных фильтров
- [ ] Кэширование `DialogStats` при множественных фильтрах
- [ ] Индексы для быстрого поиска топиков по мета-тегам (уже есть)

#### 5.2. Тестирование
- [ ] Unit-тесты для парсинга фильтров `topic.topicId` и `topic.topicCount`
- [ ] Интеграционные тесты для всех вариантов фильтров
- [ ] Тесты производительности при большом количестве топиков

---

## Порядок реализации

1. **Этап 1** - Базовые фильтры по `topic.topicId` (критично для единообразия)
2. **Этап 2** - Расширение фильтров по мета-тегам (уже есть базовая поддержка)
3. **Этап 3** - Фильтры по `topic.topicCount` (требует `DialogStats`)
4. **Этап 4** - Обновление api-test интерфейса (для интерактивного тестирования)
5. **Этап 5** - Удаление поддержки старого формата `(topicId,*)`
6. **Этап 6** - Оптимизация и тестирование

---

## Примечания

- **Старый формат `(topicId,*)` больше не поддерживается** - используйте `(topic.topicId,*)`
- Все фильтры топиков используют единый префикс `topic.` для консистентности
- Примеры фильтров в api-test интерфейсе должны отражать все поддерживаемые варианты для удобства тестирования
