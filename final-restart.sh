#!/bin/bash

echo "🔄 Остановка процессов..."
pkill -f "node src" 2>/dev/null || true
sleep 3

echo "✅ Процессы остановлены"
echo ""

echo "🚀 Запуск API Server..."
cd /home/sergey/Projects/tmp3/chat3
nohup node src/index.js > /tmp/chat3.log 2>&1 &
SERVER_PID=$!
sleep 5

echo "⚙️  Запуск Update Worker..."
nohup node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
WORKER_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ✅ ПРОЕКТ ЗАПУЩЕН!                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Запущенные процессы:"
ps aux | grep "node src" | grep -v grep | head -5

echo ""
echo "📋 Логи API Server (последние 15 строк):"
tail -15 /tmp/chat3.log

echo ""
echo "📋 Логи Worker (последние 10 строк):"
tail -10 /tmp/worker.log

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  🌐 ДОСТУПНЫЕ URL                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 AdminJS:   http://localhost:3000/admin"
echo "📚 API Docs:  http://localhost:3000/api-docs"
echo "🔗 Links:     http://localhost:3000/admin-links"
echo ""
echo "🧪 Тестовые интерфейсы:"
echo "   - http://localhost:3000/api-test-user-dialogs.html"
echo "   - http://localhost:3000/api-test-dialogs.html"
echo "   - http://localhost:3000/api-test-messages.html"
echo ""
echo "🔑 API Key: chat3_edabb7b0fb722074c0d2efcc262f386fa23708adef9115392d79b4e5774e3d28"
echo "🏢 Tenant:  tnt_default"
echo ""
echo "📝 Мониторинг логов:"
echo "   API:    tail -f /tmp/chat3.log"
echo "   Worker: tail -f /tmp/worker.log"
echo ""

