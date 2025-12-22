#!/bin/bash

# Скрипт для автоматического запуска tenant-api, получения API ключа и тестирования клиента
# Использование: ./test-with-api.sh

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Пути
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_PID_FILE="/tmp/chat3-tenant-api-test.pid"

echo -e "${GREEN}🚀 Автоматическое тестирование Chat3Client с реальным API${NC}\n"

# Функция для очистки при выходе
cleanup() {
    echo -e "\n${YELLOW}🧹 Очистка...${NC}"
    if [ -f "$API_PID_FILE" ]; then
        API_PID=$(cat "$API_PID_FILE")
        if ps -p "$API_PID" > /dev/null 2>&1; then
            echo "   Останавливаю tenant-api (PID: $API_PID)..."
            kill "$API_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$API_PID" 2>/dev/null || true
        fi
        rm -f "$API_PID_FILE"
    fi
}

trap cleanup EXIT INT TERM

# Шаг 1: Проверка зависимостей
echo -e "${GREEN}1️⃣  Проверка зависимостей...${NC}"
cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
    echo "   Установка зависимостей..."
    npm install
fi

# Шаг 2: Проверка MongoDB и RabbitMQ
echo -e "\n${GREEN}2️⃣  Проверка MongoDB и RabbitMQ...${NC}"

# Функция для проверки порта
check_port() {
    local host=$1
    local port=$2
    local service=$3
    
    # Пробуем разные способы проверки
    if command -v nc >/dev/null 2>&1; then
        nc -z "$host" "$port" >/dev/null 2>&1
    elif command -v timeout >/dev/null 2>&1; then
        timeout 1 bash -c "echo > /dev/tcp/$host/$port" >/dev/null 2>&1
    else
        # Последняя попытка - curl для HTTP сервисов
        if [ "$port" = "27017" ]; then
            # Для MongoDB просто проверяем что порт открыт через telnet или timeout
            timeout 1 bash -c "echo > /dev/tcp/$host/$port" >/dev/null 2>&1
        else
            return 1
        fi
    fi
}

if ! check_port localhost 27017 "MongoDB"; then
    echo -e "${YELLOW}   ⚠️  MongoDB не запущен на localhost:27017${NC}"
    echo "   Запустите: docker-compose up -d"
    exit 1
fi

if ! check_port localhost 5672 "RabbitMQ"; then
    echo -e "${YELLOW}   ⚠️  RabbitMQ не запущен на localhost:5672${NC}"
    echo "   Запустите: docker-compose up -d"
    exit 1
fi

echo "   ✅ MongoDB и RabbitMQ доступны"

# Шаг 3: Генерация API ключа
echo -e "\n${GREEN}3️⃣  Генерация API ключа...${NC}"
API_KEY_OUTPUT=$(npm run generate-key "Test API Key" "For client testing" 2>&1)

# Извлекаем ключ из вывода (ищем строку с "🔑 API Key:")
API_KEY=$(echo "$API_KEY_OUTPUT" | grep -A 1 "🔑 API Key:" | tail -1 | sed 's/^[[:space:]]*//' | grep -oP 'chat3_[a-f0-9]+' | head -1)

if [ -z "$API_KEY" ]; then
    # Попробуем альтернативный способ - ищем любую строку с chat3_
    API_KEY=$(echo "$API_KEY_OUTPUT" | grep -oP 'chat3_[a-f0-9]+' | head -1)
fi

if [ -z "$API_KEY" ]; then
    echo -e "${RED}   ❌ Не удалось получить API ключ${NC}"
    echo "   Вывод скрипта:"
    echo "$API_KEY_OUTPUT" | tail -10
    exit 1
fi

echo "   ✅ API ключ: ${API_KEY:0:30}..."

# Шаг 4: Запуск tenant-api
echo -e "\n${GREEN}4️⃣  Запуск tenant-api...${NC}"
cd "$PROJECT_ROOT"

# Останавливаем предыдущий процесс если есть
if [ -f "$API_PID_FILE" ]; then
    OLD_PID=$(cat "$API_PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "   Останавливаю предыдущий процесс (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$API_PID_FILE"
fi

# Запускаем API в фоне
echo "   Запуск tenant-api на порту 3000..."
npm run start:tenant-api > /tmp/chat3-api-test.log 2>&1 &
API_PID=$!
echo "$API_PID" > "$API_PID_FILE"

# Ждем запуска API
echo "   Ожидание запуска API..."
MAX_WAIT=30
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "   ✅ API запущен и отвечает"
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo -n "."
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    echo -e "\n${RED}   ❌ API не запустился за $MAX_WAIT секунд${NC}"
    echo "   Логи:"
    tail -20 /tmp/chat3-api-test.log
    exit 1
fi

echo ""

# Шаг 5: Тестирование клиента
echo -e "${GREEN}5️⃣  Тестирование клиента...${NC}"
cd "$CLIENT_DIR"

# Устанавливаем зависимости клиента если нужно
if [ ! -d "node_modules" ]; then
    echo "   Установка зависимостей клиента..."
    npm install
fi

# Запускаем тесты
echo "   Запуск интеграционных тестов..."
CHAT3_API_KEY="$API_KEY" \
CHAT3_BASE_URL="http://localhost:3000/api" \
CHAT3_TENANT_ID="tnt_default" \
node test-integration.js

TEST_RESULT=$?

# Итоги
echo ""
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Все тесты прошли успешно!${NC}"
else
    echo -e "${RED}❌ Некоторые тесты не прошли${NC}"
fi

exit $TEST_RESULT

