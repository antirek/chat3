import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import connectDB from '@chat3/utils/databaseUtils.js';
import initRoutes from './routes/initRoutes.js';
import eventsRoutes from './routes/eventsRoutes.js';
import dbExplorerRoutes from './routes/dbExplorerRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import swaggerSpec from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJsonPath = join(__dirname, '../../../package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

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
  origin: '*', // В production можно ограничить конкретными доменами
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id', 'x-tenant-id']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI with dynamic host
app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  // Учитываем X-Forwarded-Proto для случаев, когда перед сервером стоит reverse proxy
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
    customSiteTitle: 'Chat3 Backend API Documentation'
  })(req, res, next);
});

// ============================================
// 1. Control API Routes - /api/init, /api/dialogs, /api/messages, /api/db-explorer, /api/activity
// ============================================
app.use('/api/init', initRoutes);
app.use('/api', eventsRoutes);
app.use('/api/db-explorer', dbExplorerRoutes);
app.use('/api/activity', activityRoutes);

// ============================================
// 2. Dynamic config.js endpoint - must be before static files
// ============================================
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  
  // Определяем URL backend динамически на основе запроса
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  const backendUrl = `${protocol}://${host}`;
  
  // TENANT_API_URL используем из переменной окружения или дефолт
  const tenantApiUrl = TENANT_API_URL;
  
  // Safely escape URLs for JavaScript
  const config = {
    TENANT_API_URL: tenantApiUrl,
    CONTROL_APP_URL: backendUrl,
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

// ============================================
// 3. Serve static files from controlo-ui/dist
// ============================================
const controloUiDistPath = join(__dirname, '../../controlo-ui/dist');
if (existsSync(controloUiDistPath)) {
  app.use(express.static(controloUiDistPath));

  // Все остальные маршруты (кроме /api/*, /health, /config.js, /api-docs) отдаем index.html для SPA
  app.get('*', (req, res, next) => {
    // Пропускаем /api/*, /health, /config.js, /api-docs - они обрабатываются отдельными маршрутами
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/config.js' || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(join(controloUiDistPath, 'index.html'));
  });
} else {
  // Если dist не существует, отдаем простое сообщение
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/config.js' || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chat3 Backend</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>Chat3 Backend</h1>
          <p>Please build the UI first: <code>npm run build --workspace=@chat3/controlo-ui</code></p>
        </body>
      </html>
    `);
  });
}

// ============================================
// 4. Health check endpoint
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat3 Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: APP_VERSION,
    endpoints: {
      apiDocs: `${CONTROL_APP_URL}/api-docs`,
      init: `${CONTROL_APP_URL}/api/init`,
      seed: `${CONTROL_APP_URL}/api/init/seed`,
      recalculateStats: `${CONTROL_APP_URL}/api/init/recalculate-stats`,
      dialogEvents: `${CONTROL_APP_URL}/api/dialogs/{dialogId}/events`,
      dialogUpdates: `${CONTROL_APP_URL}/api/dialogs/{dialogId}/updates`,
      messageEvents: `${CONTROL_APP_URL}/api/messages/{messageId}/events`,
      messageUpdates: `${CONTROL_APP_URL}/api/messages/{messageId}/updates`
    }
  });
});

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Chat3 Backend is running on ${CONTROL_APP_URL}`);
      console.log(`📚 API Documentation: ${CONTROL_APP_URL}/api-docs`);
      console.log(`🌐 UI: ${CONTROL_APP_URL}`);
      console.log(`💚 Health Check: ${CONTROL_APP_URL}/health`);
      console.log(`\n🔑 API Endpoints:`);
      console.log(`   POST /api/init - Initialize system (create tenant and API key)`);
      console.log(`   POST /api/init/seed - Run database seed script`);
      console.log(`   POST /api/init/recalculate-stats - Recalculate user stats for all users`);
      console.log(`   GET  /api/dialogs/{dialogId}/events - Get events for a dialog`);
      console.log(`   GET  /api/dialogs/{dialogId}/updates - Get updates for a dialog`);
      console.log(`   GET  /api/messages/{messageId}/events - Get events for a message`);
      console.log(`   GET  /api/messages/{messageId}/updates - Get updates for a message\n`);
    });
  } catch (error) {
    console.error('Failed to start Backend server:', error);
    process.exit(1);
  }
};

startServer();
