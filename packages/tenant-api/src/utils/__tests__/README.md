# Тесты для утилит

## Структура тестов

### Unit тесты
- `queryParser.test.js` - тесты для парсинга фильтров (без БД)
- `timestampUtils.test.js` - тесты для работы с timestamp
- `responseUtils.test.js` - тесты для санитизации ответов

### Интеграционные тесты
- `queryParser.integration.test.js` - тесты для `processMemberFilters` с использованием MongoDB Memory Server

## MongoDB Memory Server

Для интеграционных тестов используется `mongodb-memory-server`, который создает in-memory MongoDB базу данных.

### Использование

```javascript
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';

// Setup перед тестами
beforeAll(async () => {
  await setupMongoMemoryServer();
});

// Teardown после тестов
afterAll(async () => {
  await teardownMongoMemoryServer();
});

// Очистка данных перед каждым тестом
beforeEach(async () => {
  await clearDatabase();
});
```

### Файлы

- `setup.js` - функции для настройки и очистки MongoDB Memory Server
- `globalSetup.js` - глобальный setup (не используется по умолчанию)
- `globalTeardown.js` - глобальный teardown (не используется по умолчанию)

### Примечания

- MongoDB Memory Server автоматически загружается при первом запуске тестов
- Первая загрузка может занять некоторое время (скачивание MongoDB binary)
- Для каждого тестового файла создается отдельная in-memory база данных
- Данные автоматически очищаются между тестами

## Запуск тестов

```bash
# Все тесты
npm test

# Только unit тесты
npm test -- queryParser.test.js timestampUtils.test.js responseUtils.test.js

# Только интеграционные тесты
npm test -- queryParser.integration.test.js

# С покрытием кода
npm run test:coverage
```

## Добавление новых интеграционных тестов

1. Создайте новый файл `*.integration.test.js`
2. Импортируйте функции из `setup.js`
3. Используйте `beforeAll` и `afterAll` для настройки MongoDB
4. Используйте `beforeEach` для очистки данных

Пример:

```javascript
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';
import { YourModel } from '../../models/index.js';

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('Your tests', () => {
  test('should work with MongoDB', async () => {
    const doc = await YourModel.create({ ... });
    expect(doc).toBeDefined();
  });
});
```

