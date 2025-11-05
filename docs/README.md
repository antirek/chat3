# 📚 Документация Chat3

Добро пожаловать в документацию проекта Chat3!

## 📖 Основная документация

### Начало работы
- **[README.md](../README.md)** - Главная страница проекта
- **[QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md)** - Быстрый старт с Docker
- **[RESTART_INSTRUCTIONS.md](RESTART_INSTRUCTIONS.md)** - Инструкции по перезапуску

### Архитектура и API
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Архитектура системы
- **[API.md](API.md)** - Документация REST API
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Система аутентификации
- **[FILTER_RULES.md](FILTER_RULES.md)** - Правила фильтрации запросов

### Функциональность
- **[EVENTS.md](EVENTS.md)** - Система событий
- **[UPDATES.md](UPDATES.md)** - Система обновлений (Updates)
- **[WORKERS.md](WORKERS.md)** - Update Worker и обработка событий

---

## 🐳 Docker

- **[DOCKER.md](DOCKER.md)** - Полная документация по Docker
- **[DOCKER_FILES.md](DOCKER_FILES.md)** - Описание всех Docker файлов
- **[QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md)** - Быстрый старт (3 команды)

---

## 🔧 Технические изменения

### Кастомные ID
- **[CUSTOM_IDS.md](CUSTOM_IDS.md)** - Документация по кастомным ID (dialogId, messageId)
- **[CHANGES_CUSTOM_IDS.md](CHANGES_CUSTOM_IDS.md)** - Изменения для кастомных ID
- **[SUMMARY_CUSTOM_IDS.txt](SUMMARY_CUSTOM_IDS.txt)** - Краткая сводка

### Исправления
- **[CONTROLLERS_ID_FIX.md](CONTROLLERS_ID_FIX.md)** - Исправления контроллеров для работы с новыми ID
- **[MESSAGEID_UPDATE.md](MESSAGEID_UPDATE.md)** - Обновление messageId в MessageStatus и MessageReaction
- **[FINAL_ID_FIXES.md](FINAL_ID_FIXES.md)** - Финальные исправления использования ID

### История
- **[SUMMARY.md](SUMMARY.md)** - Полная сводка всех изменений проекта

---

## 🎯 Быстрый доступ

### Разработчику
1. Начните с [README.md](../README.md)
2. Изучите [ARCHITECTURE.md](ARCHITECTURE.md)
3. Ознакомьтесь с [API.md](API.md)
4. Прочитайте [AUTHENTICATION.md](AUTHENTICATION.md)

### DevOps
1. [DOCKER.md](DOCKER.md) - Полная настройка Docker
2. [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md) - Быстрый старт
3. [RESTART_INSTRUCTIONS.md](RESTART_INSTRUCTIONS.md) - Перезапуск

### Тестировщику
1. [API.md](API.md) - Все endpoint'ы
2. [FILTER_RULES.md](FILTER_RULES.md) - Примеры фильтров
3. Тестовые интерфейсы: http://localhost:3000/api-test-user-dialogs.html

---

## 🔍 Поиск по темам

### Аутентификация и безопасность
- [AUTHENTICATION.md](AUTHENTICATION.md) - API ключи, X-TENANT-ID заголовок

### Данные и модели
- [CUSTOM_IDS.md](CUSTOM_IDS.md) - Форматы dialogId и messageId
- [ARCHITECTURE.md](ARCHITECTURE.md) - Структура БД

### События и обновления
- [EVENTS.md](EVENTS.md) - Система событий
- [UPDATES.md](UPDATES.md) - Система обновлений (Updates)
- [WORKERS.md](WORKERS.md) - Update Worker
- [RABBITMQ_REQUIRED.md](RABBITMQ_REQUIRED.md) - RabbitMQ как критическая зависимость 🔴

### Docker и деплой
- [DOCKER.md](DOCKER.md) - Контейнеризация
- [DOCKER_FILES.md](DOCKER_FILES.md) - Описание файлов

### Фильтрация и запросы
- [FILTER_RULES.md](FILTER_RULES.md) - Синтаксис фильтров
- [API.md](API.md) - API endpoint'ы

---

## 📝 Changelog

Все изменения задокументированы в [SUMMARY.md](SUMMARY.md)

---

## 🆘 Помощь

Если вы не нашли ответ в документации:
1. Проверьте [README.md](../README.md) в корне проекта
2. Откройте Swagger UI: http://localhost:3000/api-docs
3. Изучите примеры в тестовых интерфейсах

---

**Последнее обновление:** 2025-11-04

