import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import connectDB from '../../config/database.js';
import initRoutes from './routes/initRoutes.js';
import eventsRoutes from './routes/eventsRoutes.js';
import swaggerSpec from './config/swagger.js';

const app = express();
const PORT = process.env.CONTROL_API_PORT || 3002;

// CORS middleware - разрешаем запросы с api-test
app.use(cors({
  origin: [
    `http://localhost:${process.env.API_TEST_PORT || 3003}`,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
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
  const protocol = req.protocol;
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat3 Control API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    endpoints: {
      init: `http://localhost:${PORT}/api/init`,
      seed: `http://localhost:${PORT}/api/init/seed`,
      dialogEvents: `http://localhost:${PORT}/api/dialogs/{dialogId}/events`,
      dialogUpdates: `http://localhost:${PORT}/api/dialogs/{dialogId}/updates`,
      messageEvents: `http://localhost:${PORT}/api/messages/{messageId}/events`,
      messageUpdates: `http://localhost:${PORT}/api/messages/{messageId}/updates`
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
      console.log(`\n🔧 Control API is running on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
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

