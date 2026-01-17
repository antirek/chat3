#!/bin/bash

# Скрипт для запуска демо-приложения user2user
# Запускает backend сервер с настройками по умолчанию
#
# Переменные окружения (можно переопределить):
#   GRPC_SERVER_URL     - URL gRPC сервера (по умолчанию: localhost:50051)
#   USER2USER_PORT      - Порт для backend сервера (по умолчанию: 4000)
#   TENANT_API_URL      - URL tenant-api (по умолчанию: http://localhost:3000)
#   TENANT_ID           - ID тенанта (по умолчанию: tnt_default)

# Переменные окружения (можно переопределить через окружение)
export GRPC_SERVER_URL="${GRPC_SERVER_URL:-localhost:50051}"
export USER2USER_PORT="${USER2USER_PORT:-4000}"
export TENANT_API_URL="${TENANT_API_URL:-http://localhost:3000}"
export TENANT_ID="${TENANT_ID:-tnt_default}"

# Функция для остановки процессов на порту
stop_port_processes() {
  local port=$1
  local found=false

  # Способ 1: через lsof
  if command -v lsof >/dev/null 2>&1; then
    local pids=$(lsof -ti:${port} 2>/dev/null)
    if [ -n "$pids" ]; then
      found=true
      echo "Найдены процессы на порту ${port}: $pids"
      for pid in $pids; do
        echo "  Останавливаем процесс PID: $pid"
        kill $pid 2>/dev/null || true
      done
      sleep 1
      # Принудительное завершение, если не остановились
      for pid in $pids; do
        if kill -0 $pid 2>/dev/null; then
          echo "  Принудительное завершение процесса PID: $pid"
          kill -9 $pid 2>/dev/null || true
        fi
      done
      sleep 1
    fi
  fi

  # Способ 2: через ss (если lsof не нашел)
  if [ "$found" = false ] && command -v ss >/dev/null 2>&1; then
    local pids=$(ss -tulpn 2>/dev/null | grep ":${port} " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
    if [ -n "$pids" ]; then
      found=true
      echo "Найдены процессы на порту ${port} (через ss): $pids"
      for pid in $pids; do
        echo "  Останавливаем процесс PID: $pid"
        kill $pid 2>/dev/null || true
      done
      sleep 1
      for pid in $pids; do
        if kill -0 $pid 2>/dev/null; then
          echo "  Принудительное завершение процесса PID: $pid"
          kill -9 $pid 2>/dev/null || true
        fi
      done
      sleep 1
    fi
  fi

  # Способ 3: через fuser (fallback)
  if [ "$found" = false ] && command -v fuser >/dev/null 2>&1; then
    fuser -k ${port}/tcp 2>/dev/null && found=true || true
    sleep 1
  fi

  if [ "$found" = true ]; then
    echo "Старые процессы на порту ${port} остановлены"
  else
    echo "Порт ${port} свободен"
  fi
}

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

# Проверка зависимостей перед запуском
echo "Проверка зависимостей..."
GRPC_HOST=$(echo ${GRPC_SERVER_URL} | cut -d: -f1)
GRPC_PORT=$(echo ${GRPC_SERVER_URL} | cut -d: -f2)
TENANT_HOST=$(echo ${TENANT_API_URL} | sed 's|http://||' | sed 's|https://||' | cut -d: -f1)
TENANT_PORT=$(echo ${TENANT_API_URL} | sed 's|http://||' | sed 's|https://||' | cut -d: -f2 | cut -d/ -f1)

check_grpc=0
check_tenant=0

if check_service "${GRPC_HOST}" "${GRPC_PORT}" "gRPC сервер"; then
  check_grpc=1
else
  echo "  ⚠ gRPC сервер не запущен. Запустите: npm run start:user-grpc-server"
  echo "     или используйте скрипт start-all.sh для запуска всех сервисов"
fi

if check_service "${TENANT_HOST}" "${TENANT_PORT}" "Tenant API"; then
  check_tenant=1
else
  echo "  ⚠ Tenant API не запущен. Запустите: npm run start:tenant-api"
  echo "     или используйте скрипт start-all.sh для запуска всех сервисов"
fi

if [ $check_grpc -eq 0 ] || [ $check_tenant -eq 0 ]; then
  echo ""
  echo "⚠ Предупреждение: некоторые зависимости недоступны."
  echo "  Демо-приложение может работать некорректно."
  echo ""
  echo "  Для запуска зависимостей используйте:"
  if [ $check_grpc -eq 0 ]; then
    echo "    npm run start:user-grpc-server  # gRPC сервер (порт ${GRPC_PORT})"
  fi
  if [ $check_tenant -eq 0 ]; then
    echo "    npm run start:tenant-api        # Tenant API (порт ${TENANT_PORT})"
  fi
  echo ""
  echo "  Или используйте start-all.sh для запуска всех сервисов"
  echo ""
  echo "  Продолжить запуск демо-приложения? (y/n)"
  read -t 10 -n 1 answer || answer="y"
  echo ""
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "Запуск отменен."
    exit 1
  fi
  echo ""
fi

# Остановка процессов на порту перед запуском
stop_port_processes ${USER2USER_PORT}

# Переход в директорию демо-приложения
cd "$(dirname "$0")/demo-apps/user2user" || exit 1

# Сборка фронтенда, если нужно
if [ ! -d "frontend/dist" ]; then
  echo "Building frontend..."
  npm run build:frontend
fi

# Сборка backend
echo "Building backend..."
cd backend || exit 1
npm run build 2>&1 | grep -v "TS\d" || true

# Запуск backend сервера
echo "Starting backend server..."
node dist/index.js 2>&1 | tee /tmp/user2user.log &

BACKEND_PID=$!

echo ""
echo "========================================="
echo "Demo user2user started"
echo "========================================="
echo "Backend: http://localhost:${USER2USER_PORT}"
echo "WebSocket: ws://localhost:${USER2USER_PORT}/ws/updates"
echo "Logs: /tmp/user2user.log"
echo "Process ID: $BACKEND_PID"
echo ""
echo "Environment:"
echo "  GRPC_SERVER_URL=${GRPC_SERVER_URL}"
echo "  USER2USER_PORT=${USER2USER_PORT}"
echo "  TENANT_API_URL=${TENANT_API_URL}"
echo "  TENANT_ID=${TENANT_ID}"
echo "========================================="
