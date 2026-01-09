import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from '../../../package.json' assert { type: 'json' };

import connectDB from '@chat3/config';
import initRoutes from '@chat3/controlo-api/src/routes/initRoutes.js';
import eventsRoutes from '@chat3/controlo-api/src/routes/eventsRoutes.js';
import dbExplorerRoutes from '@chat3/controlo-api/src/routes/dbExplorerRoutes.js';
import swaggerSpec from '@chat3/controlo-api/src/config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Trust proxy для правильной работы с reverse proxy (nginx)
// Это позволяет Express правильно определять req.protocol и req.ip
app.set('trust proxy', true);

// Get URLs from environment variables or use defaults
const CONTROL_APP_URL = process.env.CONTROL_APP_URL || 'http://localhost:3001';
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';
const PROJECT_NAME = process.env.MMS3_PROJECT_NAME || 'chat3';
const APP_VERSION = pkg.version || '0.0.0';

// Extract port from URL for server listening
const PORT = new URL(CONTROL_APP_URL).port || 3001;

// CORS middleware - разрешаем запросы с разных источников
app.use(cors({
  origin: '*', // В production можно ограничить
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id', 'x-tenant-id']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 1. Control API Routes - /api/init, /api/dialogs, /api/messages, /api/db-explorer
// ============================================
app.use('/api/init', initRoutes);
app.use('/api', eventsRoutes);
app.use('/api/db-explorer', dbExplorerRoutes);

// ============================================
// 2. Swagger UI - /api-docs
// ============================================
app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  // Учитываем X-Forwarded-Proto для случаев, когда перед gateway стоит reverse proxy
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  const swaggerSpecWithHost = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${host}`,
        description: 'Current server'
      }
    ]
  };
  swaggerUi.setup(swaggerSpecWithHost, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chat3 Gateway API Documentation'
  })(req, res, next);
});

// ============================================
// 3. API Test Suite - / (главная) и статические файлы
// ============================================
// Dynamic config.js endpoint - must be before static files
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  
  // Определяем URL gateway динамически на основе запроса
  // Это позволяет gateway работать на любом хосте/IP/домене
  // Учитываем X-Forwarded-Proto для случаев, когда перед gateway стоит reverse proxy
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  const gatewayUrl = `${protocol}://${host}`;
  
  // TENANT_API_URL используем из переменной окружения или дефолт
  // Если tenant-api на том же хосте, можно было бы определить динамически,
  // но оставляем возможность настройки через переменную окружения
  const tenantApiUrl = TENANT_API_URL;
  
  // Safely escape URLs for JavaScript
  const config = {
    TENANT_API_URL: tenantApiUrl,
    CONTROL_APP_URL: gatewayUrl,
    RABBITMQ_MANAGEMENT_URL: RABBITMQ_MANAGEMENT_URL,
    PROJECT_NAME: PROJECT_NAME,
    APP_VERSION: APP_VERSION
  };
  
  res.send(`// Конфигурация URL для разных сервисов (генерируется динамически на основе запроса)
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

// Serve static files from controlo-ui/public directory
// Path: packages/controlo-ui/src/public (using workspace structure)
// __dirname is packages/controlo-gateway/src, so we go up to packages, then to controlo-ui/src/public
const controloUiPublicPath = join(__dirname, '../../controlo-ui/src/public');
app.use(express.static(controloUiPublicPath));

// Main page - Controlo UI
app.get('/', (req, res) => {
  res.sendFile(join(controloUiPublicPath, 'api-test.html'));
});

// ============================================
// Health check endpoint
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat3 Gateway is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    endpoints: {
      apiDocs: `${CONTROL_APP_URL}/api-docs`,
      init: `${CONTROL_APP_URL}/api/init`,
      seed: `${CONTROL_APP_URL}/api/init/seed`,
      dialogEvents: `${CONTROL_APP_URL}/api/dialogs/{dialogId}/events`,
      dialogUpdates: `${CONTROL_APP_URL}/api/dialogs/{dialogId}/updates`,
      messageEvents: `${CONTROL_APP_URL}/api/messages/{messageId}/events`,
      messageUpdates: `${CONTROL_APP_URL}/api/messages/{messageId}/updates`,
      apiTest: `${CONTROL_APP_URL}`
    }
  });
});

// ============================================
// Initialize database connection and start server
// ============================================
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Chat3 Gateway is running on ${CONTROL_APP_URL}`);
      console.log(`📚 API Documentation: ${CONTROL_APP_URL}/api-docs`);
      console.log(`🧪 API Test Suite: ${CONTROL_APP_URL}`);
      console.log(`💚 Health Check: ${CONTROL_APP_URL}/health`);
      console.log(`\n🔑 Endpoints:`);
      console.log(`   POST ${CONTROL_APP_URL}/api/init - Initialize system (create tenant and API key)`);
      console.log(`   POST ${CONTROL_APP_URL}/api/init/seed - Run database seed script`);
      console.log(`   GET  ${CONTROL_APP_URL}/api/dialogs/{dialogId}/events - Get events for a dialog`);
      console.log(`   GET  ${CONTROL_APP_URL}/api/dialogs/{dialogId}/updates - Get updates for a dialog`);
      console.log(`   GET  ${CONTROL_APP_URL}/api/messages/{messageId}/events - Get events for a message`);
      console.log(`   GET  ${CONTROL_APP_URL}/api/messages/{messageId}/updates - Get updates for a message\n`);
    });
  } catch (error) {
    console.error('Failed to start Gateway server:', error);
    process.exit(1);
  }
};

startServer();

