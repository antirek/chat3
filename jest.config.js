export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        moduleResolution: 'node'
      }
    }],
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@chat3/models$': '<rootDir>/packages-shared/models/dist/index.js',
    '^@chat3/utils$': '<rootDir>/packages-shared/utils/src/index.js',
    '^@chat3/config$': '<rootDir>/packages-shared/config/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.{js,ts}', '**/*.test.{js,ts}'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup.js', '/__tests__/globalSetup.js', '/__tests__/globalTeardown.js'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'packages-shared/**/*.{js,ts}',
    '!src/**/*.test.{js,ts}',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  testTimeout: 60000, // Увеличено для MongoDB Memory Server (загрузка может быть долгой)
  // maxWorkers удален - используем дефолтное значение (количество CPU cores)
  // Тесты изолированы в отдельных файлах, можно запускать параллельно
  // globalSetup и globalTeardown для MongoDB Memory Server
  // Отключены по умолчанию, т.к. нужны только для интеграционных тестов
  // Можно включить, раскомментировав следующие строки:
  // globalSetup: '<rootDir>/src/utils/__tests__/globalSetup.js',
  // globalTeardown: '<rootDir>/src/utils/__tests__/globalTeardown.js',
};
