# Changelog

## [Latest] - 2025-10-23

### 🆕 Добавлено

#### Продвинутые операторы фильтрации 🔥 **НОВОЕ!**
- **QueryParser** - утилита для парсинга сложных фильтров с операторами
- Поддержка операторного формата: `(field,operator,value)` 
- **10 операторов**: `eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `regex`, `exists`
- Комбинирование фильтров через `&`: `(meta.type,eq,internal)&(meta.channelType,ne,telegram)`
- **Оператор `ne` (НЕ равно)** - ключевая фича! Позволяет фильтровать "все кроме..."
- Специальная обработка негативных операторов (`ne`, `nin`) для Meta коллекции
- Поддержка массивов в значениях: `(meta.type,in,[internal,external])`

#### Meta тег `channelType` для диалогов
- Добавлен новый meta тег `channelType` с значениями `whatsapp` или `telegram`
- Каждый диалог теперь привязан к определенному каналу коммуникации
- Поддержка фильтрации по каналу через API

#### Увеличено количество тестовых диалогов
- **100 диалогов** вместо прежних 10
- 70 internal + 30 external
- 50 WhatsApp + 50 Telegram
- Разнообразные типы: private, group, channel

#### Улучшенная фильтрация
- **Старый формат** (все еще поддерживается): `{"meta":{"channelType":"whatsapp"}}`
- **Новый операторный формат**: `(meta.channelType,ne,telegram)`
- **Комбинированные фильтры**: `(meta.type,eq,internal)&(meta.channelType,ne,telegram)` → 35 диалогов
- Поддержка `$and` в extractMetaFilters для правильной обработки множественных фильтров

### 📊 Статистика после seed

```
Tenants:            2 (1 system + 1 demo)
Users:              4 (1 system bot + 3 demo users)
Dialogs:            100 (70 internal + 30 external)
DialogParticipants: 199
Messages:           3
Meta:               605 (5 system/user/tenant + 600 dialog)
```

### 🔍 Примеры использования новых фильтров

#### Формат 1: JSON (старый, все еще работает)

```bash
# Все WhatsApp диалоги (50)
GET /api/dialogs?filter={"meta":{"channelType":"whatsapp"}}

# Внутренние WhatsApp (35)
GET /api/dialogs?filter={"meta":{"type":"internal","channelType":"whatsapp"}}
```

#### Формат 2: Операторы (новый, более гибкий) 🆕

```bash
# НЕ telegram = только WhatsApp (50)
GET /api/dialogs?filter=(meta.channelType,ne,telegram)

# Internal + НЕ telegram = internal WhatsApp (35) ⭐
GET /api/dialogs?filter=(meta.type,eq,internal)&(meta.channelType,ne,telegram)

# External + НЕ whatsapp = external Telegram (15)
GET /api/dialogs?filter=(meta.type,eq,external)&(meta.channelType,ne,whatsapp)

# В массиве: type в [internal, external] (100)
GET /api/dialogs?filter=(meta.type,in,[internal,external])

# НЕ в массиве: channelType НЕ в [telegram] (50)
GET /api/dialogs?filter=(meta.channelType,nin,[telegram])
```

#### Все поддерживаемые операторы:

| Оператор | Описание | Пример |
|----------|----------|--------|
| `eq` | Равно | `(meta.type,eq,internal)` |
| `ne` | **НЕ равно** 🆕 | `(meta.channelType,ne,telegram)` |
| `in` | В массиве | `(meta.type,in,[internal,external])` |
| `nin` | НЕ в массиве | `(meta.channelType,nin,[telegram,whatsapp])` |
| `gt` | Больше | `(meta.maxParticipants,gt,50)` |
| `gte` | Больше или равно | `(meta.maxParticipants,gte,50)` |
| `lt` | Меньше | `(meta.maxParticipants,lt,10)` |
| `lte` | Меньше или равно | `(meta.maxParticipants,lte,10)` |
| `regex` | Регулярное выражение | `(meta.type,regex,^int)` |
| `exists` | Существование поля | `(meta.channelType,exists,true)` |

### 🎯 Математика распределения

- **По типу:** 70% internal, 30% external
- **По каналу:** 50% WhatsApp, 50% Telegram
- **По типу диалога:** ~34% private, ~34% group, ~33% channel

**Комбинированные фильтры:**
- Internal + WhatsApp: 70 × 0.5 = 35 диалогов ✅
- Internal + Telegram: 70 × 0.5 = 35 диалогов ✅
- External + WhatsApp: 30 × 0.5 = 15 диалогов ✅
- External + Telegram: 30 × 0.5 = 15 диалогов ✅

### 📝 Обновлена документация

- `README.md` - добавлена секция о тестовых данных с примерами фильтрации
- `src/scripts/seed.js` - обновлен для создания 100 диалогов с channelType

### 🛠️ Технические детали

#### Seed скрипт
- Генерирует 100 уникальных имен диалогов
- Чередует channelType (четные - whatsapp, нечетные - telegram)
- Чередует типы диалогов (private, group, channel)
- Создает 6 meta записей на каждый диалог

#### API фильтрация
- Используется MongoDB aggregation для фильтрации по Meta коллекции
- AND логика между множественными meta фильтрами
- Совместима с обычными query параметрами (type, isActive, etc.)

### 🔑 Новые API ключи

После пересоздания базы необходимо создать API ключи:

```bash
# Для Demo Company (где 100 диалогов)
npm run generate-api-key <tenant_id> "Demo Company API Key"

# Для System
npm run generate-api-key <system_tenant_id> "System API Key"
```

### ✅ Протестировано

- ✅ Фильтрация по `channelType=whatsapp` → 50 результатов
- ✅ Фильтрация по `channelType=telegram` → 50 результатов
- ✅ Комбинированный фильтр `type=internal&channelType=whatsapp` → 35 результатов
- ✅ Комбинированный фильтр `type=external&channelType=telegram` → 15 результатов
- ✅ Все meta теги отображаются в AdminJS
- ✅ Swagger UI работает корректно

### 🚀 Быстрый старт

```bash
# 1. Пересоздать базу с 100 диалогами
npm run seed

# 2. Получить tenant ID Demo Company
node -e "import('./src/config/database.js').then(db => db.default()).then(() => import('./src/models/index.js').then(m => m.Tenant.findOne({domain: 'demo.chat3.com'}).then(t => console.log(t._id))))"

# 3. Создать API ключ
npm run generate-api-key <tenant_id> "My API Key"

# 4. Тестировать в Swagger UI
# http://localhost:3000/api-docs
```

---

## Предыдущие версии

### [Initial] - 2025-10-23

- Первоначальная реализация Chat3
- MongoDB модели: Tenant, User, Dialog, DialogParticipant, Message, Meta, ApiKey
- REST API с аутентификацией по API ключу
- AdminJS панель без авторизации
- Swagger UI документация
- Системный бот
- Фильтрация по meta тегам
- 10 тестовых диалогов

