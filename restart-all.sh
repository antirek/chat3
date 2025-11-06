#!/bin/bash

echo "🔄 Stopping all processes..."
pkill -f "node src/index.js" 2>/dev/null
pkill -f "updateWorker" 2>/dev/null
sleep 2

echo "✅ All processes stopped"
echo ""

echo "🚀 Starting API Server..."
cd /home/sergey/Projects/tmp3/chat3
npm start > /tmp/chat3.log 2>&1 &
sleep 3

echo "⚙️  Starting Update Worker..."
node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
sleep 2

echo ""
echo "📊 Checking status..."
sleep 2

echo ""
echo "=== API Server Log (last 20 lines) ==="
tail -20 /tmp/chat3.log

echo ""
echo "=== Worker Log (last 10 lines) ==="
tail -10 /tmp/worker.log

echo ""
echo "=== Running Processes ==="
ps aux | grep -E "node src/index|updateWorker" | grep -v grep

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ✅ RESTART COMPLETED!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access:"
echo "   📊 AdminJS:   http://localhost:3000/admin"
echo "   📚 API Docs:  http://localhost:3000/api-docs"
echo ""
echo "📋 Logs:"
echo "   API:    tail -f /tmp/chat3.log"
echo "   Worker: tail -f /tmp/worker.log"


