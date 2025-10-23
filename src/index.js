import express from 'express';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database.js';
import { admin, buildAdminRouter } from './admin/config.js';
import swaggerSpec from './config/swagger.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dialogRoutes from './routes/dialogRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Setup AdminJS FIRST (before body-parser middleware)
    const adminRouter = buildAdminRouter(app);
    app.use(admin.options.rootPath, adminRouter);

    // Body parser middleware AFTER AdminJS
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Chat3 API Documentation'
    }));

    // API Routes
    app.use('/api/tenants', tenantRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/dialogs', dialogRoutes);

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
              
              <a href="/" target="_blank" class="link-btn info">
                <span class="emoji">🏠</span> API Root (Health Check)
              </a>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0;">📊 API Endpoints:</h3>
              <ul style="line-height: 1.8;">
                <li><code>GET/POST/PUT/DELETE /api/tenants</code></li>
                <li><code>GET/POST/PUT/DELETE /api/users</code></li>
                <li><code>GET/POST/DELETE /api/dialogs</code></li>
                <li><code>POST /api/dialogs/:id/participants</code></li>
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

    // Basic health check endpoint
    app.get('/', (req, res) => {
      res.json({
        message: 'Chat3 API is running',
        adminPanel: `http://localhost:${PORT}${admin.options.rootPath}`,
        apiDocs: `http://localhost:${PORT}/api-docs`,
        quickLinks: `http://localhost:${PORT}/admin-links`,
        endpoints: {
          tenants: `http://localhost:${PORT}/api/tenants`,
          users: `http://localhost:${PORT}/api/users`,
          dialogs: `http://localhost:${PORT}/api/dialogs`
        }
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📊 Admin panel: http://localhost:${PORT}${admin.options.rootPath} (без авторизации)`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔗 Quick Links: http://localhost:${PORT}/admin-links`);
      console.log(`\n🔑 API Endpoints:`);
      console.log(`   POST /api/tenants`);
      console.log(`   GET  /api/tenants`);
      console.log(`   POST /api/users`);
      console.log(`   GET  /api/users`);
      console.log(`   POST /api/dialogs`);
      console.log(`   GET  /api/dialogs`);
      console.log(`\n⚠️  Don't forget to generate an API key first!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

