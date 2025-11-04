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

# Версия образа (можно передать как аргумент)
VERSION=${1:-latest}

echo "📦 Building chat3:${VERSION}..."
docker build -t chat3:${VERSION} .

# Тегируем образ
docker tag chat3:${VERSION} chat3:latest

echo ""
echo "✅ Docker images built successfully!"
echo ""
echo "📋 Available images:"
docker images | grep chat3 | head -5

echo ""
echo "🚀 To run the containers:"
echo "   docker-compose up -d"
echo ""
echo "📊 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"

