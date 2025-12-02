#!/bin/bash

# Скрипт запуска Chat3 сервера с переменными окружения
# Использование: ./start.sh

# Установка переменных окружения для RabbitMQ
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://rmuser:rmpassword@localhost:5672/}"
export RABBITMQ_EVENTS_EXCHANGE="${RABBITMQ_EVENTS_EXCHANGE:-chat3_events}"
export RABBITMQ_UPDATES_EXCHANGE="${RABBITMQ_UPDATES_EXCHANGE:-chat3_updates}"

# MongoDB переменные окружения
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/chat3}"

# Окружение
export NODE_ENV="${NODE_ENV:-development}"

# Запуск сервера
npm run start:all

