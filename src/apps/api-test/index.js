import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.API_TEST_PORT || 3003;

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Main page - API Test Suite
app.get('/', (req, res) => {
  res.sendFile('api-test.html', { root: join(__dirname, 'public') });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🧪 API Test is running on http://localhost:${PORT}`);
  console.log(`📄 Main page: http://localhost:${PORT} (API Test Suite)`);
  console.log(`\n💡 Configure API endpoints in api-test.html:`);
  console.log(`   Tenant API: http://localhost:${process.env.TENANT_API_PORT || 3000}`);
  console.log(`   Control API: http://localhost:${process.env.CONTROL_API_PORT || 3002}\n`);
});

