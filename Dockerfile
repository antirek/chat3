# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS base

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Копируем файлы зависимостей (корневой package.json и все workspace пакеты)
COPY package*.json ./
COPY packages/ ./packages/
COPY packages-shared/ ./packages-shared/

# Устанавливаем зависимости для всех workspaces
RUN npm ci --omit=dev && npm cache clean --force

# Финальный образ
FROM node:20-alpine AS runner

WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chat3user

# Копируем node_modules из базового образа (включая workspace зависимости)
COPY --from=base --chown=chat3user:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=chat3user:nodejs /app/package-lock.json ./package-lock.json

# Копируем исходный код приложения
COPY --chown=chat3user:nodejs . .

# Переключаемся на непривилегированного пользователя
USER chat3user
