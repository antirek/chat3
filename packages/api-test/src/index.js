import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from '../../../package.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Get URLs from environment variables or use defaults
const CONTROL_APP_URL = process.env.CONTROL_APP_URL || 'http://localhost:3003';
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';
const PROJECT_NAME = process.env.MMS3_PROJECT_NAME || 'chat3';
const APP_VERSION = pkg.version || '0.0.0';

// Extract port from URL for server listening
const PORT = new URL(CONTROL_APP_URL).port || 3003;

// Dynamic config.js endpoint - must be before static files
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  
  // Safely escape URLs for JavaScript
  const config = {
    TENANT_API_URL: TENANT_API_URL,
    CONTROL_APP_URL: CONTROL_APP_URL,
    RABBITMQ_MANAGEMENT_URL: RABBITMQ_MANAGEMENT_URL,
    PROJECT_NAME: PROJECT_NAME,
    APP_VERSION: APP_VERSION
  };
  
  res.send(`// Конфигурация URL для разных сервисов (генерируется динамически из process.env)
window.CHAT3_CONFIG = {
    TENANT_API_URL: ${JSON.stringify(config.TENANT_API_URL)},
    CONTROL_APP_URL: ${JSON.stringify(config.CONTROL_APP_URL)},
    RABBITMQ_MANAGEMENT_URL: ${JSON.stringify(config.RABBITMQ_MANAGEMENT_URL)},
    PROJECT_NAME: ${JSON.stringify(config.PROJECT_NAME)},
    APP_VERSION: ${JSON.stringify(config.APP_VERSION)},
    
    getTenantApiUrl: function(path = '') {
        return this.TENANT_API_URL + path;
    },
    
    getControlApiUrl: function(path = '') {
        return this.CONTROL_APP_URL + path;
    }
};`);
});

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Main page - API Test Suite
app.get('/', (req, res) => {
  res.sendFile('api-test.html', { root: join(__dirname, 'public') });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🧪 API Test is running on ${CONTROL_APP_URL}`);
  console.log(`📄 Main page: ${CONTROL_APP_URL} (API Test Suite)`);
  console.log(`\n💡 Configure API endpoints in api-test.html:`);
  console.log(`   Tenant API: ${TENANT_API_URL}`);
  console.log(`   Control App: ${CONTROL_APP_URL}\n`);
});

