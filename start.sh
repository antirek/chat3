#!/bin/bash

# Скрипт запуска Chat3 сервера с переменными окружения
# Использование: ./start.sh

# Установка переменных окружения для RabbitMQ
export RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
export RABBITMQ_PORT="${RABBITMQ_PORT:-5672}"
export RABBITMQ_USER="${RABBITMQ_USER:-rmuser}"
export RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-rmpassword}"
export RABBITMQ_VHOST="${RABBITMQ_VHOST:-/}"
export RABBITMQ_EXCHANGE="${RABBITMQ_EXCHANGE:-chat3_events}"

# MongoDB переменные окружения
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/chat3}"

# Порт сервера
export PORT="${PORT:-3000}"

# Окружение
export NODE_ENV="${NODE_ENV:-development}"

# Вывод конфигурации
echo "🚀 Starting Chat3 Server..."
echo ""
echo "📋 Configuration:"
echo "   MongoDB URI: ${MONGODB_URI}"
echo "   RabbitMQ: ${RABBITMQ_USER}@${RABBITMQ_HOST}:${RABBITMQ_PORT}${RABBITMQ_VHOST}"
echo "   RabbitMQ Exchange: ${RABBITMQ_EXCHANGE}"
echo "   Port: ${PORT}"
echo "   Environment: ${NODE_ENV}"
echo ""

# Запуск сервера
npm start

