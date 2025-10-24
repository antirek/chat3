# API Endpoints Guide

## 🎯 Выбор правильного endpoint'а

### **Для простых запросов** → `/api/users/{userId}/dialogs`

**Когда использовать:**
- ✅ Получение диалогов конкретного пользователя
- ✅ Простая пагинация
- ✅ Базовая сортировка
- ✅ Мобильные приложения
- ✅ Быстрые запросы

**Примеры:**
```javascript
// Получить диалоги пользователя Carl
GET /api/users/carl/dialogs?page=1&limit=10

// С сортировкой по времени последнего просмотра
GET /api/users/carl/dialogs?page=1&limit=10&sort=lastSeenAt&direction=desc

// С сортировкой по количеству непрочитанных
GET /api/users/carl/dialogs?page=1&limit=10&sort=unreadCount&direction=desc
```

### **Для сложных запросов** → `/api/dialogs`

**Когда использовать:**
- ✅ Фильтрация по нескольким участникам
- ✅ Мета-фильтры (тип канала, уровень безопасности)
- ✅ Комбинированные фильтры
- ✅ Сортировка по полям участников
- ✅ Административные панели
- ✅ Аналитика и отчеты

**Примеры:**
```javascript
// Фильтр по участникам
GET /api/dialogs?filter=(member,eq,carl)

// Фильтр по нескольким участникам
GET /api/dialogs?filter=(member,eq,carl)&(member,eq,marta)

// Мета-фильтры
GET /api/dialogs?filter=(meta.channelType,eq,whatsapp)

// Комбинированные фильтры
GET /api/dialogs?filter=(member,eq,carl)&(meta.channelType,eq,whatsapp)

// Сортировка по участникам
GET /api/dialogs?filter=(member,eq,carl)&sort=(member[carl].unreadCount,desc)

// Сложные запросы
GET /api/dialogs?filter=(member,eq,carl)&(meta.channelType,eq,whatsapp)&sort=(member[carl].unreadCount,desc)
```

## 🔧 Технические детали

### **Производительность**
- **`/api/users/{userId}/dialogs`** - быстрые запросы, простая логика
- **`/api/dialogs`** - гибкие запросы, сложная агрегация

### **Поддержка фильтров**
- **`/api/users/{userId}/dialogs`** - только базовые фильтры
- **`/api/dialogs`** - полная поддержка всех фильтров

### **Сортировка**
- **`/api/users/{userId}/dialogs`** - базовая сортировка
- **`/api/dialogs`** - расширенная сортировка по участникам

## 📱 Примеры использования

### **Мобильное приложение**
```javascript
// Получить диалоги пользователя
const response = await fetch('/api/users/carl/dialogs?page=1&limit=20');
```

### **Административная панель**
```javascript
// Сложный запрос с фильтрами
const response = await fetch('/api/dialogs?filter=(member,eq,carl)&(meta.channelType,eq,whatsapp)&sort=(member[carl].unreadCount,desc)');
```

### **Аналитика**
```javascript
// Получить все диалоги с высоким уровнем безопасности
const response = await fetch('/api/dialogs?filter=(meta.securityLevel,eq,high)');
```

## 🚀 Рекомендации

1. **Начните с простого** - используйте `/api/users/{userId}/dialogs` для базовых случаев
2. **Переходите к сложному** - используйте `/api/dialogs` когда нужна гибкость
3. **Кэшируйте результаты** - особенно для сложных запросов
4. **Используйте пагинацию** - для больших наборов данных
5. **Тестируйте производительность** - выбирайте подходящий endpoint
