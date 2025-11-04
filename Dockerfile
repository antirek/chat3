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

# Открываем порт приложения
EXPOSE 3000

# Healthcheck для проверки состояния контейнера
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/admin', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# По умолчанию запускаем API сервер
# Для запуска воркера: docker run ... node src/workers/updateWorker.js
CMD ["node", "src/index.js"]

