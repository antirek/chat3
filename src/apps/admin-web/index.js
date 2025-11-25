import express from 'express';
import connectDB from '../../config/database.js';
import { admin, buildAdminRouter } from './admin/config.js';

const app = express();
const PORT = process.env.ADMIN_WEB_PORT || 3001;

// Setup AdminJS FIRST (before body-parser middleware)
const adminRouter = buildAdminRouter(app);
app.use(admin.options.rootPath, adminRouter);

// Body parser middleware AFTER AdminJS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
          <a href="http://localhost:${process.env.TENANT_API_PORT || 3000}/api-docs" target="_blank" class="link-btn">
            <span class="emoji">📚</span> Swagger UI - API Documentation
          </a>
          
          <a href="/admin" class="link-btn secondary">
            <span class="emoji">⚙️</span> AdminJS Panel
          </a>
          
          <a href="http://localhost:${process.env.API_TEST_PORT || 3003}" target="_blank" class="link-btn success">
            <span class="emoji">🧪</span> API Test Suite
          </a>
          
          <a href="http://localhost:${process.env.TENANT_API_PORT || 3000}/health" target="_blank" class="link-btn info">
            <span class="emoji">💚</span> Health Check
          </a>
        </div>

        <div class="info-box">
          <h3 style="margin-top: 0;">📊 Services:</h3>
          <ul style="line-height: 1.8;">
            <li><strong>Tenant API:</strong> http://localhost:${process.env.TENANT_API_PORT || 3000}</li>
            <li><strong>Admin Web:</strong> http://localhost:${PORT}</li>
            <li><strong>Control API:</strong> http://localhost:${process.env.CONTROL_API_PORT || 3002}</li>
            <li><strong>API Test:</strong> http://localhost:${process.env.API_TEST_PORT || 3003}</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n📊 Admin Web is running on http://localhost:${PORT}`);
      console.log(`⚙️  AdminJS Panel: http://localhost:${PORT}${admin.options.rootPath} (без авторизации)`);
      console.log(`🔗 Quick Links: http://localhost:${PORT}/admin-links\n`);
    });
  } catch (error) {
    console.error('Failed to start Admin Web server:', error);
    process.exit(1);
  }
};

startServer();

