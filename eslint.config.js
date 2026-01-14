import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
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
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Запрещаем динамические импорты (import()) для JS
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Динамические импорты (import()) запрещены. Используйте статические импорты в начале файла.',
        },
      ],
      // Разрешаем неиспользуемые переменные с префиксом _ (стандартная практика)
      'no-unused-vars': 'off', // Отключаем для JS, используем TypeScript правило
      // TypeScript правила
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    },
  },
  // Конфигурация для UI файлов (браузерное окружение)
  {
    files: ['packages/controlo-ui/src/**/*.ts', 'packages/controlo-ui/src/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
      },
    },
  },
  // Конфигурация для роутера (разрешаем динамические импорты для code splitting)
  {
    files: ['**/router/**', '**/router/**/*.ts', '**/router/**/*.js', 'packages/controlo-ui/src/app/router/**'],
    rules: {
      'no-restricted-syntax': 'off', // Разрешаем динамические импорты в роутере (стандартная практика Vue Router)
    },
  },
  // Конфигурация для тестовых файлов
  {
    files: ['**/__tests__/**', '**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
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
      '@typescript-eslint/no-unused-vars': 'off',
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
      '**/*.d.ts',
    ],
  },
];
