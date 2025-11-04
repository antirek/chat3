# Аутентификация и Мультитенантность в Chat3

## Обзор

Chat3 использует систему аутентификации на основе API ключей с поддержкой мультитенантности через HTTP заголовки.

### Ключевые особенности

✅ **Системные API ключи** - не привязаны к конкретному tenant  
✅ **Tenant из заголовка** - определяется через `X-TENANT-ID`  
✅ **Default tenant** - автоматически используется `tnt_default` если заголовок не указан  
✅ **Уникальный tenantId** - формат `tnt_XXXXXXXX` (8 символов: буквы + цифры)

## Архитектура

```
┌─────────────────┐
│     Client      │
└────────┬────────┘
         │ HTTP Request
         │ X-API-Key: chat3_...
         │ X-TENANT-ID: tnt_demo1234 (optional)
         │
┌────────▼────────┐
│   apiAuth       │
│   Middleware    │
├─────────────────┤
│ 1. Проверить    │
│    API Key      │
│ 2. Извлечь      │
│    tenantId     │
│ 3. Проверить    │
│    tenant       │
└────────┬────────┘
         │
┌────────▼────────┐
│  req.tenantId   │ → 'tnt_demo1234'
│  req.tenant     │ → {Tenant Object}
│  req.apiKey     │ → {ApiKey Object}
└─────────────────┘
```

## TenantID формат

### Структура
```
tnt_<8 символов>
```

- **Префикс**: `tnt_` (обязательный)
- **Символы**: Английские строчные буквы + цифры (a-z0-9)
- **Длина**: 8 символов после префикса
- **Примеры**: `tnt_demo1234`, `tnt_a1b2c3d4`, `tnt_default`

### Специальные tenantId
- `tnt_default` - используется когда `X-TENANT-ID` не указан

### Генерация

TenantId генерируется автоматически при создании tenant:

```javascript
// В модели Tenant есть pre-save хук
function generateTenantId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'tnt_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

Можно также указать свой tenantId при создании:
```javascript
const tenant = await Tenant.create({
  tenantId: 'tnt_mycompany', // Опционально
  name: 'My Company',
  domain: 'mycompany.com'
});
```

## API Ключи

### Характеристики

- **Системные**: Один ключ работает со всеми tenants
- **Permissions**: `read`, `write`, `delete`
- **Формат**: `chat3_` + 64 hex символа
- **Поля**: `name`, `description`, `permissions`, `isActive`, `expiresAt`

### Создание

```bash
# Базовый ключ со всеми правами
npm run generate-key

# С именем и описанием
npm run generate-key "Production Key" "For production API"

# С ограниченными правами
npm run generate-key "Read Only" "Read access only" read

# Для demo tenant
npm run generate-demo-key
```

### Пример API ключа

```json
{
  "_id": "...",
  "key": "chat3_a1b2c3d4e5f6...",
  "name": "Production Key",
  "description": "For production API",
  "permissions": ["read", "write", "delete"],
  "isActive": true,
  "expiresAt": null,
  "lastUsedAt": "2025-11-04T10:30:00.000Z"
}
```

## Использование

### 1. Базовый запрос (default tenant)

```bash
curl -H "X-API-Key: chat3_a1b2c3d4..." \
  http://localhost:3000/api/dialogs
```

**Результат**: Используется `tnt_default`

### 2. Запрос с конкретным tenant

```bash
curl -H "X-API-Key: chat3_a1b2c3d4..." \
     -H "X-TENANT-ID: tnt_demo1234" \
  http://localhost:3000/api/dialogs
```

**Результат**: Используется `tnt_demo1234`

### 3. Создание ресурса

```bash
curl -X POST \
  -H "X-API-Key: chat3_a1b2c3d4..." \
  -H "X-TENANT-ID: tnt_demo1234" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Dialog", "createdBy": "alice"}' \
  http://localhost:3000/api/dialogs
```

## Middleware Flow

### apiAuth.js

```javascript
export const apiAuth = async (req, res, next) => {
  // 1. Проверить X-API-Key
  const apiKey = req.headers['x-api-key'];
  const key = await ApiKey.findOne({ key: apiKey });
  
  if (!key || !key.isValid()) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // 2. Получить tenantId из X-TENANT-ID или использовать default
  let tenantId = req.headers['x-tenant-id'] || 'tnt_default';
  tenantId = tenantId.toLowerCase().trim();
  
  // 3. Проверить существование tenant
  const tenant = await Tenant.findOne({ 
    tenantId: tenantId, 
    isActive: true 
  });
  
  if (!tenant) {
    return res.status(404).json({ 
      error: `Tenant '${tenantId}' not found` 
    });
  }
  
  // 4. Добавить в request
  req.apiKey = key;
  req.tenantId = tenant.tenantId;  // String
  req.tenant = tenant;
  req.tenantObjectId = tenant._id; // ObjectId
  
  next();
};
```

### requirePermission

```javascript
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey.permissions.includes(permission)) {
      return res.status(403).json({
        error: `Permission '${permission}' required`
      });
    }
    next();
  };
};
```

## Модель Tenant

```javascript
const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    match: /^tnt_[a-z0-9]{8}$/,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['system', 'client'],
    default: 'client'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
});
```

## Модель ApiKey

```javascript
const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete']
  }],
  expiresAt: {
    type: Date
  },
  lastUsedAt: {
    type: Date
  }
});
```

## Все модели с tenantId

Все основные модели используют `tenantId` как String:

```javascript
tenantId: {
  type: String,
  required: true,
  index: true,
  match: /^tnt_[a-z0-9]{8}$/
}
```

**Модели**:
- Dialog
- Message
- DialogMember
- MessageStatus
- MessageReaction
- Meta
- Event
- Update

## Примеры использования

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'X-API-Key': 'chat3_a1b2c3d4...',
    'X-TENANT-ID': 'tnt_demo1234'
  }
});

// Получить диалоги
const dialogs = await api.get('/dialogs');

// Создать сообщение
const message = await api.post('/dialogs/123/messages', {
  content: 'Hello!',
  senderId: 'alice',
  type: 'text'
});
```

### Python

```python
import requests

headers = {
    'X-API-Key': 'chat3_a1b2c3d4...',
    'X-TENANT-ID': 'tnt_demo1234',
    'Content-Type': 'application/json'
}

# Получить диалоги
response = requests.get(
    'http://localhost:3000/api/dialogs',
    headers=headers
)
dialogs = response.json()

# Создать сообщение
response = requests.post(
    'http://localhost:3000/api/dialogs/123/messages',
    headers=headers,
    json={
        'content': 'Hello!',
        'senderId': 'alice',
        'type': 'text'
    }
)
```

### cURL

```bash
# Получить диалоги
curl -H "X-API-Key: chat3_..." \
     -H "X-TENANT-ID: tnt_demo1234" \
     http://localhost:3000/api/dialogs

# Создать диалог
curl -X POST \
     -H "X-API-Key: chat3_..." \
     -H "X-TENANT-ID: tnt_demo1234" \
     -H "Content-Type: application/json" \
     -d '{"name": "New Chat", "createdBy": "alice"}' \
     http://localhost:3000/api/dialogs

# Получить сообщения
curl -H "X-API-Key: chat3_..." \
     -H "X-TENANT-ID: tnt_demo1234" \
     http://localhost:3000/api/dialogs/123/messages
```

## Errors

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "API key is required"
}
```

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Permission 'write' is required"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "Tenant 'tnt_invalid' not found or inactive"
}
```

## Best Practices

### 1. Безопасность

✅ Храните API ключи в переменных окружения  
✅ Используйте HTTPS в production  
✅ Регулярно ротируйте ключи  
✅ Устанавливайте `expiresAt` для временных ключей  
✅ Используйте минимальные permissions

### 2. Производительность

✅ Кэшируйте tenant объект на уровне приложения  
✅ Используйте connection pooling для MongoDB  
✅ Добавьте CDN для статических ресурсов  

### 3. Мониторинг

✅ Логируйте все API запросы с tenantId  
✅ Отслеживайте `lastUsedAt` для неактивных ключей  
✅ Мониторьте количество запросов по tenant  
✅ Настройте алерты для неудачных аутентификаций

## Migration из старой схемы

Если вы обновляете существующую систему:

### 1. Backup данных
```bash
mongodump --db chat3 --out ./backup
```

### 2. Обновить Tenant
```javascript
// Добавить tenantId ко всем существующим tenants
const tenants = await Tenant.find({});
for (const tenant of tenants) {
  if (!tenant.tenantId) {
    tenant.tenantId = generateTenantId();
    await tenant.save();
  }
}
```

### 3. Обновить все ссылки
```javascript
// Заменить ObjectId на String во всех моделях
// Dialog, Message, etc.
const dialogs = await Dialog.find({});
for (const dialog of dialogs) {
  const tenant = await Tenant.findById(dialog.tenantId);
  dialog.tenantId = tenant.tenantId; // String
  await dialog.save();
}
```

### 4. Пересоздать API ключи
```bash
# Старые ключи не будут работать
npm run generate-key "Migration Key"
```

## Troubleshooting

### Tenant not found

**Проблема**: `Tenant 'tnt_xxx' not found`

**Решение**:
```bash
# Проверить существующие tenants
mongo chat3 --eval "db.tenants.find({}, {tenantId:1, name:1})"

# Создать недостающий tenant
npm run seed
```

### Invalid API key

**Проблема**: `Invalid API key`

**Решение**:
```bash
# Создать новый ключ
npm run generate-key

# Проверить существующие ключи
mongo chat3 --eval "db.apikeys.find({isActive:true}, {name:1, key:1})"
```

### Permission denied

**Проблема**: `Permission 'write' required`

**Решение**: Используйте ключ с правами `write` или создайте новый:
```bash
npm run generate-key "Write Key" "Full access" read,write,delete
```

## Заключение

Новая система аутентификации обеспечивает:
- ✅ Гибкость - один ключ для всех tenants
- ✅ Безопасность - изоляция данных по tenantId
- ✅ Простоту - легко переключаться между tenants
- ✅ Масштабируемость - нет привязки ключей к tenants

Для дополнительной информации см.:
- [README.md](README.md) - Основная документация
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура системы
- [API.md](API.md) - API endpoints


