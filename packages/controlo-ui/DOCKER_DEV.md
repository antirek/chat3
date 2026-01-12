# Разработка controlo-ui в Docker контейнере

## Режимы работы

### Production режим (по умолчанию)
- Использует собранные файлы из `dist/`
- Express сервер отдает статику
- Изменения требуют пересборки образа

### Development режим
- Монтирует исходники в контейнер
- Запускает Vite dev server с HMR
- Изменения применяются автоматически без пересборки

## Запуск в режиме разработки

### Вариант 1: Через переменную окружения

Добавьте в `.env` файл:
```env
CONTROLO_UI_NODE_ENV=development
```

Затем перезапустите контейнер:
```bash
docker-compose up -d controlo-ui
```

### Вариант 2: Через docker-compose.override.yml

Создайте файл `docker-compose.override.yml` в корне проекта:
```yaml
version: '3.8'

services:
  controlo-ui:
    environment:
      - NODE_ENV=development
    command: sh -c "cd /app/packages/controlo-ui && npm run dev"
```

Затем:
```bash
docker-compose up -d controlo-ui
```

### Вариант 3: Временное изменение команды

```bash
docker-compose run --rm -e NODE_ENV=development controlo-ui sh -c "cd /app/packages/controlo-ui && npm run dev"
```

## Что происходит в dev режиме

1. **Монтируются исходники**:
   - `./packages/controlo-ui/src` → `/app/packages/controlo-ui/src`
   - `vite.config.ts`, `tsconfig.json`, `index.html`

2. **Запускается Vite dev server**:
   - HMR (Hot Module Replacement) работает автоматически
   - Изменения применяются без перезагрузки страницы

3. **node_modules изолированы**:
   - Используется named volume `controlo_ui_node_modules`
   - Зависимости не перезаписываются при монтировании

## Проверка работы

1. Откройте `http://localhost:3003/tenants`
2. Измените файл `packages/controlo-ui/src/pages/TenantsPage.vue`
3. Сохраните файл
4. Страница должна обновиться автоматически

## Логи

Проверьте логи контейнера:
```bash
docker-compose logs -f controlo-ui
```

В dev режиме вы должны увидеть:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3003/
➜  Network: use --host to expose
```

## Возврат в production режим

Удалите переменную окружения или пересоберите контейнер:
```bash
# Удалите CONTROLO_UI_NODE_ENV из .env или установите в production
CONTROLO_UI_NODE_ENV=production

# Пересоздайте контейнер
docker-compose up -d --force-recreate controlo-ui
```

## Важные замечания

1. **В dev режиме** Vite dev server работает на порту 3003 внутри контейнера
2. **node_modules** должны быть установлены в контейнере (при первом запуске)
3. **Изменения применяются мгновенно** благодаря volume mount
4. **HMR работает** так же, как при локальной разработке

## Устранение проблем

### Проблема: Изменения не применяются
- Проверьте, что volume правильно смонтирован: `docker-compose exec controlo-ui ls -la /app/packages/controlo-ui/src`
- Убедитесь, что `CONTROLO_UI_NODE_ENV=development`

### Проблема: Ошибки компиляции
- Проверьте логи: `docker-compose logs controlo-ui`
- Убедитесь, что зависимости установлены в контейнере

### Проблема: HMR не работает
- Проверьте, что Vite dev server запущен (не Express)
- Откройте консоль браузера для проверки WebSocket соединения
