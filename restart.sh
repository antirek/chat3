#!/bin/bash

# Остановка процессов
pkill -f "node src/apps/tenant-api/index.js" 2>/dev/null
pkill -f "node src/apps/admin-web/index.js" 2>/dev/null
pkill -f "node src/apps/control-api/index.js" 2>/dev/null
pkill -f "node src/apps/api-test/index.js" 2>/dev/null
pkill -f "node src/workers/updateWorker.js" 2>/dev/null
pkill -f "node src/index.js" 2>/dev/null

# Ждем завершения
sleep 2

# Запуск всех приложений
cd /home/sergey/Projects/tmp3/chat3

# Tenant API (порт 3000)
nohup node src/apps/tenant-api/index.js > /tmp/tenant-api.log 2>&1 &

# Admin Web (порт 3001)
sleep 1
nohup node src/apps/admin-web/index.js > /tmp/admin-web.log 2>&1 &

# Control API (порт 3002)
sleep 1
nohup node src/apps/control-api/index.js > /tmp/control-api.log 2>&1 &

# API Test (порт 3003)
sleep 1
nohup node src/apps/api-test/index.js > /tmp/api-test.log 2>&1 &

# Update Worker
sleep 1
nohup node src/workers/updateWorker.js > /tmp/updateWorker.log 2>&1 &

echo "Проект перезапущен"
echo "Tenant API (3000): /tmp/tenant-api.log"
echo "Admin Web (3001): /tmp/admin-web.log"
echo "Control API (3002): /tmp/control-api.log"
echo "API Test (3003): /tmp/api-test.log"
echo "Update Worker: /tmp/updateWorker.log"
