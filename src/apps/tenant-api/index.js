import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import connectDB from '../../config/database.js';
import swaggerSpec from './config/swagger.js';
import * as rabbitmqUtils from '../../utils/rabbitmqUtils.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dialogRoutes from './routes/dialogRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import messageStatusRoutes from './routes/messageStatusRoutes.js';
import messageInfoRoutes from './routes/messageInfoRoutes.js';
import messageReactionRoutes from './routes/messageReactionRoutes.js';
import dialogMemberRoutes from './routes/dialogMemberRoutes.js';
import userDialogRoutes from './routes/userDialogRoutes.js';
import metaRoutes from './routes/metaRoutes.js';
import idempotencyGuard from './middleware/idempotencyGuard.js';
import { apiJournalMiddleware } from './middleware/apiJournal.js';

const app = express();
const PORT = process.env.TENANT_API_PORT || 3000;

// CORS middleware - разрешаем запросы с api-test и других источников
app.use(cors({
  origin: [
    `http://localhost:${process.env.API_TEST_PORT || 3003}`,
    `http://localhost:${process.env.ADMIN_WEB_PORT || 3001}`,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key', 'X-Tenant-Id', 'x-tenant-id']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Journal middleware - логирование всех API запросов
app.use(apiJournalMiddleware);

app.use(idempotencyGuard);

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
    customSiteTitle: 'Chat3 Tenant API Documentation'
  })(req, res, next);
});

// API Routes
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dialogs', dialogRoutes);
app.use('/api/dialogs', messageRoutes);
app.use('/api/messages', messageInfoRoutes);
app.use('/api/messages', messageStatusRoutes);
app.use('/api/messages', messageReactionRoutes);
app.use('/api/dialogs', dialogMemberRoutes);
app.use('/api/users', userDialogRoutes);
app.use('/api/meta', metaRoutes);

// API health check endpoint
app.get('/health', (req, res) => {
  const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
  const isHealthy = rabbitmqInfo.connected;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    message: isHealthy ? 'Chat3 Tenant API is running' : 'Chat3 Tenant API is running but RabbitMQ is disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      mongodb: 'connected',
      rabbitmq: rabbitmqInfo.connected ? 'connected' : 'disconnected'
    },
    rabbitmq: rabbitmqInfo,
    endpoints: {
      tenants: `http://localhost:${PORT}/api/tenants`,
      users: `http://localhost:${PORT}/api/users`,
      dialogs: `http://localhost:${PORT}/api/dialogs`,
      meta: `http://localhost:${PORT}/api/meta`
    }
  });
});

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize RabbitMQ (REQUIRED - server will not start without it)
    console.log('🐰 Initializing RabbitMQ connection...');
    const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    
    if (!rabbitmqConnected) {
      console.error('❌ CRITICAL ERROR: Failed to connect to RabbitMQ');
      console.error('❌ RabbitMQ is a required dependency for Chat3');
      console.error('');
      console.error('Please ensure:');
      console.error('  1. RabbitMQ is running (docker-compose up -d rabbitmq)');
      console.error('  2. Connection settings are correct:');
      console.error('     RABBITMQ_URL=' + (process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/'));
      console.error('');
      console.error('Server startup aborted.');
      process.exit(1);
    }
    
    console.log('✅ RabbitMQ connection established successfully');

    // Start server
    app.listen(PORT, () => {
      const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
      
      console.log(`\n🚀 Tenant API is running on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`\n📡 Services Status:`);
      console.log(`   MongoDB: ✅ Connected`);
      console.log(`   RabbitMQ: ${rabbitmqInfo.connected ? '✅ Connected' : '❌ Disconnected'} (${rabbitmqInfo.exchange})`);
      console.log(`\n🔑 API Endpoints:`);
      console.log(`   POST /api/dialogs`);
      console.log(`   GET  /api/dialogs`);
      console.log(`   GET  /api/dialogs/:id/messages`);
      console.log(`   POST /api/dialogs/:id/messages`);
      console.log(`   POST /api/messages/:id/status/:userId/:status`);
      console.log(`   POST /api/dialogs/:id/members/:userId/add`);
      console.log(`   POST /api/dialogs/:id/members/:userId/remove`);
      console.log(`   PATCH /api/dialogs/:id/members/:userId/unread`);
      console.log(`   GET  /api/users/:userId/dialogs?includeLastMessage=true`);
      console.log(`\n⚠️  Don't forget to generate an API key first!\n`);
    });
  } catch (error) {
    console.error('Failed to start Tenant API server:', error);
    process.exit(1);
  }
};

startServer();

