#!/bin/bash

# Тестовый скрипт для запуска gRPC тестов
# 
# Использование:
#   ./test-grpc.sh
# 
# Переменные окружения:
#   GRPC_SERVER_URL - URL gRPC сервера (по умолчанию: localhost:50051)
#   API_KEY - API ключ для аутентификации (обязательно)
#   TENANT_ID - ID тенанта (по умолчанию: tnt_default)
#   USER_1_ID - ID первого пользователя (по умолчанию: user_1)
#   USER_2_ID - ID второго пользователя (по умолчанию: user_2)
#   DIALOG_ID - ID диалога (обязательно)

echo "🚀 Starting gRPC test script..."
echo ""

# Проверка обязательных переменных
if [ -z "$API_KEY" ]; then
  echo "❌ ERROR: API_KEY is required"
  echo "   Example: export API_KEY='your-api-key'"
  exit 1
fi

if [ -z "$DIALOG_ID" ]; then
  echo "❌ ERROR: DIALOG_ID is required"
  echo "   Example: export DIALOG_ID='dlg_abc123'"
  echo ""
  echo "💡 Tip: Create a dialog first using tenant-api and set DIALOG_ID to its ID"
  exit 1
fi

# Установка значений по умолчанию
export GRPC_SERVER_URL=${GRPC_SERVER_URL:-localhost:50051}
export TENANT_ID=${TENANT_ID:-tnt_default}
export USER_1_ID=${USER_1_ID:-user_1}
export USER_2_ID=${USER_2_ID:-user_2}

echo "📋 Configuration:"
echo "   GRPC_SERVER_URL: $GRPC_SERVER_URL"
echo "   TENANT_ID: $TENANT_ID"
echo "   USER_1_ID: $USER_1_ID"
echo "   USER_2_ID: $USER_2_ID"
echo "   DIALOG_ID: $DIALOG_ID"
echo ""

# Запуск теста
node test-grpc.js
