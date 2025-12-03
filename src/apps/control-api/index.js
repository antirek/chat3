import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import connectDB from '../../config/database.js';
import initRoutes from './routes/initRoutes.js';
import eventsRoutes from './routes/eventsRoutes.js';
import dbExplorerRoutes from './routes/dbExplorerRoutes.js';
import swaggerSpec from './config/swagger.js';

const app = express();

// Trust proxy для правильной работы с reverse proxy (nginx)
// Это позволяет Express правильно определять req.protocol и req.ip
app.set('trust proxy', true);

// Get URLs from environment variables or use defaults
const CONTROL_API_URL = process.env.CONTROL_API_URL || 'http://localhost:3002';
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const ADMIN_WEB_URL = process.env.ADMIN_WEB_URL || 'http://localhost:3001';
const API_TEST_URL = process.env.API_TEST_URL || 'http://localhost:3003';

// Extract port from URL for server listening
const PORT = new URL(CONTROL_API_URL).port || 3002;

// CORS middleware - разрешаем запросы с api-test
app.use(cors({
  origin: [
    API_TEST_URL,
    TENANT_API_URL,
    ADMIN_WEB_URL,
    CONTROL_API_URL
  ],
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
    customSiteTitle: 'Chat3 Control API Documentation'
  })(req, res, next);
});

// Control API Routes (no authentication required for now)
app.use('/api/init', initRoutes);
app.use('/api', eventsRoutes);
app.use('/api/db-explorer', dbExplorerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat3 Control API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    endpoints: {
      init: `${CONTROL_API_URL}/api/init`,
      seed: `${CONTROL_API_URL}/api/init/seed`,
      dialogEvents: `${CONTROL_API_URL}/api/dialogs/{dialogId}/events`,
      dialogUpdates: `${CONTROL_API_URL}/api/dialogs/{dialogId}/updates`,
      messageEvents: `${CONTROL_API_URL}/api/messages/{messageId}/events`,
      messageUpdates: `${CONTROL_API_URL}/api/messages/{messageId}/updates`
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
      console.log(`\n🔧 Control API is running on ${CONTROL_API_URL}`);
      console.log(`📚 API Documentation: ${CONTROL_API_URL}/api-docs`);
      console.log(`💚 Health Check: ${CONTROL_API_URL}/health`);
      console.log(`🔑 Endpoints:`);
      console.log(`   POST /api/init - Initialize system (create tenant and API key)`);
      console.log(`   POST /api/init/seed - Run database seed script`);
      console.log(`   GET  /api/dialogs/{dialogId}/events - Get events for a dialog`);
      console.log(`   GET  /api/dialogs/{dialogId}/updates - Get updates for a dialog`);
      console.log(`   GET  /api/messages/{messageId}/events - Get events for a message`);
      console.log(`   GET  /api/messages/{messageId}/updates - Get updates for a message\n`);
    });
  } catch (error) {
    console.error('Failed to start Control API server:', error);
    process.exit(1);
  }
};

startServer();

