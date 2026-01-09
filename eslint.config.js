import js from '@eslint/js';
import jest from 'eslint-plugin-jest';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      // Запрещаем динамические импорты (import())
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Динамические импорты (import()) запрещены. Используйте статические импорты в начале файла.',
        },
      ],
      // Разрешаем неиспользуемые переменные с префиксом _ (стандартная практика)
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Конфигурация для тестовых файлов
  {
    files: ['**/__tests__/**', '**/*.test.js', '**/*.spec.js'],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
      },
    },
    rules: {
      // В тестах разрешаем динамические импорты (могут быть нужны для условной загрузки)
      'no-restricted-syntax': 'off',
      // В тестах разрешаем неиспользуемые переменные (могут быть для отладки или будущего использования)
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      '*.min.js',
      'dist/**',
      'build/**',
      'packages/tenant-api-client/node_modules/**',
      'packages/tenant-api-client/coverage/**',
    ],
  },
];
