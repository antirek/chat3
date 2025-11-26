import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Get URLs from environment variables or use defaults
const API_TEST_URL = process.env.API_TEST_URL || 'http://localhost:3003';
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const CONTROL_API_URL = process.env.CONTROL_API_URL || 'http://localhost:3002';
const ADMIN_WEB_URL = process.env.ADMIN_WEB_URL || 'http://localhost:3001';

// Extract port from URL for server listening
const PORT = new URL(API_TEST_URL).port || 3003;

// Dynamic config.js endpoint - must be before static files
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  
  // Safely escape URLs for JavaScript
  const config = {
    TENANT_API_URL: TENANT_API_URL,
    ADMIN_WEB_URL: ADMIN_WEB_URL,
    CONTROL_API_URL: CONTROL_API_URL,
    API_TEST_URL: API_TEST_URL
  };
  
  res.send(`// Конфигурация URL для разных сервисов (генерируется динамически из process.env)
window.CHAT3_CONFIG = {
    TENANT_API_URL: ${JSON.stringify(config.TENANT_API_URL)},
    ADMIN_WEB_URL: ${JSON.stringify(config.ADMIN_WEB_URL)},
    CONTROL_API_URL: ${JSON.stringify(config.CONTROL_API_URL)},
    API_TEST_URL: ${JSON.stringify(config.API_TEST_URL)},
    
    getTenantApiUrl: function(path = '') {
        return this.TENANT_API_URL + path;
    },
    
    getControlApiUrl: function(path = '') {
        return this.CONTROL_API_URL + path;
    },
    
    getAdminWebUrl: function(path = '') {
        return this.ADMIN_WEB_URL + path;
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
  console.log(`\n🧪 API Test is running on ${API_TEST_URL}`);
  console.log(`📄 Main page: ${API_TEST_URL} (API Test Suite)`);
  console.log(`\n💡 Configure API endpoints in api-test.html:`);
  console.log(`   Tenant API: ${TENANT_API_URL}`);
  console.log(`   Control API: ${CONTROL_API_URL}`);
  console.log(`   Admin Web: ${ADMIN_WEB_URL}\n`);
});

