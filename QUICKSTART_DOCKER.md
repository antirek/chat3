# Quick Start с Docker

## Предварительные требования

1. **Docker и Docker Compose установлены**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **MongoDB запущен** (вне Docker)
   ```bash
   # Проверка
   mongosh mongodb://localhost:27017/chat3
   ```

3. **RabbitMQ запущен** (вне Docker)
   ```bash
   # Проверка
   rabbitmqctl status
   
   # Создание пользователя (если еще не создан)
   rabbitmqctl add_user rmuser rmpassword
   rabbitmqctl set_permissions -p / rmuser ".*" ".*" ".*"
   ```

## Быстрый запуск (3 команды)

```bash
# 1. Сборка образа
./docker-build.sh

# 2. Запуск контейнеров
docker-compose up -d

# 3. Проверка логов
docker-compose logs -f
```

По умолчанию используются:
- MongoDB: `mongodb://host.docker.internal:27017/chat3`
- RabbitMQ: `amqp://rmuser:rmpassword@host.docker.internal:5672/`

## Доступ к приложению

- **API**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Swagger Docs**: http://localhost:3000/api-docs

## Первоначальная настройка

### 1. Заполнить БД тестовыми данными
```bash
docker-compose exec chat3-api npm run seed
```

### 2. Создать API ключ
```bash
docker-compose exec chat3-api npm run generate-demo-key
```

Скопируйте сгенерированный API ключ и используйте его в заголовке `X-API-Key`.

## Управление

### Просмотр логов
```bash
# Все сервисы
docker-compose logs -f

# Только API
docker-compose logs -f chat3-api

# Только Worker
docker-compose logs -f chat3-worker
```

### Перезапуск
```bash
# Перезапустить все
docker-compose restart

# Перезапустить API
docker-compose restart chat3-api
```

### Остановка
```bash
# Остановить
docker-compose stop

# Остановить и удалить контейнеры
docker-compose down
```

### Масштабирование воркеров
```bash
# Запустить 3 воркера
docker-compose up -d --scale chat3-worker=3
```

## Настройка подключений

Если MongoDB и RabbitMQ на других хостах, создайте `.env.docker`:

```bash
# .env.docker
MONGODB_URI=mongodb://192.168.1.100:27017/chat3
RABBITMQ_URL=amqp://rmuser:rmpassword@192.168.1.100:5672/
```

Запуск с кастомными настройками:
```bash
docker-compose --env-file .env.docker up -d
```

## Troubleshooting

### Проблема: API не может подключиться к MongoDB

**Решение 1**: Проверьте, что MongoDB слушает на `0.0.0.0`:
```bash
# В mongod.conf
net:
  bindIp: 0.0.0.0
```

**Решение 2**: Используйте IP адрес вместо localhost:
```bash
MONGODB_URI=mongodb://192.168.1.100:27017/chat3
```

### Проблема: Worker не получает события

**Проверка**: Откройте RabbitMQ Management UI (http://localhost:15672)
- Очередь `update_worker_queue` должна существовать
- Binding к exchange `chat3_events` должен быть настроен

**Решение**: Перезапустите воркер:
```bash
docker-compose restart chat3-worker
```

### Проблема: Permission denied при сборке

**Решение**: Добавьте пользователя в группу docker:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

Или используйте sudo:
```bash
sudo docker build -t chat3:latest .
sudo docker-compose up -d
```

## Дополнительные команды

```bash
# Shell в контейнер API
docker-compose exec chat3-api sh

# Shell в контейнер Worker
docker-compose exec chat3-worker sh

# Просмотр использования ресурсов
docker stats

# Проверка healthcheck
docker inspect chat3-api | grep -A10 Health
```

## Полная документация

Для детальной информации см. [DOCKER.md](DOCKER.md)

