import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'fs';
import { join } from 'path';

// Читаем package.json для версии
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

// Функция для генерации config.js
function generateConfigJs() {
  const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
  // CONTROL_APP_URL должен указывать на control-api (gateway), а не на UI сервер
  const CONTROL_APP_URL = process.env.CONTROL_APP_URL || 'http://localhost:3001';
  const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';
  const PROJECT_NAME = process.env.MMS3_PROJECT_NAME || 'chat3';
  const APP_VERSION = packageJson.version || '0.0.0';

  return `// Конфигурация URL для разных сервисов (генерируется динамически из process.env)
window.CHAT3_CONFIG = {
    TENANT_API_URL: ${JSON.stringify(TENANT_API_URL)},
    CONTROL_APP_URL: ${JSON.stringify(CONTROL_APP_URL)},
    RABBITMQ_MANAGEMENT_URL: ${JSON.stringify(RABBITMQ_MANAGEMENT_URL)},
    PROJECT_NAME: ${JSON.stringify(PROJECT_NAME)},
    APP_VERSION: ${JSON.stringify(APP_VERSION)},
    
    getTenantApiUrl: function(path = '') {
        return this.TENANT_API_URL + path;
    },
    
    getControlApiUrl: function(path = '') {
        return this.CONTROL_APP_URL + path;
    }
};`;
}

// Vite плагин для генерации config.js
function configJsPlugin() {
  return {
    name: 'config-js-plugin',
    configureServer(server) {
      server.middlewares.use('/config.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(generateConfigJs());
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), configJsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@/entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@/features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@/widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
    },
  },
  server: {
    port: 3003,
    proxy: {
      // Прокси для control-api endpoints (init, db-explorer) - должны быть первыми
      '/api/init': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/db-explorer': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      // Прокси для events endpoints в dialogs - должны быть перед общим /api/dialogs
      '^/api/dialogs/.*/events': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '^/api/dialogs/.*/updates': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      // Прокси для events endpoints в messages - должны быть перед общим /api/messages
      '^/api/messages/.*/events': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '^/api/messages/.*/updates': {
        target: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      // Прокси для всех остальных /api/* запросов к tenant-api (должен быть последним)
      '/api': {
        target: process.env.TENANT_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
