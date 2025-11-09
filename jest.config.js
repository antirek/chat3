export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup.js', '/__tests__/globalSetup.js', '/__tests__/globalTeardown.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  testTimeout: 60000, // Увеличено для MongoDB Memory Server (загрузка может быть долгой)
  // globalSetup и globalTeardown для MongoDB Memory Server
  // Отключены по умолчанию, т.к. нужны только для интеграционных тестов
  // Можно включить, раскомментировав следующие строки:
  // globalSetup: '<rootDir>/src/utils/__tests__/globalSetup.js',
  // globalTeardown: '<rootDir>/src/utils/__tests__/globalTeardown.js',
};
