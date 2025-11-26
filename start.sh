#!/bin/bash

# Скрипт запуска Chat3 сервера с переменными окружения
# Использование: ./start.sh

# Установка переменных окружения для RabbitMQ
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://rmuser:rmpassword@localhost:5672/}"
export RABBITMQ_EVENTS_EXCHANGE="${RABBITMQ_EVENTS_EXCHANGE:-chat3_events}"
export RABBITMQ_UPDATES_EXCHANGE="${RABBITMQ_UPDATES_EXCHANGE:-chat3_updates}"

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
echo "   RabbitMQ URL: ${RABBITMQ_URL}"
echo "   RabbitMQ Events Exchange: ${RABBITMQ_EVENTS_EXCHANGE}"
echo "   RabbitMQ Updates Exchange: ${RABBITMQ_UPDATES_EXCHANGE}"
echo "   Port: ${PORT}"
echo "   Environment: ${NODE_ENV}"
echo ""

# Запуск сервера
npm start

