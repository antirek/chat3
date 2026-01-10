import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import connectDB from '@chat3/utils/databaseUtils.js';
import initRoutes from './routes/initRoutes.js';
import eventsRoutes from './routes/eventsRoutes.js';
import dbExplorerRoutes from './routes/dbExplorerRoutes.js';
import swaggerSpec from './config/swagger.js';

const app = express();

// Trust proxy для правильной работы с reverse proxy (nginx)
// Это позволяет Express правильно определять req.protocol и req.ip
app.set('trust proxy', true);

// Get URLs from environment variables or use defaults
const CONTROL_APP_URL = process.env.CONTROL_APP_URL || 'http://localhost:3002';

// Extract port from URL for server listening
const PORT = new URL(CONTROL_APP_URL).port || 3002;

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
      console.log(`\n🔧 Control API is running on ${CONTROL_APP_URL}`);
      console.log(`📚 API Documentation: ${CONTROL_APP_URL}/api-docs`);
      console.log(`💚 Health Check: ${CONTROL_APP_URL}/health`);
      console.log(`🔑 Endpoints:`);
      console.log(`   POST /api/init - Initialize system (create tenant and API key)`);
      console.log(`   POST /api/init/seed - Run database seed script`);
      console.log(`   POST /api/init/recalculate-stats - Recalculate user stats for all users`);
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
