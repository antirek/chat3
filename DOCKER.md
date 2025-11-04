# Docker Deployment Guide

## Обзор

Chat3 может быть запущен в Docker контейнерах. Данная конфигурация предполагает, что MongoDB и RabbitMQ запущены **вне** Docker (на хост-машине или на отдельных серверах).

## Архитектура

```
┌─────────────────────────────────────┐
│         Docker Compose              │
│  ┌────────────┐   ┌──────────────┐ │
│  │ chat3-api  │   │ chat3-worker │ │
│  │  (port     │   │              │ │
│  │   3000)    │   │              │ │
│  └─────┬──────┘   └──────┬───────┘ │
└────────┼──────────────────┼─────────┘
         │                  │
         ├──────────────────┤
         │                  │
    ┌────▼────┐        ┌────▼────┐
    │ MongoDB │        │RabbitMQ │
    │ (внешн.)│        │ (внешн.)│
    └─────────┘        └─────────┘
```

## Компоненты

### 1. chat3-api
- API сервер
- Express.js + AdminJS
- Порт: 3000
- Healthcheck: GET /admin

### 2. chat3-worker
- Update Worker
- Обрабатывает события из RabbitMQ
- Создает персонализированные updates

## Предварительные требования

### 1. Docker и Docker Compose
```bash
# Проверка установки
docker --version
docker-compose --version
```

### 2. Внешние сервисы

**MongoDB** (localhost:27017 или удаленный сервер):
```bash
# Проверка подключения
mongosh mongodb://localhost:27017/chat3
```

**RabbitMQ** (localhost:5672 или удаленный сервер):
```bash
# Проверка статуса
rabbitmqctl status

# Создание пользователя (если нужно)
rabbitmqctl add_user rmuser rmpassword
rabbitmqctl set_permissions -p / rmuser ".*" ".*" ".*"
```

## Быстрый старт

### 1. Клонирование репозитория
```bash
git clone <repository-url> chat3
cd chat3
```

### 2. Настройка переменных окружения
```bash
# Создайте файл .env.docker на основе примера
cp .env.docker.example .env.docker

# Отредактируйте подключения к внешним сервисам
nano .env.docker
```

Пример `.env.docker`:
```bash
# MongoDB (внешний)
MONGODB_URI=mongodb://192.168.1.100:27017/chat3

# RabbitMQ (внешний)
RABBITMQ_URL=amqp://rmuser:rmpassword@192.168.1.100:5672/

# Application
NODE_ENV=production
PORT=3000
```

### 3. Сборка образов
```bash
# Автоматическая сборка
./docker-build.sh

# Или вручную
docker build -t chat3:latest .
```

### 4. Запуск контейнеров
```bash
# С файлом .env.docker
docker-compose --env-file .env.docker up -d

# Или с дефолтными настройками
docker-compose up -d
```

### 5. Проверка состояния
```bash
# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f chat3-api
docker-compose logs -f chat3-worker
```

## Конфигурация

### Переменные окружения

#### MongoDB
- `MONGODB_URI` - Полный URI подключения к MongoDB
  - Пример: `mongodb://localhost:27017/chat3`
  - Пример с авторизацией: `mongodb://user:pass@host:27017/chat3?authSource=admin`

#### RabbitMQ
- `RABBITMQ_URL` - Полный URL подключения к RabbitMQ
  - Пример: `amqp://rmuser:rmpassword@localhost:5672/`
- `RABBITMQ_HOST` - Хост RabbitMQ (альтернативный способ)
- `RABBITMQ_PORT` - Порт RabbitMQ
- `RABBITMQ_USER` - Пользователь
- `RABBITMQ_PASSWORD` - Пароль
- `RABBITMQ_VHOST` - Virtual host (по умолчанию: `/`)
- `RABBITMQ_EXCHANGE` - Exchange для событий (по умолчанию: `chat3_events`)

#### Application
- `NODE_ENV` - Окружение (`development` / `production`)
- `PORT` - Порт API сервера (по умолчанию: 3000)

### Подключение к внешним сервисам

#### Вариант 1: Сервисы на хост-машине

Docker Compose использует `host.docker.internal` для доступа к хосту:

```yaml
environment:
  - MONGODB_URI=mongodb://host.docker.internal:27017/chat3
  - RABBITMQ_URL=amqp://rmuser:rmpassword@host.docker.internal:5672/
```

#### Вариант 2: Удаленные сервисы

```yaml
environment:
  - MONGODB_URI=mongodb://mongo.example.com:27017/chat3
  - RABBITMQ_URL=amqp://rmuser:rmpassword@rabbitmq.example.com:5672/
```

#### Вариант 3: MongoDB Atlas (облачный)

```yaml
environment:
  - MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chat3?retryWrites=true&w=majority
```

## Управление контейнерами

### Запуск
```bash
# Запуск в фоне
docker-compose up -d

# Запуск с пересборкой
docker-compose up -d --build

# Запуск только API (без worker)
docker-compose up -d chat3-api
```

### Остановка
```bash
# Остановка всех контейнеров
docker-compose stop

# Остановка и удаление контейнеров
docker-compose down

# Остановка и удаление с volumes
docker-compose down -v
```

### Перезапуск
```bash
# Перезапуск всех сервисов
docker-compose restart

# Перезапуск конкретного сервиса
docker-compose restart chat3-api
docker-compose restart chat3-worker
```

### Масштабирование
```bash
# Запуск нескольких воркеров
docker-compose up -d --scale chat3-worker=3

# Запуск нескольких API серверов (требуется load balancer)
docker-compose up -d --scale chat3-api=2
```

## Логи и мониторинг

### Просмотр логов
```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f chat3-api
docker-compose logs -f chat3-worker

# Последние 100 строк
docker-compose logs --tail=100 chat3-api

# С временными метками
docker-compose logs -f -t chat3-worker
```

### Состояние контейнеров
```bash
# Статус
docker-compose ps

# Использование ресурсов
docker stats

# Подробная информация
docker inspect chat3-api
```

### Healthcheck
```bash
# Проверка здоровья API
curl http://localhost:3000/admin

# Healthcheck статус
docker inspect --format='{{.State.Health.Status}}' chat3-api
```

## Обновление приложения

### Стратегия 1: Rolling Update
```bash
# 1. Пересобрать образы
./docker-build.sh

# 2. Обновить контейнеры
docker-compose up -d --no-deps --build chat3-api
docker-compose up -d --no-deps --build chat3-worker
```

### Стратегия 2: С downtime
```bash
# 1. Остановить контейнеры
docker-compose down

# 2. Пересобрать образы
./docker-build.sh

# 3. Запустить контейнеры
docker-compose up -d
```

### Откат версии
```bash
# Использовать конкретную версию образа
docker-compose down
docker pull chat3:v1.2.3
docker-compose up -d
```

## Инициализация данных

### Заполнение БД тестовыми данными
```bash
# Через API контейнер
docker-compose exec chat3-api npm run seed

# Или напрямую
docker-compose exec chat3-api node src/scripts/seed.js
```

### Создание API ключа
```bash
# Для демо tenant
docker-compose exec chat3-api npm run generate-demo-key

# Для нового tenant
docker-compose exec chat3-api npm run generate-key
```

## Troubleshooting

### Контейнер не запускается

**Проблема:** Cannot connect to MongoDB
```bash
# Проверить доступность MongoDB с хоста
mongosh mongodb://localhost:27017/chat3

# Проверить доступность из контейнера
docker-compose exec chat3-api sh
ping host.docker.internal
```

**Решение:** Убедитесь, что MongoDB слушает на `0.0.0.0`, а не только на `127.0.0.1`

**Проблема:** Cannot connect to RabbitMQ
```bash
# Проверить статус RabbitMQ
rabbitmqctl status

# Проверить пользователя
rabbitmqctl list_users
```

**Решение:** Создайте пользователя `rmuser` с правильными permissions

### Worker не обрабатывает события

**Проблема:** Worker подключен, но не получает события

```bash
# Проверить логи воркера
docker-compose logs -f chat3-worker

# Проверить RabbitMQ Management UI
# http://localhost:15672
# Очередь: update_worker_queue должна быть привязана к chat3_events
```

### Высокая нагрузка

**Проблема:** Контейнер использует много CPU/RAM

```bash
# Мониторинг ресурсов
docker stats

# Ограничить ресурсы в docker-compose.yml
services:
  chat3-api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Production Deployment

### Рекомендации

1. **Использовать reverse proxy** (Nginx, Traefik)
   ```bash
   # Пример с Nginx
   location /api/ {
       proxy_pass http://localhost:3000/api/;
   }
   ```

2. **Настроить SSL/TLS**
   ```yaml
   # С Let's Encrypt через Traefik
   labels:
     - "traefik.enable=true"
     - "traefik.http.routers.chat3.rule=Host(`api.example.com`)"
     - "traefik.http.routers.chat3.tls.certresolver=letsencrypt"
   ```

3. **Запускать несколько воркеров**
   ```bash
   docker-compose up -d --scale chat3-worker=3
   ```

4. **Мониторинг и алерты**
   - Prometheus + Grafana для метрик
   - ELK Stack для логов
   - Healthcheck endpoints

5. **Автоматический перезапуск**
   ```yaml
   restart: unless-stopped
   ```

6. **Backup стратегия**
   - Регулярные backup MongoDB
   - Backup переменных окружения
   - Version control для образов

## Registry

### Публикация образов

#### Docker Hub
```bash
# Тег образа
docker tag chat3:latest username/chat3:latest
docker tag chat3:latest username/chat3:v1.0.0

# Загрузка
docker login
docker push username/chat3:latest
docker push username/chat3:v1.0.0
```

#### Private Registry
```bash
# Тег для private registry
docker tag chat3:latest registry.example.com/chat3:latest

# Загрузка
docker push registry.example.com/chat3:latest
```

### Использование образов из registry
```yaml
# docker-compose.yml
services:
  chat3-api:
    image: username/chat3:latest
    # build секция больше не нужна
```

## CI/CD Integration

### GitHub Actions пример
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build image
        run: docker build -t chat3:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push username/chat3:${{ github.sha }}
```

## Полезные команды

```bash
# Удалить все остановленные контейнеры
docker container prune

# Удалить неиспользуемые образы
docker image prune -a

# Очистить всё (осторожно!)
docker system prune -a --volumes

# Экспорт образа в файл
docker save chat3:latest | gzip > chat3-latest.tar.gz

# Импорт образа из файла
docker load < chat3-latest.tar.gz

# Shell в запущенный контейнер
docker-compose exec chat3-api sh

# Запуск одноразовой команды
docker-compose run --rm chat3-api node src/scripts/seed.js
```

## Заключение

Docker deployment обеспечивает изолированное и воспроизводимое окружение для Chat3. Следуйте best practices для production deployment и регулярно обновляйте образы.

Для дополнительной информации см.:
- [README.md](README.md) - Общая документация
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура системы
- [WORKERS.md](WORKERS.md) - Документация по воркерам

