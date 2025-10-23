# 🚀 Chat3 REST API Documentation

## 📖 Обзор

REST API для управления чат-системой с мультитенантностью. Все запросы требуют аутентификации через API ключ.

## 🔐 Аутентификация

API использует ключи для аутентификации. Ключ передается в заголовке `X-API-Key`.

### Генерация API ключа

```bash
npm run generate-api-key
```

Пример сгенерированного ключа:
```
chat3_ff4448ef59df326327b90f49b8ecd00f9f909fec3420323faff758396be23a69
```

### Использование API ключа

Добавьте заголовок в каждый запрос:
```
X-API-Key: chat3_ваш_ключ_здесь
```

## 📍 Базовый URL

```
http://localhost:3000
```

## 🎯 Endpoints

### Tenants (Организации)

#### GET /api/tenants
Получить список всех организаций (с пагинацией)

**Query Parameters:**
- `page` (integer, optional) - Номер страницы (по умолчанию: 1)
- `limit` (integer, optional) - Элементов на странице (по умолчанию: 10)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Demo Company",
      "domain": "demo.chat3.com",
      "isActive": true,
      "settings": {},
      "createdAt": "2025-10-21T10:00:00.000Z",
      "updatedAt": "2025-10-21T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

#### GET /api/tenants/:id
Получить организацию по ID

**Parameters:**
- `id` (string, required) - MongoDB ObjectId организации

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Demo Company",
    "domain": "demo.chat3.com",
    "isActive": true,
    "settings": {},
    "createdAt": "2025-10-21T10:00:00.000Z",
    "updatedAt": "2025-10-21T10:00:00.000Z"
  }
}
```

#### POST /api/tenants
Создать новую организацию

**Request Body:**
```json
{
  "name": "New Company",
  "domain": "newcompany.com",
  "isActive": true,
  "settings": {
    "maxUsers": 100
  }
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "New Company",
    "domain": "newcompany.com",
    "isActive": true,
    "settings": {
      "maxUsers": 100
    },
    "createdAt": "2025-10-21T10:30:00.000Z",
    "updatedAt": "2025-10-21T10:30:00.000Z"
  },
  "message": "Tenant created successfully"
}
```

#### PUT /api/tenants/:id
Обновить организацию

**Request Body:**
```json
{
  "name": "Updated Company Name",
  "isActive": false
}
```

**Response:**
```json
{
  "data": { ... },
  "message": "Tenant updated successfully"
}
```

#### DELETE /api/tenants/:id
Удалить организацию

**Response:**
```json
{
  "message": "Tenant deleted successfully"
}
```

---

### Users (Пользователи)

#### GET /api/users
Получить список пользователей текущей организации

**Query Parameters:**
- `page` (integer, optional) - Номер страницы
- `limit` (integer, optional) - Элементов на странице
- `role` (string, optional) - Фильтр по роли: `admin`, `user`, `moderator`
- `isActive` (boolean, optional) - Фильтр по статусу активности

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "tenantId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Demo Company",
        "domain": "demo.chat3.com"
      },
      "username": "john_doe",
      "email": "john@demo.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "isActive": true,
      "lastSeen": "2025-10-21T10:00:00.000Z",
      "createdAt": "2025-10-21T09:00:00.000Z",
      "updatedAt": "2025-10-21T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1
  }
}
```

#### GET /api/users/:id
Получить пользователя по ID

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "username": "john_doe",
    "email": "john@demo.com",
    ...
  }
}
```

#### POST /api/users
Создать нового пользователя

**Request Body:**
```json
{
  "username": "jane_smith",
  "email": "jane@demo.com",
  "password": "secure_password",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "user",
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "username": "jane_smith",
    "email": "jane@demo.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "isActive": true,
    ...
  },
  "message": "User created successfully"
}
```

#### PUT /api/users/:id
Обновить пользователя

**Request Body:**
```json
{
  "firstName": "Jane Updated",
  "role": "moderator",
  "isActive": true
}
```

**Response:**
```json
{
  "data": { ... },
  "message": "User updated successfully"
}
```

#### DELETE /api/users/:id
Удалить пользователя

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

---

## 🔒 Права доступа (Permissions)

API ключи могут иметь следующие права:
- `read` - Чтение данных (GET запросы)
- `write` - Создание и обновление (POST, PUT запросы)
- `delete` - Удаление данных (DELETE запросы)

## ❌ Коды ошибок

### 400 Bad Request
Неверный формат запроса или валидация не прошла
```json
{
  "error": "Validation Error",
  "message": "User validation failed: email is required"
}
```

### 401 Unauthorized
Отсутствует или неверный API ключ
```json
{
  "error": "Unauthorized",
  "message": "API key is required. Please provide it in the X-API-Key header."
}
```

### 403 Forbidden
Недостаточно прав для выполнения операции
```json
{
  "error": "Forbidden",
  "message": "Permission 'delete' is required"
}
```

### 404 Not Found
Ресурс не найден
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

### 409 Conflict
Конфликт при создании (дубликат)
```json
{
  "error": "Conflict",
  "message": "User with this email already exists in this tenant"
}
```

### 500 Internal Server Error
Внутренняя ошибка сервера
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

---

## 📝 Примеры использования

### cURL

Получить список пользователей:
```bash
curl -H "X-API-Key: chat3_ваш_ключ" \
  http://localhost:3000/api/users
```

Создать пользователя:
```bash
curl -X POST \
  -H "X-API-Key: chat3_ваш_ключ" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@demo.com",
    "password": "password123",
    "firstName": "New",
    "lastName": "User"
  }' \
  http://localhost:3000/api/users
```

### JavaScript (fetch)

```javascript
const apiKey = 'chat3_ваш_ключ';

// GET запрос
fetch('http://localhost:3000/api/users', {
  headers: {
    'X-API-Key': apiKey
  }
})
  .then(res => res.json())
  .then(data => console.log(data));

// POST запрос
fetch('http://localhost:3000/api/users', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'newuser',
    email: 'newuser@demo.com',
    password: 'password123',
    firstName: 'New',
    lastName: 'User'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### Python (requests)

```python
import requests

api_key = 'chat3_ваш_ключ'
headers = {'X-API-Key': api_key}

# GET запрос
response = requests.get('http://localhost:3000/api/users', headers=headers)
print(response.json())

# POST запрос
data = {
    'username': 'newuser',
    'email': 'newuser@demo.com',
    'password': 'password123',
    'firstName': 'New',
    'lastName': 'User'
}
response = requests.post('http://localhost:3000/api/users', 
                        json=data, 
                        headers=headers)
print(response.json())
```

---

## 🧪 Swagger UI

Интерактивная документация доступна по адресу:
```
http://localhost:3000/api-docs
```

В Swagger UI вы можете:
1. Просмотреть все endpoints
2. Протестировать запросы
3. Увидеть примеры ответов
4. Нажать "Authorize" и ввести API ключ для тестирования

---

## 🔧 Управление API ключами

### Создать новый ключ

```bash
# Использовать первую организацию
npm run generate-api-key

# Указать ID организации
npm run generate-api-key 507f1f77bcf86cd799439011

# С именем
npm run generate-api-key 507f1f77bcf86cd799439011 "Production Key"

# С ограниченными правами (только чтение)
npm run generate-api-key 507f1f77bcf86cd799439011 "Read Only Key" read

# С несколькими правами
npm run generate-api-key 507f1f77bcf86cd799439011 "Write Key" read,write
```

### Управление через админ-панель

API ключи также можно создавать и управлять ими через админ-панель:
```
http://localhost:3000/admin
```

В разделе "ApiKeys" вы можете:
- Просмотреть все ключи
- Создать новые
- Деактивировать ключи
- Установить срок действия
- Изменить права доступа

---

## 🎓 Дополнительная информация

- Все даты возвращаются в формате ISO 8601
- Все ID используют формат MongoDB ObjectId
- Пагинация доступна для всех списочных endpoints
- Пароли пользователей не возвращаются в ответах API
- Пользователи автоматически привязываются к организации API ключа

