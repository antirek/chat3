# 🔄 Инструкции по перезапуску проекта

## Автоматический перезапуск

Используйте готовый скрипт:

```bash
./restart-all.sh
```

Или:

```bash
bash restart-all.sh
```

---

## Ручной перезапуск

### 1. Остановка процессов

```bash
# Остановить все Node.js процессы
pkill -f "node"

# Или более точечно:
pkill -f "node src/index.js"
pkill -f "updateWorker"
```

### 2. Запуск API Server

```bash
cd /home/sergey/Projects/tmp3/chat3
npm start > /tmp/chat3.log 2>&1 &
```

**Или без npm:**
```bash
cd /home/sergey/Projects/tmp3/chat3
node src/index.js > /tmp/chat3.log 2>&1 &
```

### 3. Запуск Update Worker

```bash
cd /home/sergey/Projects/tmp3/chat3
node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
```

**Или используя скрипт:**
```bash
./start-worker.sh
```

### 4. Проверка статуса

```bash
# Проверить запущенные процессы
ps aux | grep node | grep -v grep

# Посмотреть логи API
tail -f /tmp/chat3.log

# Посмотреть логи Worker
tail -f /tmp/worker.log
```

---

## Быстрая проверка работоспособности

### Проверка API

```bash
API_KEY="chat3_edabb7b0fb722074c0d2efcc262f386fa23708adef9115392d79b4e5774e3d28"

# Получить список tenants
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/tenants

# Получить диалоги demo tenant
curl -H "X-API-Key: $API_KEY" \
     -H "X-TENANT-ID: tnt_7dbe1ris" \
     http://localhost:3000/api/dialogs?limit=2
```

### Проверка новых dialogId и messageId

```bash
# Создать тестовый диалог
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "X-TENANT-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Dialog","createdBy":"test_user"}' \
  http://localhost:3000/api/dialogs

# Ответ должен содержать dialogId в формате: dlg_XXXXXXXXXXXXXXXXXXXX
```

---

## Проверка AdminJS

Откройте в браузере:
- http://localhost:3000/admin
- http://localhost:3000/api-docs

В AdminJS проверьте модели Dialog и Message - должны отображаться поля:
- `dialogId` (формат: dlg_...)
- `messageId` (формат: msg_...)

---

## Решение проблем

### Сервер не запускается

1. Проверьте MongoDB:
```bash
sudo systemctl status mongodb
# или
sudo systemctl status mongod
```

2. Проверьте RabbitMQ:
```bash
sudo systemctl status rabbitmq-server
```

3. Проверьте порт 3000:
```bash
lsof -i :3000
# Если занят, остановите процесс или измените порт
```

### Worker не работает

1. Проверьте логи:
```bash
tail -50 /tmp/worker.log
```

2. Проверьте подключение к RabbitMQ:
```bash
sudo rabbitmqctl list_queues
sudo rabbitmqctl list_exchanges
```

### Ошибки валидации для dialogId/messageId

Если видите ошибки типа:
```
ValidationError: dialogId: Path `dialogId` is invalid
```

Это значит что старые данные не имеют dialogId. Варианты:
1. Очистить БД и запустить seed заново
2. Мигрировать существующие данные

---

## Полная очистка и переустановка данных

```bash
# 1. Остановить все
pkill -f "node"

# 2. Очистить MongoDB
mongo chat3 --eval "db.dropDatabase()"

# 3. Запустить seed
npm run seed

# 4. Запустить сервисы
./restart-all.sh
```

---

## Полезные команды

```bash
# Просмотр всех запущенных Node процессов
ps aux | grep node

# Мониторинг логов в реальном времени
tail -f /tmp/chat3.log /tmp/worker.log

# Проверка подключений к MongoDB
mongo chat3 --eval "db.stats()"

# Проверка очередей RabbitMQ
sudo rabbitmqctl list_queues name messages

# Список всех endpoints
curl http://localhost:3000/admin-links
```

---

## Статус после перезапуска

После успешного перезапуска должны работать:

✅ API Server на http://localhost:3000
✅ AdminJS на http://localhost:3000/admin
✅ API Docs на http://localhost:3000/api-docs
✅ Update Worker (обработка RabbitMQ событий)
✅ MongoDB connection
✅ RabbitMQ connection

---

## Контакты для поддержки

- Документация: README.md
- Custom IDs: CUSTOM_IDS.md
- Аутентификация: AUTHENTICATION.md
- Архитектура: ARCHITECTURE.md


