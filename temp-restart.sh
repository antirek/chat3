#!/bin/bash
pkill -f "node src/index.js" 2>/dev/null
pkill -f "updateWorker" 2>/dev/null
sleep 2
cd /home/sergey/Projects/tmp3/chat3
node src/index.js > /tmp/chat3.log 2>&1 &
sleep 3
node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
sleep 2
tail -20 /tmp/chat3.log

