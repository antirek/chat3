# Инструкция по перезапуску проекта

## Автоматический перезапуск

Выполните в терминале:
```bash
cd /home/sergey/Projects/tmp3/chat3
bash restart.sh
```

## Ручной перезапуск

### 1. Остановка процессов:
```bash
pkill -f "node src/index.js"
pkill -f "node src/workers/updateWorker.js"
sleep 2
```

### 2. Запуск API сервера:
```bash
cd /home/sergey/Projects/tmp3/chat3
nohup node src/index.js > /tmp/chat3.log 2>&1 &
```

### 3. Запуск UpdateWorker:
```bash
sleep 2
nohup node src/workers/updateWorker.js > /tmp/updateWorker.log 2>&1 &
```

### 4. Проверка статуса:
```bash
ps aux | grep "node src" | grep -v grep
tail -20 /tmp/chat3.log
tail -20 /tmp/updateWorker.log
```

## Логи
- API Server: `/tmp/chat3.log`
- UpdateWorker: `/tmp/updateWorker.log`

