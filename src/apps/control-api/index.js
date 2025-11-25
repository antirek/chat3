import express from 'express';
import connectDB from '../../config/database.js';
import initRoutes from './routes/initRoutes.js';

const app = express();
const PORT = process.env.CONTROL_API_PORT || 3002;

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Control API Routes (no authentication required for now)
app.use('/api/init', initRoutes);

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
      seed: `http://localhost:${PORT}/api/init/seed`
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
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔑 Endpoints:`);
      console.log(`   POST /api/init - Initialize system (create tenant and API key)`);
      console.log(`   POST /api/init/seed - Run database seed script\n`);
    });
  } catch (error) {
    console.error('Failed to start Control API server:', error);
    process.exit(1);
  }
};

startServer();

