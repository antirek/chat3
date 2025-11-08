import express from 'express';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database.js';
import { admin, buildAdminRouter } from './admin/config.js';
import swaggerSpec from './config/swagger.js';
import * as rabbitmqUtils from './utils/rabbitmqUtils.js';
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

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('src/public'));

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

    // Setup AdminJS FIRST (before body-parser middleware)
    const adminRouter = buildAdminRouter(app);
    app.use(admin.options.rootPath, adminRouter);

    // Body parser middleware AFTER AdminJS
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(idempotencyGuard);

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Chat3 API Documentation'
    }));

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

    // API Test page
    app.get('/api-test', (req, res) => {
      res.sendFile('api-test.html', { root: 'src/public' });
    });

    // Quick links page for AdminJS
    app.get('/admin-links', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chat3 - Quick Links</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            h1 { color: #333; margin-bottom: 30px; }
            .links { display: flex; flex-direction: column; gap: 15px; margin-top: 30px; }
            .link-btn {
              display: block;
              padding: 20px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 12px;
              font-size: 18px;
              font-weight: 600;
              transition: transform 0.2s, box-shadow 0.2s;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }
            .link-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            .link-btn.secondary {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            }
            .link-btn.secondary:hover {
              box-shadow: 0 6px 20px rgba(245, 87, 108, 0.6);
            }
            .link-btn.info {
              background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
              box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
            }
            .link-btn.info:hover {
              box-shadow: 0 6px 20px rgba(79, 172, 254, 0.6);
            }
            .link-btn.success {
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
              box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
            }
            .link-btn.success:hover {
              box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
            }
            .info-box {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-top: 30px;
              border-left: 4px solid #667eea;
            }
            .emoji { font-size: 24px; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Chat3 - Quick Links</h1>
            <p style="color: #666; font-size: 16px;">Быстрый доступ к инструментам разработчика</p>
            
            <div class="links">
              <a href="/api-docs" target="_blank" class="link-btn">
                <span class="emoji">📚</span> Swagger UI - API Documentation
              </a>
              
              <a href="/admin" class="link-btn secondary">
                <span class="emoji">⚙️</span> AdminJS Panel
              </a>
              
              <a href="/" target="_blank" class="link-btn success">
                <span class="emoji">🧪</span> API Test Suite (Главная)
              </a>
              
              <a href="/api-test-users.html" target="_blank" class="link-btn success">
                <span class="emoji">👥</span> User API Test
              </a>
              
              <a href="/health" target="_blank" class="link-btn info">
                <span class="emoji">💚</span> Health Check
              </a>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0;">📊 API Endpoints:</h3>
              <ul style="line-height: 1.8;">
                <li><code>GET/POST/PUT/DELETE /api/users</code> - Управление пользователями</li>
                <li><code>POST /api/users/:userId/activity</code> - Обновить активность</li>
                <li><code>GET/POST/PUT/DELETE /api/tenants</code></li>
                <li><code>GET/POST/DELETE /api/dialogs</code></li>
                <li><code>GET/POST /api/dialogs/:id/messages</code></li>
                <li><code>POST /api/messages/:id/status/:userId/:status</code></li>
                <li><code>POST /api/dialogs/:id/members/:userId/add</code></li>
                <li><code>POST /api/dialogs/:id/members/:userId/remove</code></li>
                <li><code>GET /api/users/:id/dialogs?includeLastMessage=true</code></li>
                <li><code>GET/POST/DELETE /api/messages/:id/reactions</code></li>
                <li><code>GET/PUT/DELETE /api/meta/:entityType/:entityId/:key</code></li>
              </ul>
              <p style="margin-bottom: 0; color: #666; font-size: 14px;">
                💡 Все API запросы требуют заголовок <code>X-API-Key</code>
              </p>
            </div>

            <div class="info-box" style="border-left-color: #f5576c;">
              <h3 style="margin-top: 0;">🤖 Системный бот:</h3>
              <ul style="line-height: 1.8; list-style: none; padding-left: 0;">
                <li><strong>Username:</strong> system_bot</li>
                <li><strong>Email:</strong> bot@system.chat3.internal</li>
                <li><strong>Type:</strong> bot</li>
                <li><strong>Tenant:</strong> System (system.chat3.internal)</li>
              </ul>
            </div>
          </div>
        </body>
        </html>
      `);
    });

    // Main page - API Test Suite
    app.get('/', (req, res) => {
      res.sendFile('api-test.html', { root: 'src/public' });
    });

    // API health check endpoint
    app.get('/health', (req, res) => {
      const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
      const isHealthy = rabbitmqInfo.connected;
      
      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        message: isHealthy ? 'Chat3 API is running' : 'Chat3 API is running but RabbitMQ is disconnected',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {
          mongodb: 'connected',
          rabbitmq: rabbitmqInfo.connected ? 'connected' : 'disconnected'
        },
        rabbitmq: rabbitmqInfo,
        links: {
          adminPanel: `http://localhost:${PORT}${admin.options.rootPath}`,
          apiDocs: `http://localhost:${PORT}/api-docs`,
          quickLinks: `http://localhost:${PORT}/admin-links`
        },
        endpoints: {
          tenants: `http://localhost:${PORT}/api/tenants`,
          users: `http://localhost:${PORT}/api/users`,
          dialogs: `http://localhost:${PORT}/api/dialogs`,
          meta: `http://localhost:${PORT}/api/meta`
        }
      });
    });

    // Start server
    app.listen(PORT, () => {
      const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
      
      console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
      console.log(`\n🧪 Main page: http://localhost:${PORT} (API Test Suite)`);
      console.log(`📊 Admin panel: http://localhost:${PORT}${admin.options.rootPath} (без авторизации)`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔗 Quick Links: http://localhost:${PORT}/admin-links`);
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
      console.log(`   GET  /api/users/:userId/dialogs?includeLastMessage=true`);
      console.log(`\n⚠️  Don't forget to generate an API key first!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

