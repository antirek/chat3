#!/bin/bash

# Скрипт запуска Chat3 сервера с переменными окружения
# Использование: ./start.sh
export MMS3_PROJECT_NAME=LOCAL

# Установка переменных окружения для RabbitMQ
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://rmuser:rmpassword@localhost:5672/}"
export RABBITMQ_EVENTS_EXCHANGE=mms3_events
export RABBITMQ_UPDATES_EXCHANGE=mms3_updates
export RABBITMQ_MANAGEMENT_URL=http://localhost:15672

# MongoDB переменные окружения
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/chat3}"

# Окружение
export NODE_ENV="${NODE_ENV:-development}"

# Запуск сервера
npm run start:all

