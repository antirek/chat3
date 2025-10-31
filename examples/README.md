# Примеры использования Chat3

## RabbitMQ Consumer

Пример подписчика на события Chat3 через RabbitMQ.

### Запуск

1. Убедитесь, что RabbitMQ запущен:
```bash
docker-compose up -d rabbitmq
```

2. Запустите Chat3 сервер:
```bash
npm start
```

3. В отдельном терминале запустите consumer:
```bash
node examples/rabbitmq-consumer.js
```

### Тестирование

Создайте событие через API:

```bash
# Создать диалог (генерирует событие dialog.create)
curl -X POST http://localhost:3000/api/dialogs \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dialog", "createdBy": "carl"}'

# Создать сообщение (генерирует событие message.create)
curl -X POST http://localhost:3000/api/dialogs/DIALOG_ID/messages \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!", "senderId": "carl"}'
```

Consumer автоматически получит и обработает эти события.

### Настройка паттернов подписки

Редактируйте массив `ROUTING_PATTERNS` в `rabbitmq-consumer.js`:

```javascript
const ROUTING_PATTERNS = [
  '*.create.*',   // Все события создания
  '*.delete.*',   // Все события удаления
  'message.*.*',  // Все события сообщений
  'dialog.*.*',   // Все события диалогов
  '#',            // Все события
];
```

### Формат routing key

```
{entityType}.{action}.{tenantId}
```

Примеры:
- `dialog.create.6541a1b2c3d4e5f6g7h8i9j0`
- `message.create.6541a1b2c3d4e5f6g7h8i9j0`
- `dialogMember.add.6541a1b2c3d4e5f6g7h8i9j0`

### Подробнее

См. [EVENTS.md](../EVENTS.md) для полной документации по системе событий.

