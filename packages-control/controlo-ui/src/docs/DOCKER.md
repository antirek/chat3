# Docker конфигурация для controlo-ui

## Что было обновлено

### 1. Dockerfile
- ✅ Добавлена сборка `controlo-ui` через Vite (`npm run build`)
- ✅ Добавлено копирование `dist` директории в финальный образ

### 2. docker-compose.yml
- ✅ Добавлен сервис `controlo-ui` на порту 3003
- ✅ Настроен healthcheck для проверки доступности
- ✅ Добавлена зависимость от `tenant-api`

### 3. package.json
- ✅ `tsx` перемещен в `dependencies` (нужен для запуска сервера в production)

## Процесс сборки в Docker

1. **Сборка зависимостей**: Устанавливаются все зависимости (включая dev для сборки)
2. **Сборка TypeScript пакетов**: Собираются все workspace пакеты
3. **Сборка Vue приложения**: Выполняется `vite build` для `controlo-ui`
4. **Production образ**: Копируются только собранные файлы и production зависимости

## Запуск

### Локальная разработка (без Docker)
```bash
npm run dev  # Vite dev server
```

### Production (Docker)
```bash
docker-compose up --build controlo-ui
```

Или все сервисы:
```bash
docker-compose up --build
```

## Проверка работоспособности

После пересоздания контейнеров проверьте:

1. **Доступность приложения**: `http://localhost:3003`
2. **Config.js endpoint**: `http://localhost:3003/config.js`
3. **Healthcheck**: Docker должен показывать healthy статус
4. **Логи**: Проверьте логи контейнера на наличие ошибок

## Возможные проблемы

### Проблема: Контейнер не запускается
- Проверьте, что все зависимости установлены
- Убедитесь, что `tsx` в `dependencies` (не в `devDependencies`)
- Проверьте логи: `docker-compose logs controlo-ui`

### Проблема: 404 на config.js
- Убедитесь, что Express сервер запущен
- Проверьте переменные окружения в `.env`
- Проверьте, что `NODE_ENV=production` установлен

### Проблема: Статика не отдается
- Проверьте, что `dist` директория скопирована в образ
- Убедитесь, что путь в `server/index.ts` правильный (`../dist`)

## Переменные окружения

Убедитесь, что в `.env` файле установлены:
```env
CONTROL_APP_URL=http://localhost:3003
TENANT_API_URL=http://localhost:3000
RABBITMQ_MANAGEMENT_URL=http://localhost:15672
MMS3_PROJECT_NAME=chat3
NODE_ENV=production
```
