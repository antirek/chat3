import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import pkg from '../../../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Get URLs from environment variables or use defaults
// CONTROL_APP_URL для внутренних запросов Express (target для прокси)
const CONTROL_APP_URL_INTERNAL = process.env.CONTROL_API_TARGET || 'http://gateway:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DOCKER = process.env.DOCKER === 'true'; // Флаг для определения, запущен ли в Docker

// TENANT_API_URL: в Docker используем имя сервиса, в dev - localhost
const TENANT_API_URL = process.env.TENANT_API_URL || (IS_DOCKER ? 'http://tenant-api:3000' : 'http://localhost:3000');
const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';
const PROJECT_NAME = process.env.MMS3_PROJECT_NAME || 'chat3';
const APP_VERSION = pkg.version || '0.0.0';

// CONTROL_APP_URL для клиента (браузера) - должен быть доступен извне Docker
const CLIENT_CONTROL_APP_URL = process.env.CLIENT_CONTROL_APP_URL || 'http://localhost:3003';

// Extract port from URL for server listening
// Приоритет: PORT > порт из CLIENT_CONTROL_APP_URL > 3003
let PORT = process.env.PORT;
if (!PORT) {
  try {
    PORT = new URL(CLIENT_CONTROL_APP_URL).port;
  } catch {
    // ignore
  }
}
PORT = PORT || '3003';

// Прокси для control-api endpoints (должен быть перед статикой)
app.use('/api/init', createProxyMiddleware({
  target: CONTROL_APP_URL_INTERNAL,
  changeOrigin: true,
  pathRewrite: { '^/api/init': '/api/init' },
}));

app.use('/api/db-explorer', createProxyMiddleware({
  target: CONTROL_APP_URL_INTERNAL,
  changeOrigin: true,
  pathRewrite: { '^/api/db-explorer': '/api/db-explorer' },
}));

// Прокси для events endpoints
app.use('/api/dialogs', (req, res, next) => {
  if (req.path.includes('/events') || req.path.includes('/updates')) {
    createProxyMiddleware({
      target: CONTROL_APP_URL_INTERNAL,
      changeOrigin: true,
    })(req, res, next);
  } else {
    next(); // Пропускаем дальше для tenant-api
  }
});

app.use('/api/messages', (req, res, next) => {
  if (req.path.includes('/events') || req.path.includes('/updates')) {
    createProxyMiddleware({
      target: CONTROL_APP_URL_INTERNAL,
      changeOrigin: true,
    })(req, res, next);
  } else {
    next(); // Пропускаем дальше для tenant-api
  }
});

// Прокси для tenant-api не нужен - UI обращается напрямую к tenant-api

// Health check endpoint - must be before static files
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat3 UI Server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: APP_VERSION,
    endpoints: {
      main: `http://localhost:${PORT}`,
      apiDocs: `${CLIENT_CONTROL_APP_URL}/api-docs`,
      tenantApi: 'Direct connection (no proxy)',
      controlApi: CLIENT_CONTROL_APP_URL,
    },
    services: {
      ui: 'running',
      tenantApi: 'Direct connection (no proxy)',
      controlApi: CLIENT_CONTROL_APP_URL,
    }
  });
});

// Dynamic config.js endpoint - must be before static files
app.get('/config.js', (req, res) => {
  res.type('application/javascript');

  // Safely escape URLs for JavaScript
  // Для клиента (браузера) используем внешние URL (localhost), а не внутренние Docker адреса
  const CLIENT_TENANT_API_URL = process.env.CLIENT_TENANT_API_URL || 'http://localhost:3000';
  const config = {
    TENANT_API_URL: CLIENT_TENANT_API_URL, // Для клиента используем внешний URL
    CONTROL_APP_URL: CLIENT_CONTROL_APP_URL, // Для клиента используем CLIENT_CONTROL_APP_URL
    RABBITMQ_MANAGEMENT_URL: RABBITMQ_MANAGEMENT_URL,
    PROJECT_NAME: PROJECT_NAME,
    APP_VERSION: APP_VERSION,
  };

  res.send(`// Конфигурация URL для разных сервисов (генерируется динамически из process.env)
window.CHAT3_CONFIG = {
    TENANT_API_URL: ${JSON.stringify(config.TENANT_API_URL)},
    CONTROL_APP_URL: ${JSON.stringify(config.CONTROL_APP_URL)},
    RABBITMQ_MANAGEMENT_URL: ${JSON.stringify(config.RABBITMQ_MANAGEMENT_URL)},
    PROJECT_NAME: ${JSON.stringify(config.PROJECT_NAME)},
    APP_VERSION: ${JSON.stringify(config.APP_VERSION)},
    
    getTenantApiUrl: function(path = '') {
        return this.TENANT_API_URL + path;
    },
    
    getControlApiUrl: function(path = '') {
        return this.CONTROL_APP_URL + path;
    }
};`);
});

// Отдаем статику из dist (работает и в production, и в development)
// ВАЖНО: статика должна быть ПОСЛЕ прокси, чтобы /api/* запросы не отдавались как статика
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));

  // Все остальные маршруты (кроме /api/*, /health, /config.js) отдаем index.html для SPA
  app.get('*', (req, res, next) => {
    // Пропускаем /api/*, /health, /config.js - они обрабатываются отдельными маршрутами
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/config.js') {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  // Если dist не существует, отдаем простое сообщение
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/config.js') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chat3 UI</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>Chat3 UI Server</h1>
          <p>Please build the project first: <code>npm run build</code></p>
          <p>Or run in development mode: <code>npm run dev</code></p>
        </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🧪 API Test is running on ${CLIENT_CONTROL_APP_URL}`);
  console.log(`📄 Main page: ${CLIENT_CONTROL_APP_URL}`);
  console.log(`\n💡 Configure API endpoints:`);
      console.log(`   Tenant API: Direct connection (no proxy)`);
  console.log(`   Control App (client-facing): ${CLIENT_CONTROL_APP_URL}`);
  console.log(`   Control App (internal proxy target): ${CONTROL_APP_URL_INTERNAL}`);
  console.log(`   Mode: ${NODE_ENV}\n`);
});
