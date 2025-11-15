#!/bin/bash

# Dialog Read Worker startup script

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "🚀 Starting Dialog Read Worker..."
node src/workers/dialogReadWorker.js

