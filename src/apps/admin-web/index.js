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

// Initialize database connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n📊 Admin Web is running on http://localhost:${PORT}`);
      console.log(`⚙️  AdminJS Panel: http://localhost:${PORT}${admin.options.rootPath} (без авторизации)\n`);
    });
  } catch (error) {
    console.error('Failed to start Admin Web server:', error);
    process.exit(1);
  }
};

startServer();

