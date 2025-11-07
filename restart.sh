    #!/bin/bash

# Остановка процессов
pkill -f "node src/index.js" 2>/dev/null
pkill -f "node src/workers/updateWorker.js" 2>/dev/null

# Ждем завершения
sleep 2

# Запуск API сервера
cd /home/sergey/Projects/tmp3/chat3
nohup node src/index.js > /tmp/chat3.log 2>&1 &

# Запуск UpdateWorker
sleep 2
nohup node src/workers/updateWorker.js > /tmp/updateWorker.log 2>&1 &

echo "Проект перезапущен"
echo "API Server: /tmp/chat3.log"
echo "UpdateWorker: /tmp/updateWorker.log"

