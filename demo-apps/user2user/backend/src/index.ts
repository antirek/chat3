import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import apiRoutes from './routes/api.js';
import { setupWebSocketServer } from './routes/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// CORS middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id'],
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware - ДО API routes, чтобы видеть все запросы
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path} ${req.url}`);
  next();
});

// API routes - должны быть ПЕРЕД статикой и SPA fallback
app.use('/api', apiRoutes);


// Serve static files from frontend build
const frontendDist = join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(frontendDist, 'index.html'));
});

// WebSocket server
// Обрабатываем все WebSocket соединения, начинающиеся с /ws/updates
const wss = new WebSocketServer({ 
  server,
  // Не указываем path, обрабатываем все запросы к /ws/*
});

setupWebSocketServer(wss);

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`[User2User Backend] Server running on http://localhost:${PORT}`);
  console.log(`[User2User Backend] WebSocket server running on ws://localhost:${PORT}/ws/updates`);
  console.log(`[User2User Backend] Frontend served from: ${frontendDist}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[User2User Backend] SIGTERM received, shutting down...');
  server.close(() => {
    console.log('[User2User Backend] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[User2User Backend] SIGINT received, shutting down...');
  server.close(() => {
    console.log('[User2User Backend] Server closed');
    process.exit(0);
  });
});
