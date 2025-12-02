#!/bin/bash

# Остановка процессов
pkill -f "node src/apps/tenant-api/index.js" 2>/dev/null
pkill -f "node src/apps/gateway/index.js" 2>/dev/null
pkill -f "node src/apps/control-api/index.js" 2>/dev/null
pkill -f "node src/apps/api-test/index.js" 2>/dev/null
pkill -f "node src/apps/update-worker/index.js" 2>/dev/null
pkill -f "node src/apps/dialog-read-worker/index.js" 2>/dev/null
pkill -f "node src/index.js" 2>/dev/null

# Ждем завершения
sleep 2

# Запуск всех приложений
cd /home/sergey/Projects/tmp3/chat3

# Tenant API (порт 3000)
nohup node src/apps/tenant-api/index.js > /tmp/tenant-api.log 2>&1 &

# Gateway (порт 3001)
sleep 1
nohup node src/apps/gateway/index.js > /tmp/gateway.log 2>&1 &

# Control API (порт 3002)
sleep 1
nohup node src/apps/control-api/index.js > /tmp/control-api.log 2>&1 &

# API Test (порт 3003)
sleep 1
nohup node src/apps/api-test/index.js > /tmp/api-test.log 2>&1 &

# Update Worker
sleep 1
nohup node src/apps/update-worker/index.js > /tmp/update-worker.log 2>&1 &

# Dialog Read Worker
sleep 1
nohup node src/apps/dialog-read-worker/index.js > /tmp/dialog-read-worker.log 2>&1 &

echo "Проект перезапущен"
echo "Tenant API (3000): /tmp/tenant-api.log"
echo "Gateway (3001): /tmp/gateway.log"
echo "Control API (3002): /tmp/control-api.log"
echo "API Test (3003): /tmp/api-test.log"
echo "Update Worker: /tmp/update-worker.log"
echo "Dialog Read Worker: /tmp/dialog-read-worker.log"
