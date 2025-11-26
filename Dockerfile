# Multi-stage build для оптимизации размера образа
FROM node:18-alpine AS base

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Финальный образ
FROM node:18-alpine AS runner

WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chat3user

# Копируем node_modules из базового образа
COPY --from=base --chown=chat3user:nodejs /app/node_modules ./node_modules

# Копируем исходный код приложения
COPY --chown=chat3user:nodejs . .

# Переключаемся на непривилегированного пользователя
USER chat3user

# Открываем порты для всех сервисов
EXPOSE 3000 3001 3002 3003

# CMD будет переопределен в docker-compose.yml для каждого сервиса
CMD ["npm", "run", "start:tenant-api"]


