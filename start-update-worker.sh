#!/bin/bash

# Update Worker startup script
# This worker processes events from RabbitMQ and creates updates

# Start the worker
echo "🚀 Starting Update Worker..."
npm run start:update-worker
