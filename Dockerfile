# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS base

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Копируем файлы зависимостей (корневой package.json и все workspace пакеты)
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY packages-shared/ ./packages-shared/

# Устанавливаем все зависимости (включая dev для сборки TypeScript)
RUN npm ci && npm cache clean --force

# Собираем TypeScript пакеты в правильном порядке зависимостей
# Из-за циклической зависимости models <-> utils используем двухпроходную сборку:
# 1. Первый проход: собираем utils (может упасть, но создаст часть файлов)
RUN npm run build --workspace=@chat3/utils || true
# 2. Собираем models (теперь utils частично доступен)
RUN npm run build --workspace=@chat3/models || true
# 3. Второй проход: пересобираем оба пакета с правильными зависимостями
RUN npm run build --workspace=@chat3/utils && npm run build --workspace=@chat3/models

# Собираем остальные пакеты (все зависят от models и utils)
RUN npm run build --workspace=@chat3/tenant-api && \
    npm run build --workspace=@chat3/controlo-api && \
    npm run build --workspace=@chat3/controlo-gateway && \
    npm run build --workspace=@chat3/update-worker && \
    npm run build --workspace=@chat3/dialog-read-worker

# Финальный образ
FROM node:20-alpine AS runner

WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chat3user

# Копируем package.json и tsconfig.json
COPY --chown=chat3user:nodejs package*.json ./
COPY --chown=chat3user:nodejs tsconfig.json ./

# Копируем собранные dist директории из первого stage
COPY --from=base --chown=chat3user:nodejs /app/packages/tenant-api/dist ./packages/tenant-api/dist
COPY --from=base --chown=chat3user:nodejs /app/packages/controlo-gateway/dist ./packages/controlo-gateway/dist
COPY --from=base --chown=chat3user:nodejs /app/packages/controlo-api/dist ./packages/controlo-api/dist
COPY --from=base --chown=chat3user:nodejs /app/packages/update-worker/dist ./packages/update-worker/dist
COPY --from=base --chown=chat3user:nodejs /app/packages/dialog-read-worker/dist ./packages/dialog-read-worker/dist
COPY --from=base --chown=chat3user:nodejs /app/packages-shared/models/dist ./packages-shared/models/dist
COPY --from=base --chown=chat3user:nodejs /app/packages-shared/utils/dist ./packages-shared/utils/dist

# Копируем package.json файлы для установки зависимостей
COPY --chown=chat3user:nodejs packages/ ./packages/
COPY --chown=chat3user:nodejs packages-shared/ ./packages-shared/

# Устанавливаем только production зависимости
RUN npm ci --omit=dev && npm cache clean --force

# Переключаемся на непривилегированного пользователя
USER chat3user
