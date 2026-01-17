#!/bin/bash

# Скрипт для запуска gRPC сервера user-grpc-server
# Запускает gRPC сервер с переменными окружения
#
# Переменные окружения (можно переопределить):
#   GRPC_HOST         - Хост gRPC сервера (по умолчанию: 0.0.0.0)
#   GRPC_PORT         - Порт gRPC сервера (по умолчанию: 50051)
#   TENANT_API_URL    - URL tenant-api (по умолчанию: http://localhost:3000)
#   RABBITMQ_URL      - URL RabbitMQ (по умолчанию: amqp://rmuser:rmpassword@localhost:5672/)

# Переменные окружения (можно переопределить через окружение)
export GRPC_HOST="${GRPC_HOST:-0.0.0.0}"
export GRPC_PORT="${GRPC_PORT:-50051}"
export TENANT_API_URL="${TENANT_API_URL:-http://localhost:3000}"
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://rmuser:rmpassword@localhost:5672/}"

# Переход в корневую директорию проекта
cd "$(dirname "$0")" || exit 1

# Функция для проверки доступности сервиса
check_service() {
  local host=$1
  local port=$2
  local name=$3
  
  if command -v nc >/dev/null 2>&1; then
    if nc -z ${host} ${port} 2>/dev/null; then
      echo "✓ ${name} доступен на ${host}:${port}"
      return 0
    fi
  elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
    if timeout 1 bash -c "echo >/dev/tcp/${host}/${port}" 2>/dev/null; then
      echo "✓ ${name} доступен на ${host}:${port}"
      return 0
    fi
  fi
  
  echo "✗ ${name} НЕ доступен на ${host}:${port}"
  return 1
}

# Проверка зависимостей
echo "Проверка зависимостей..."
TENANT_HOST=$(echo ${TENANT_API_URL} | sed 's|http://||' | sed 's|https://||' | cut -d: -f1)
TENANT_PORT=$(echo ${TENANT_API_URL} | sed 's|http://||' | sed 's|https://||' | cut -d: -f2 | cut -d/ -f1)
RABBITMQ_HOST=$(echo ${RABBITMQ_URL} | sed 's|amqp://.*@||' | sed 's|amqps://.*@||' | cut -d: -f1)
RABBITMQ_PORT=$(echo ${RABBITMQ_URL} | sed 's|amqp://.*@||' | sed 's|amqps://.*@||' | cut -d: -f2 | cut -d/ -f1)

check_tenant=0
check_rabbitmq=0

if check_service "${TENANT_HOST}" "${TENANT_PORT}" "Tenant API"; then
  check_tenant=1
else
  echo "  ⚠ Tenant API не запущен. Запустите: npm run start:tenant-api"
fi

if check_service "${RABBITMQ_HOST}" "${RABBITMQ_PORT}" "RabbitMQ"; then
  check_rabbitmq=1
else
  echo "  ⚠ RabbitMQ не запущен. Убедитесь, что RabbitMQ запущен и доступен."
fi

if [ $check_tenant -eq 0 ] || [ $check_rabbitmq -eq 0 ]; then
  echo ""
  echo "⚠ Предупреждение: некоторые зависимости недоступны."
  echo "  gRPC сервер может работать некорректно."
  echo "  Продолжить запуск? (y/n)"
  read -t 5 -n 1 answer || answer="y"
  echo ""
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "Запуск отменен."
    exit 1
  fi
  echo ""
fi

# Сборка сервера
echo "Building user-grpc-server..."
npm run build --workspace=@chat3/user-grpc-server 2>&1 | grep -v "TS\d" || true

# Запуск сервера
echo ""
echo "========================================="
echo "Starting gRPC server"
echo "========================================="
echo "Configuration:"
echo "  GRPC_HOST=${GRPC_HOST}"
echo "  GRPC_PORT=${GRPC_PORT}"
echo "  TENANT_API_URL=${TENANT_API_URL}"
echo "  RABBITMQ_URL=${RABBITMQ_URL}"
echo "========================================="
echo ""

npm run start:user-grpc-server
