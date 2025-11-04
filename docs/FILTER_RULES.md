# Правила работы фильтров в Chat3 API

## 📋 Обзор

В Chat3 API используются два основных endpoint для работы с диалогами, каждый со своими правилами фильтрации:

1. **`/api/dialogs`** - глобальный поиск по всем диалогам
2. **`/api/users/{userId}/dialogs`** - диалоги конкретного пользователя

## 🎯 Основные принципы

### 1. Контекст фильтрации

| Endpoint | Контекст | Пользователь в фильтре |
|----------|----------|----------------------|
| `/api/dialogs` | Глобальный поиск | ✅ Обязательно указывать |
| `/api/users/{userId}/dialogs` | Диалоги пользователя | ❌ Уже указан в URL |

### 2. Синтаксис полей

#### Для `/api/dialogs`:
```javascript
// Поля пользователя
(member[carl].unreadCount,gte,3)
(member[marta].lastSeenAt,gt,2024-01-01)

// Мета-теги
(meta.channelType,eq,whatsapp)
(meta.securityLevel,in,[high,medium])
```

#### Для `/api/users/{userId}/dialogs`:
```javascript
// Поля пользователя (без member[userId])
(unreadCount,gte,3)
(lastSeenAt,gt,2024-01-01)

// Мета-теги (без изменений)
(meta.channelType,eq,whatsapp)
(meta.securityLevel,in,[high,medium])
```

## 🔧 Операторы сравнения

| Оператор | Описание | Пример |
|----------|----------|--------|
| `eq` | Равно | `(unreadCount,eq,0)` |
| `gt` | Больше | `(unreadCount,gt,0)` |
| `gte` | Больше или равно | `(unreadCount,gte,3)` |
| `lt` | Меньше | `(unreadCount,lt,10)` |
| `lte` | Меньше или равно | `(unreadCount,lte,5)` |
| `in` | В списке | `(meta.securityLevel,in,[high,medium])` |
| `regex` | Регулярное выражение | `(meta.channelType,regex,^whats)` |

## 📊 Доступные поля

### Поля пользователя

| Поле | Описание | Доступно в |
|------|----------|------------|
| `unreadCount` | Количество непрочитанных | Оба endpoint |
| `lastSeenAt` | Время последнего просмотра | Оба endpoint |

### Мета-теги

| Поле | Описание | Тип | Примеры значений |
|------|----------|-----|------------------|
| `channelType` | Тип канала | string | `whatsapp`, `telegram` |
| `type` | Тип диалога | string | `internal`, `external` |
| `securityLevel` | Уровень безопасности | string | `high`, `medium`, `low` |
| `maxParticipants` | Макс. участников | number | `50`, `100` |

## 🔗 Комбинирование фильтров

### Логические операторы

| Оператор | Описание | Пример |
|----------|----------|--------|
| `&` | И (AND) | `(unreadCount,gte,3)&(meta.channelType,eq,whatsapp)` |
| `\|` | ИЛИ (OR) | `(meta.type,eq,internal)\|(meta.type,eq,external)` |

### Примеры комбинированных фильтров

#### Для `/api/dialogs`:
```javascript
// Carl с ≥3 непрочитанными в WhatsApp
(member[carl].unreadCount,gte,3)&(meta.channelType,eq,whatsapp)

// Marta с 0 непрочитанными во внутренних диалогах
(member[marta].unreadCount,eq,0)&(meta.type,eq,internal)

// Sara с непрочитанными в Telegram или WhatsApp
(member[sara].unreadCount,gt,0)&(meta.channelType,in,[telegram,whatsapp])
```

#### Для `/api/users/{userId}/dialogs`:
```javascript
// ≥3 непрочитанных в WhatsApp
(unreadCount,gte,3)&(meta.channelType,eq,whatsapp)

// 0 непрочитанных во внутренних диалогах
(unreadCount,eq,0)&(meta.type,eq,internal)

// Непрочитанные в Telegram или WhatsApp
(unreadCount,gt,0)&(meta.channelType,in,[telegram,whatsapp])
```

## 📝 Примеры готовых фильтров

### Базовые фильтры по мета-тегам

```javascript
// Тип канала
(meta.channelType,eq,whatsapp)
(meta.channelType,eq,telegram)

// Тип диалога
(meta.type,eq,internal)
(meta.type,eq,external)

// Уровень безопасности
(meta.securityLevel,eq,high)
(meta.securityLevel,in,[high,medium])

// Количество участников
(meta.maxParticipants,gte,50)
(meta.maxParticipants,eq,50)
```

### Комбинированные фильтры

```javascript
// WhatsApp + высокий уровень безопасности
(meta.channelType,eq,whatsapp)&(meta.securityLevel,eq,high)

// Внутренний + 50 участников
(meta.type,eq,internal)&(meta.maxParticipants,eq,50)

// Telegram + высокий уровень безопасности
(meta.channelType,eq,telegram)&(meta.securityLevel,eq,high)
```

### Фильтры с количеством непрочитанных

#### Для `/api/dialogs`:
```javascript
// Carl с ≥3 непрочитанными + WhatsApp
(member[carl].unreadCount,gte,3)&(meta.channelType,eq,whatsapp)

// Marta с 0 непрочитанными + Внутренний
(member[marta].unreadCount,eq,0)&(meta.type,eq,internal)

// Sara с непрочитанными + Высокий уровень
(member[sara].unreadCount,gt,0)&(meta.securityLevel,eq,high)
```

#### Для `/api/users/{userId}/dialogs`:
```javascript
// ≥3 непрочитанных + WhatsApp
(unreadCount,gte,3)&(meta.channelType,eq,whatsapp)

// 0 непрочитанных + Внутренний
(unreadCount,eq,0)&(meta.type,eq,internal)

// Непрочитанные + Высокий уровень
(unreadCount,gt,0)&(meta.securityLevel,eq,high)
```

## 🚨 Важные правила

### 1. Не смешивайте синтаксисы
```javascript
// ❌ Неправильно для /api/users/{userId}/dialogs
(member[carl].unreadCount,gte,3)

// ✅ Правильно для /api/users/{userId}/dialogs
(unreadCount,gte,3)
```

### 2. Пользователь в URL vs фильтре
```javascript
// ❌ Неправильно - дублирование пользователя
GET /api/users/carl/dialogs?filter=(member[carl].unreadCount,gte,3)

// ✅ Правильно - пользователь в URL
GET /api/users/carl/dialogs?filter=(unreadCount,gte,3)
```

### 3. Мета-теги одинаковы для обоих endpoints
```javascript
// ✅ Работает везде
(meta.channelType,eq,whatsapp)
(meta.securityLevel,eq,high)
(meta.maxParticipants,gte,50)
```

## 🔍 Отладка фильтров

### Проверка синтаксиса
1. Убедитесь, что используете правильный синтаксис для endpoint
2. Проверьте, что все скобки закрыты
3. Убедитесь, что операторы корректны

### Тестирование
1. Начните с простых фильтров
2. Постепенно добавляйте условия
3. Проверяйте результаты в интерфейсе

## 📚 Дополнительные ресурсы

- **API Endpoints Guide**: `API_ENDPOINTS_GUIDE.md`
- **Двухколоночный интерфейс**: `api-test-dialogs.html`
- **Трехколоночный интерфейс**: `api-test-user-dialogs.html`

## 🎯 Быстрая справка

| Что нужно | `/api/dialogs` | `/api/users/{userId}/dialogs` |
|-----------|----------------|-------------------------------|
| Поле пользователя | `member[userId].field` | `field` |
| Мета-теги | `meta.field` | `meta.field` |
| Пользователь | В фильтре | В URL |
| Пример | `(member[carl].unreadCount,gte,3)` | `(unreadCount,gte,3)` |
