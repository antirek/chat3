#!/bin/bash

# Chat3 Docker Build Script
# Builds Docker images for API server and Worker

set -e

echo "🐳 Building Chat3 Docker images..."
echo ""

# Проверяем наличие Dockerfile
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found"
    exit 1
fi

IMAGE=antirek/mms3:0.0.58


echo "📦 Building..."
docker build -t ${IMAGE} .


echo "pushing..."
docker push ${IMAGE}
