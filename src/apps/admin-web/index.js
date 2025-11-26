import express from 'express';
import connectDB from '../../config/database.js';
import { admin, buildAdminRouter } from './admin/config.js';

const app = express();

// Get URL from environment variable or use default
const ADMIN_WEB_URL = process.env.ADMIN_WEB_URL || 'http://localhost:3001';

// Extract port from URL for server listening
const PORT = new URL(ADMIN_WEB_URL).port || 3001;

// Setup AdminJS FIRST (before body-parser middleware)
const adminRouter = buildAdminRouter(app);
app.use(admin.options.rootPath, adminRouter);

// Body parser middleware AFTER AdminJS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n📊 Admin Web is running on ${ADMIN_WEB_URL}`);
      console.log(`⚙️  AdminJS Panel: ${ADMIN_WEB_URL}${admin.options.rootPath} (без авторизации)\n`);
    });
  } catch (error) {
    console.error('Failed to start Admin Web server:', error);
    process.exit(1);
  }
};

startServer();

