/**
 * Backend для user2user-connectrpc демо приложения
 * Минимальный сервер - только для статической раздачи фронтенда
 * Фронтенд вызывает ConnectRPC напрямую из браузера
 */
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS middleware для браузерных запросов
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-ID', 'X-User-ID'],
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path}`);
  next();
});

// Минимальный API endpoint для конфигурации фронтенда
app.get('/api/config', (req, res) => {
  res.json({
    connectrpcServerUrl: config.connectrpcServerUrl,
    tenantId: 'tnt_default', // Можно сделать динамическим
  });
});

// Serve static files from frontend build
const frontendDist = join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(frontendDist, 'index.html'));
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[User2User ConnectRPC Backend] Server running on http://localhost:${PORT}`);
  console.log(`[User2User ConnectRPC Backend] Frontend served from: ${frontendDist}`);
  console.log(`[User2User ConnectRPC Backend] ConnectRPC Server: ${config.connectrpcServerUrl}`);
  console.log(`[User2User ConnectRPC Backend] Frontend will call ConnectRPC directly from browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[User2User ConnectRPC Backend] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[User2User ConnectRPC Backend] SIGINT received, shutting down...');
  process.exit(0);
});
