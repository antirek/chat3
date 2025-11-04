# Docker Files Overview

## Структура Docker файлов

```
chat3/
├── Dockerfile                  # Образ для API и Worker
├── .dockerignore              # Игнорируемые файлы при сборке
├── docker-compose.yml         # Оркестрация контейнеров
├── docker-build.sh            # Скрипт сборки образов
├── DOCKER.md                  # Полная документация
├── QUICKSTART_DOCKER.md       # Быстрый старт
└── .env.docker.example        # Пример переменных окружения
```

## Описание файлов

### Dockerfile
**Назначение**: Multi-stage образ для оптимизации размера
- **Базовый образ**: `node:18-alpine`
- **Пользователь**: `chat3user` (непривилегированный)
- **Порт**: 3000
- **Healthcheck**: Проверка `/admin` endpoint
- **Команды**:
  - По умолчанию: `node src/index.js` (API Server)
  - Для воркера: `node src/workers/updateWorker.js`

### .dockerignore
**Назначение**: Исключить ненужные файлы из образа
- node_modules (устанавливаются внутри образа)
- Логи и временные файлы
- .env файлы (конфиденциальные данные)
- Документация и тесты
- IDE файлы

### docker-compose.yml
**Назначение**: Оркестрация двух сервисов

#### Сервис: chat3-api
- **Порты**: 3000:3000
- **Команда**: `node src/index.js`
- **Healthcheck**: Да
- **Restart**: unless-stopped

#### Сервис: chat3-worker
- **Порты**: Нет (внутренний сервис)
- **Команда**: `node src/workers/updateWorker.js`
- **Depends on**: chat3-api (с healthcheck)
- **Restart**: unless-stopped

#### Общие настройки
- **Network**: chat3-network (bridge)
- **Extra hosts**: host.docker.internal для доступа к хосту
- **Environment**: Переменные окружения из .env.docker

### docker-build.sh
**Назначение**: Автоматизация сборки
```bash
./docker-build.sh          # Сборка с тегом latest
./docker-build.sh v1.0.0   # Сборка с конкретной версией
```

Скрипт:
1. Проверяет наличие Dockerfile
2. Собирает образ с указанной версией
3. Тегирует как latest
4. Показывает список образов
5. Выводит команды для запуска

### .env.docker.example
**Назначение**: Шаблон для переменных окружения

**Переменные**:
- `MONGODB_URI` - Подключение к MongoDB
- `RABBITMQ_URL` - Подключение к RabbitMQ
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, etc. - Детали RabbitMQ
- `NODE_ENV` - development/production
- `PORT` - Порт API сервера

**Использование**:
```bash
cp .env.docker.example .env.docker
nano .env.docker
docker-compose --env-file .env.docker up -d
```

## Workflow

### Development
```bash
# 1. Локальная разработка
npm install
npm start                    # API
./start-worker.sh           # Worker

# 2. Тестирование в Docker
./docker-build.sh
docker-compose up
```

### Production
```bash
# 1. Сборка production образа
./docker-build.sh v1.0.0

# 2. Тег и push в registry
docker tag chat3:v1.0.0 registry.example.com/chat3:v1.0.0
docker push registry.example.com/chat3:v1.0.0

# 3. Deploy на сервере
docker-compose --env-file .env.production up -d

# 4. Масштабирование
docker-compose up -d --scale chat3-worker=3
```

## Размер образа

### Оптимизации
- ✅ Multi-stage build
- ✅ Alpine Linux (минимальный размер)
- ✅ npm ci --only=production
- ✅ .dockerignore для исключения лишних файлов
- ✅ npm cache clean

### Ожидаемый размер
- **Базовый образ** (node:18-alpine): ~170 MB
- **С зависимостями**: ~200-250 MB
- **Итоговый образ**: ~220-270 MB

## Security

### Best Practices
- ✅ Непривилегированный пользователь (chat3user)
- ✅ Только production зависимости
- ✅ Без .env файлов в образе
- ✅ Healthcheck для автоматического восстановления
- ✅ Restart policy для отказоустойчивости

### Рекомендации
- 🔒 Не включайте секреты в образ
- 🔒 Используйте Docker secrets или vault
- 🔒 Регулярно обновляйте базовый образ
- 🔒 Сканируйте образы на уязвимости

```bash
# Пример сканирования
docker scan chat3:latest
```

## Volumes

Docker Compose **не использует volumes**, так как:
- MongoDB внешний (данные не в контейнере)
- RabbitMQ внешний (очереди не в контейнере)
- Логи выводятся в stdout/stderr (docker logs)
- Нет stateful данных в контейнерах

Это делает контейнеры **stateless** и легко масштабируемыми.

## Networks

### chat3-network (bridge)
**Назначение**: Изоляция контейнеров chat3

**Связи**:
- chat3-api ↔ chat3-worker: Через network
- chat3-api → host: Через host.docker.internal (MongoDB, RabbitMQ)
- chat3-worker → host: Через host.docker.internal (MongoDB, RabbitMQ)

**Преимущества**:
- Изоляция от других приложений
- Внутренняя DNS резолюция
- Контроль трафика

## Monitoring

### Container Health
```bash
# Healthcheck статус
docker inspect --format='{{.State.Health.Status}}' chat3-api

# Логи
docker-compose logs -f chat3-api
docker-compose logs -f chat3-worker

# Метрики
docker stats
```

### Application Health
```bash
# API endpoint
curl http://localhost:3000/admin

# Swagger docs
curl http://localhost:3000/api-docs

# RabbitMQ Management
curl http://localhost:15672 (admin/admin)
```

## Troubleshooting

### Проблемы сборки

**Error: Cannot find module**
```bash
# Решение: Очистить кэш Docker
docker builder prune -a
./docker-build.sh
```

**Error: npm ci failed**
```bash
# Решение: Проверить package-lock.json
npm install
git add package-lock.json
./docker-build.sh
```

### Проблемы запуска

**Error: Cannot connect to MongoDB**
```bash
# Проверить доступность
ping host.docker.internal
mongosh mongodb://host.docker.internal:27017/chat3

# Или использовать IP
MONGODB_URI=mongodb://192.168.1.100:27017/chat3
```

**Error: Cannot connect to RabbitMQ**
```bash
# Проверить пользователя
rabbitmqctl list_users
rabbitmqctl set_permissions -p / rmuser ".*" ".*" ".*"
```

### Проблемы производительности

**Container uses too much memory**
```bash
# Ограничить память в docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
```

**Worker processes events slowly**
```bash
# Масштабировать воркеры
docker-compose up -d --scale chat3-worker=3
```

## Документация

| Файл | Описание |
|------|----------|
| [DOCKER.md](DOCKER.md) | Полная документация по Docker deployment |
| [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md) | Быстрый старт с примерами |
| [WORKERS.md](WORKERS.md) | Документация по воркерам |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Общая архитектура системы |
| [README.md](README.md) | Основная документация проекта |

## Полезные команды

```bash
# Сборка
./docker-build.sh
docker build -t chat3:latest .

# Запуск
docker-compose up -d
docker-compose --env-file .env.docker up -d

# Управление
docker-compose ps
docker-compose logs -f
docker-compose restart
docker-compose down

# Масштабирование
docker-compose up -d --scale chat3-worker=3

# Очистка
docker-compose down -v
docker image prune -a
docker system prune -a

# Отладка
docker-compose exec chat3-api sh
docker-compose exec chat3-worker sh
docker logs chat3-api
docker stats

# Registry
docker tag chat3:latest username/chat3:latest
docker push username/chat3:latest
docker pull username/chat3:latest
```

## Заключение

Docker setup обеспечивает:
- ✅ Изолированное окружение
- ✅ Воспроизводимые сборки
- ✅ Легкое масштабирование
- ✅ Простое deployment
- ✅ Совместимость с внешними сервисами

Для начала работы используйте [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md)

