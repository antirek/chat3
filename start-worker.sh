#!/bin/bash

# Update Worker startup script
# This worker processes events from RabbitMQ and creates updates

# Load environment variables if .env file exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if MongoDB is available
if ! command -v mongo &> /dev/null && ! command -v mongosh &> /dev/null; then
    echo "⚠️  MongoDB client not found in PATH, but worker will try to connect anyway..."
fi

# Check if RabbitMQ is available
if ! command -v rabbitmqctl &> /dev/null; then
    echo "⚠️  RabbitMQ not found in PATH, but worker will try to connect anyway..."
fi

# Start the worker
echo "🚀 Starting Update Worker..."
node src/workers/updateWorker.js

