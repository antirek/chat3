#!/bin/bash

# Скрипт для запуска grpcui - веб-интерфейса для gRPC API
# Использует Server Reflection для автоматического обнаружения сервисов
#
# Переменные окружения (можно переопределить):
#   GRPC_SERVER_HOST    - Хост gRPC сервера (по умолчанию: localhost)
#   GRPC_SERVER_PORT    - Порт gRPC сервера (по умолчанию: 50051)
#   GRPCUI_PORT         - Порт для веб-интерфейса grpcui (по умолчанию: 8080)

# Переменные окружения
export GRPC_SERVER_HOST="${GRPC_SERVER_HOST:-localhost}"
export GRPC_SERVER_PORT="${GRPC_SERVER_PORT:-50051}"
export GRPCUI_PORT="${GRPCUI_PORT:-8080}"

GRPC_SERVER_ADDRESS="${GRPC_SERVER_HOST}:${GRPC_SERVER_PORT}"

# Функция для проверки наличия команды
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Функция для установки grpcui через go install
install_grpcui_go() {
  if ! command_exists go; then
    echo "✗ Go не установлен. Установите Go для использования grpcui через go install"
    echo "  Скачайте с https://go.dev/dl/"
    return 1
  fi

  echo "📦 Установка grpcui через go install..."
  go install github.com/fullstorydev/grpcui/cmd/grpcui@latest
  if [ $? -eq 0 ]; then
    echo "✓ grpcui установлен успешно"
    # Проверяем, что grpcui доступен в PATH или GOPATH/bin
    if [ -n "$GOPATH" ] && [ -f "$GOPATH/bin/grpcui" ]; then
      export PATH="$GOPATH/bin:$PATH"
    elif [ -f "$HOME/go/bin/grpcui" ]; then
      export PATH="$HOME/go/bin:$PATH"
    fi
    return 0
  else
    echo "✗ Ошибка при установке grpcui"
    return 1
  fi
}

# Функция для установки grpcui через скачивание бинарника
install_grpcui_binary() {
  local OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  local ARCH=$(uname -m)
  
  # Определяем архитектуру
  case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "✗ Неподдерживаемая архитектура: $ARCH"; return 1 ;;
  esac

  local VERSION="v1.3.1"  # Последняя стабильная версия (можно обновить)
  # Правильный формат URL для GitHub releases
  local URL="https://github.com/fullstorydev/grpcui/releases/download/${VERSION}/grpcui_${VERSION}_${OS}_${ARCH}.tar.gz"
  local BINARY_DIR="$HOME/.local/bin"
  local BINARY_PATH="$BINARY_DIR/grpcui"
  local TEMP_DIR=$(mktemp -d)

  echo "📦 Скачивание grpcui бинарника..."
  mkdir -p "$BINARY_DIR"
  
  # Скачиваем tar.gz архив
  if command_exists curl; then
    curl -L -o "$TEMP_DIR/grpcui.tar.gz" "$URL" || {
      echo "✗ Ошибка при скачивании. Проверьте доступность: $URL"
      rm -rf "$TEMP_DIR"
      return 1
    }
  elif command_exists wget; then
    wget -O "$TEMP_DIR/grpcui.tar.gz" "$URL" || {
      echo "✗ Ошибка при скачивании. Проверьте доступность: $URL"
      rm -rf "$TEMP_DIR"
      return 1
    }
  else
    echo "✗ Не найдены curl или wget для скачивания бинарника"
    rm -rf "$TEMP_DIR"
    return 1
  fi

  # Распаковываем архив
  if ! tar -xzf "$TEMP_DIR/grpcui.tar.gz" -C "$TEMP_DIR" 2>/dev/null; then
    echo "✗ Ошибка при распаковке архива"
    rm -rf "$TEMP_DIR"
    return 1
  fi

  # Ищем бинарник в распакованных файлах
  local FOUND_BINARY=$(find "$TEMP_DIR" -name "grpcui" -type f 2>/dev/null | head -1)
  
  if [ -z "$FOUND_BINARY" ] || [ ! -f "$FOUND_BINARY" ]; then
    echo "✗ Бинарник grpcui не найден в архиве"
    rm -rf "$TEMP_DIR"
    return 1
  fi

  # Проверяем, что это действительно исполняемый файл
  if ! file "$FOUND_BINARY" | grep -qE "(ELF|executable|binary)"; then
    echo "✗ Скачанный файл не является бинарником"
    rm -rf "$TEMP_DIR"
    return 1
  fi

  # Копируем бинарник в целевую директорию
  cp "$FOUND_BINARY" "$BINARY_PATH" || {
    echo "✗ Ошибка при копировании бинарника"
    rm -rf "$TEMP_DIR"
    return 1
  }

  chmod +x "$BINARY_PATH"
  export PATH="$BINARY_DIR:$PATH"
  
  # Очищаем временные файлы
  rm -rf "$TEMP_DIR"
  
  echo "✓ grpcui установлен в $BINARY_PATH"
  return 0
}

# Проверка наличия grpcui
if ! command_exists grpcui; then
  echo "⚠ grpcui не найден. Попытка установки..."
  
  # Сначала пробуем установить через go install (если есть Go)
  if command_exists go; then
    if install_grpcui_go; then
      echo "✓ grpcui установлен через go install"
    else
      echo "⚠ Не удалось установить через go install, пробуем скачать бинарник..."
      if install_grpcui_binary; then
        echo "✓ grpcui установлен через бинарник"
      else
        echo "✗ Не удалось установить grpcui"
        echo ""
        echo "Ручная установка:"
        echo "  1. Установите Go: https://go.dev/dl/"
        echo "  2. Выполните: go install github.com/fullstorydev/grpcui/cmd/grpcui@latest"
        echo "  3. Или скачайте бинарник: https://github.com/fullstorydev/grpcui/releases"
        exit 1
      fi
    fi
  else
    # Если Go нет, пробуем скачать бинарник
    if install_grpcui_binary; then
      echo "✓ grpcui установлен через бинарник"
    else
      echo "✗ Не удалось установить grpcui"
      echo ""
      echo "Установите grpcui вручную:"
      echo "  1. Установите Go: https://go.dev/dl/"
      echo "  2. Выполните: go install github.com/fullstorydev/grpcui/cmd/grpcui@latest"
      echo "  3. Или скачайте бинарник: https://github.com/fullstorydev/grpcui/releases"
      exit 1
    fi
  fi
else
  echo "✓ grpcui уже установлен"
fi

# Проверка версии
GRPCUI_VERSION=$(grpcui -version 2>/dev/null || grpcui --version 2>/dev/null || echo "unknown")
echo "📋 Версия grpcui: $GRPCUI_VERSION"

# Проверка доступности gRPC сервера
echo "🔍 Проверка доступности gRPC сервера на ${GRPC_SERVER_ADDRESS}..."
if command_exists nc; then
  if nc -z ${GRPC_SERVER_HOST} ${GRPC_SERVER_PORT} 2>/dev/null; then
    echo "✓ gRPC сервер доступен"
  else
    echo "⚠ gRPC сервер НЕ доступен на ${GRPC_SERVER_ADDRESS}"
    echo "  Убедитесь, что сервер запущен: npm run start:user-grpc-server"
    echo "  Продолжить запуск grpcui? (y/n)"
    read -t 5 -n 1 answer || answer="y"
    echo ""
    if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
      echo "Запуск отменен."
      exit 1
    fi
  fi
elif command_exists timeout && command_exists bash; then
  if timeout 1 bash -c "echo >/dev/tcp/${GRPC_SERVER_HOST}/${GRPC_SERVER_PORT}" 2>/dev/null; then
    echo "✓ gRPC сервер доступен"
  else
    echo "⚠ gRPC сервер НЕ доступен на ${GRPC_SERVER_ADDRESS}"
    echo "  Убедитесь, что сервер запущен: npm run start:user-grpc-server"
  fi
fi

# Запуск grpcui
echo ""
echo "========================================="
echo "Запуск grpcui"
echo "========================================="
echo "gRPC сервер: ${GRPC_SERVER_ADDRESS}"
echo "Веб-интерфейс: http://localhost:${GRPCUI_PORT}"
echo "========================================="
echo ""
echo "Откройте в браузере: http://localhost:${GRPCUI_PORT}"
echo "Для остановки нажмите Ctrl+C"
echo ""

grpcui -plaintext -port ${GRPCUI_PORT} ${GRPC_SERVER_ADDRESS}
