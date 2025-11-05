# 🐰 RabbitMQ - Обязательная Зависимость

## ⚠️ Важно

**RabbitMQ является критически важной зависимостью для Chat3.** 

Сервер **НЕ запустится** без успешного подключения к RabbitMQ.

---

## 📋 Что изменилось

### До исправления:

```javascript
// ❌ Плохо - сервер запускается даже без RabbitMQ
rabbitmqUtils.initRabbitMQ().catch(err => {
  console.warn('⚠️  RabbitMQ initialization failed, continuing without it:', err.message);
});
```

**Проблема:**
- События создаются в MongoDB, но НЕ публикуются в RabbitMQ
- Update Worker не получает события
- Updates не создаются
- Пользователи не получают уведомления

### После исправления:

```javascript
// ✅ Хорошо - сервер останавливается, если RabbitMQ недоступен
console.log('🐰 Initializing RabbitMQ connection...');
const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();

if (!rabbitmqConnected) {
  console.error('❌ CRITICAL ERROR: Failed to connect to RabbitMQ');
  console.error('❌ RabbitMQ is a required dependency for Chat3');
  process.exit(1);
}

console.log('✅ RabbitMQ connection established successfully');
```

**Преимущества:**
- ✅ Гарантия подключения к RabbitMQ при старте
- ✅ Все события публикуются в RabbitMQ
- ✅ Update Worker получает все события
- ✅ Updates создаются для всех участников
- ✅ Система работает полностью

---

## 🚀 Порядок запуска сервисов

### 1. Запуск RabbitMQ (ПЕРВЫМ!)

```bash
# Docker
docker-compose up -d rabbitmq

# Или отдельный контейнер
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=rmuser \
  -e RABBITMQ_DEFAULT_PASS=rmpassword \
  rabbitmq:3-management

# Проверка
curl http://localhost:15672/api/overview
```

### 2. Запуск MongoDB

```bash
docker-compose up -d mongodb

# Проверка
mongosh --eval "db.version()"
```

### 3. Запуск Chat3 API

```bash
node src/index.js
# или
npm start
```

**Ожидаемый вывод:**

```
MongoDB connected successfully
🐰 Initializing RabbitMQ connection...
🐰 Connecting to RabbitMQ: amqp://***:***@localhost:5672/
✅ RabbitMQ connected successfully
   Exchange: chat3_events (topic)
   Queue: chat3_events (TTL: 1 hour)
   Routing: All events (#) -> chat3_events
   Updates Exchange: chat3_updates (topic)
   User: rmuser
✅ RabbitMQ connection established successfully

🚀 Server is running on http://localhost:3000

📡 Services Status:
   MongoDB: ✅ Connected
   RabbitMQ: ✅ Connected (chat3_events)
```

### 4. Запуск Update Worker

```bash
node src/workers/updateWorker.js
# или
./start-worker.sh
```

---

## 🔍 Проверка подключения

### 1. Health Check Endpoint

```bash
curl http://localhost:3000/health | jq '.services'
```

**Ожидаемый ответ:**

```json
{
  "mongodb": "connected",
  "rabbitmq": "connected"
}
```

### 2. RabbitMQ Management UI

Откройте: http://localhost:15672

- **Username:** `rmuser`
- **Password:** `rmpassword`

Проверьте:
- ✅ Exchange `chat3_events` существует
- ✅ Exchange `chat3_updates` существует
- ✅ Queue `update_worker_queue` имеет 1 consumer

### 3. Проверка публикации событий

```bash
# Создайте тестовое сообщение
curl -X POST http://localhost:3000/api/dialogs/{dialogId}/messages \
  -H "X-API-Key: YOUR_KEY" \
  -H "X-TENANT-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "test_user",
    "content": "Test message",
    "type": "text"
  }'

# Проверьте статистику публикаций
curl -s -u rmuser:rmpassword \
  http://localhost:15672/api/exchanges/%2F/chat3_events | \
  jq '.message_stats.publish'

# Должно быть > 0
```

---

## ❌ Что происходит при недоступности RabbitMQ

### Сценарий 1: RabbitMQ недоступен при старте API

```
MongoDB connected successfully
🐰 Initializing RabbitMQ connection...
🐰 Connecting to RabbitMQ: amqp://***:***@localhost:5672/
❌ Failed to connect to RabbitMQ: connect ECONNREFUSED 127.0.0.1:5672
❌ CRITICAL ERROR: Failed to connect to RabbitMQ
❌ RabbitMQ is a required dependency for Chat3

Please ensure:
  1. RabbitMQ is running (docker-compose up -d rabbitmq)
  2. Connection settings are correct:
     RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/

Server startup aborted.
```

**Сервер НЕ запустится!** ✅

### Сценарий 2: RabbitMQ отключается во время работы

RabbitMQ имеет автоматическое переподключение:

```javascript
connection.on('close', () => {
  console.warn('⚠️  RabbitMQ connection closed');
  isConnected = false;
  // Попытка переподключения через 5 секунд
  setTimeout(() => {
    console.log('🔄 Attempting to reconnect to RabbitMQ...');
    initRabbitMQ();
  }, 5000);
});
```

**Health check покажет:**

```json
{
  "status": "degraded",
  "message": "Chat3 API is running but RabbitMQ is disconnected",
  "services": {
    "mongodb": "connected",
    "rabbitmq": "disconnected"
  }
}
```

HTTP Status: `503 Service Unavailable`

---

## 🔧 Переменные окружения

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/

# Или отдельные параметры:
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=rmuser
RABBITMQ_PASSWORD=rmpassword
RABBITMQ_VHOST=/

# Exchange names (опционально)
RABBITMQ_EXCHANGE=chat3_events
```

### Для Docker:

```yaml
# docker-compose.yml
services:
  chat3-api:
    environment:
      - RABBITMQ_URL=amqp://rmuser:rmpassword@rabbitmq:5672/
    depends_on:
      - rabbitmq
      - mongodb
```

**⚠️ Важно:** Используйте `depends_on` чтобы гарантировать, что RabbitMQ запустится раньше API!

---

## 🐛 Устранение проблем

### Проблема: Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Решение:**

```bash
# 1. Проверьте, запущен ли RabbitMQ
docker ps | grep rabbitmq

# 2. Запустите RabbitMQ
docker-compose up -d rabbitmq

# 3. Проверьте логи
docker logs rabbitmq

# 4. Дождитесь полной инициализации (30-60 сек)
# 5. Запустите API сервер
node src/index.js
```

### Проблема: Authentication Failed

```
Error: ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN
```

**Решение:**

Проверьте credentials:

```bash
# В RabbitMQ Management UI
curl -u rmuser:rmpassword http://localhost:15672/api/whoami

# Должно вернуть:
# {"name":"rmuser","tags":"administrator"}
```

Если нет - пересоздайте пользователя:

```bash
docker exec rabbitmq rabbitmqctl add_user rmuser rmpassword
docker exec rabbitmq rabbitmqctl set_user_tags rmuser administrator
docker exec rabbitmq rabbitmqctl set_permissions -p / rmuser ".*" ".*" ".*"
```

### Проблема: События создаются, но не публикуются

```
Events в MongoDB: 100
RabbitMQ publish stats: 0
```

**Диагностика:**

```bash
# Проверьте isConnected
node -e "import('./src/utils/rabbitmqUtils.js').then(r => console.log(r.isRabbitMQConnected()))"

# Проверьте health
curl http://localhost:3000/health | jq '.services.rabbitmq'
```

**Решение:** Перезапустите API сервер (теперь он не запустится без RabbitMQ!)

---

## 📊 Мониторинг

### 1. Health Check мониторинг

```bash
# Скрипт для мониторинга
while true; do
  STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')
  if [ "$STATUS" != "ok" ]; then
    echo "⚠️  ALERT: Service is degraded!"
    curl -s http://localhost:3000/health | jq '.services'
  fi
  sleep 30
done
```

### 2. RabbitMQ Metrics

```bash
# Статистика публикаций
curl -s -u rmuser:rmpassword \
  http://localhost:15672/api/exchanges/%2F/chat3_events | \
  jq '.message_stats'

# Статистика очередей
curl -s -u rmuser:rmpassword \
  http://localhost:15672/api/queues | \
  jq '.[] | {name, messages, consumers}'
```

### 3. Prometheus Metrics (TODO)

В будущем можно добавить:
- `chat3_rabbitmq_connected` (gauge)
- `chat3_rabbitmq_publish_total` (counter)
- `chat3_rabbitmq_publish_errors_total` (counter)

---

## 📚 Связанные документы

- **[UPDATES.md](UPDATES.md)** - Система Updates
- **[EVENTS.md](EVENTS.md)** - Система событий
- **[WORKERS.md](WORKERS.md)** - Update Worker
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Архитектура

---

## 🎯 Чеклист при деплое

- [ ] RabbitMQ запущен и доступен
- [ ] Проверен `/health` endpoint (status: "ok")
- [ ] Проверена статистика публикаций (> 0)
- [ ] Update Worker запущен (1 consumer)
- [ ] Создано тестовое сообщение
- [ ] Updates созданы для участников
- [ ] Логи не содержат ошибок RabbitMQ

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-11-05  
**Критичность:** 🔴 ВЫСОКАЯ

