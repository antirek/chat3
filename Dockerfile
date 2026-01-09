# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS base

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Копируем файлы зависимостей (корневой package.json и все workspace пакеты)
COPY package*.json ./
COPY packages/ ./packages/
COPY packages-shared/ ./packages-shared/

# Устанавливаем все зависимости (включая dev для сборки TypeScript)
RUN npm ci && npm cache clean --force

# Собираем TypeScript пакеты
RUN npm run build --workspaces --if-present

# Финальный образ
FROM node:20-alpine AS runner

WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chat3user

# Копируем package.json для установки только production зависимостей
COPY --chown=chat3user:nodejs package*.json ./
COPY --chown=chat3user:nodejs packages/ ./packages/
COPY --chown=chat3user:nodejs packages-shared/ ./packages-shared/

# Устанавливаем только production зависимости
RUN npm ci --omit=dev && npm cache clean --force

# Переключаемся на непривилегированного пользователя
USER chat3user
