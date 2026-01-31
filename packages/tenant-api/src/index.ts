import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import connectDB from '@chat3/utils/databaseUtils.js';
import swaggerSpec from './config/swagger.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dialogRoutes from './routes/dialogRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import messageInfoRoutes from './routes/messageInfoRoutes.js';
import dialogMemberRoutes from './routes/dialogMemberRoutes.js';
import userDialogRoutes from './routes/userDialogRoutes.js';
import metaRoutes from './routes/metaRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import topicListRoutes from './routes/topicListRoutes.js';
import idempotencyGuard from './middleware/idempotencyGuard.js';
import { apiJournalMiddleware } from './middleware/apiJournal.js';

const app = express();

// Trust proxy для правильной работы с reverse proxy (nginx)
// Это позволяет Express правильно определять req.protocol и req.ip
app.set('trust proxy', true);

// Get URLs from environment variables or use defaults
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';

// Extract port from URL for server listening
const PORT = new URL(TENANT_API_URL).port || 3000;

// CORS middleware - разрешаем запросы с разных источников
app.use(cors({
  origin: '*', // В production можно ограничить конкретными доменами
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
    customSiteTitle: 'Chat3 Tenant API Documentation'
  })(req, res, next);
});

// API Routes
// Важно: более специфичные роуты должны регистрироваться раньше общих
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userDialogRoutes); // Сначала специфичные роуты с /dialogs
app.use('/api/users', userRoutes); // Затем общие роуты с /:userId
app.use('/api/dialogs', dialogRoutes);
app.use('/api/dialogs', messageRoutes);
app.use('/api/messages', messageInfoRoutes);
app.use('/api/dialogs', dialogMemberRoutes);
app.use('/api/dialogs', topicRoutes);
app.use('/api/topics', topicListRoutes);
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
      tenants: `${TENANT_API_URL}/api/tenants`,
      users: `${TENANT_API_URL}/api/users`,
      dialogs: `${TENANT_API_URL}/api/dialogs`,
      meta: `${TENANT_API_URL}/api/meta`
    }
  });
});

// Initialize database connection
const startServer = async (): Promise<void> => {
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
      
      console.log(`\n🚀 Tenant API is running on ${TENANT_API_URL}`);
      console.log(`📚 API Documentation: ${TENANT_API_URL}/api-docs`);
      console.log(`💚 Health Check: ${TENANT_API_URL}/health`);
      console.log(`\n📡 Services Status:`);
      console.log(`   MongoDB: ✅ Connected`);
      console.log(`   RabbitMQ: ${rabbitmqInfo.connected ? '✅ Connected' : '❌ Disconnected'} (${rabbitmqInfo.exchange})`);
      console.log(`\n🔑 API Endpoints:`);
      console.log(`   POST /api/dialogs`);
      console.log(`   GET  /api/dialogs`);
      console.log(`   GET  /api/dialogs/:id/messages`);
      console.log(`   POST /api/dialogs/:id/messages`);
      console.log(`   POST /api/dialogs/:id/members/:userId/add`);
      console.log(`   POST /api/dialogs/:id/members/:userId/remove`);
      console.log(`   PATCH /api/dialogs/:id/members/:userId/unread`);
      console.log(`   GET  /api/users/:userId/dialogs?includeLastMessage=true`);
      console.log(`\n⚠️  Don't forget to generate an API key first!\n`);
    });
  } catch (error: any) {
    console.error('Failed to start Tenant API server:', error);
    process.exit(1);
  }
};

startServer();
