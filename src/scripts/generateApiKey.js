import connectDB from '../config/database.js';
import { ApiKey, Tenant } from '../models/index.js';

async function generateApiKey() {
  try {
    await connectDB();

    // Get tenant ID from command line or use first tenant
    let tenantId = process.argv[2];

    if (!tenantId) {
      const tenant = await Tenant.findOne();
      if (!tenant) {
        console.error('❌ No tenants found. Please create a tenant first.');
        process.exit(1);
      }
      tenantId = tenant._id;
      console.log(`📋 Using tenant: ${tenant.name} (${tenant.domain})`);
    }

    // Get name from command line or use default
    const name = process.argv[3] || 'Default API Key';

    // Get permissions from command line or use all
    const permissionsArg = process.argv[4];
    let permissions = ['read', 'write', 'delete'];
    if (permissionsArg) {
      permissions = permissionsArg.split(',');
    }

    // Generate key
    const key = ApiKey.generateKey();

    // Create API key in database
    const apiKey = await ApiKey.create({
      key,
      name,
      tenantId,
      permissions,
      isActive: true
    });

    console.log('\n✅ API Key generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Name:        ${apiKey.name}`);
    console.log(`🔑 API Key:     ${apiKey.key}`);
    console.log(`🏢 Tenant ID:   ${apiKey.tenantId}`);
    console.log(`🔐 Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`✓  Active:      ${apiKey.isActive}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Usage examples:\n');
    console.log('   curl -H "X-API-Key: ' + apiKey.key + '" http://localhost:3000/api/users');
    console.log('   curl -H "X-API-Key: ' + apiKey.key + '" http://localhost:3000/api/tenants\n');
    console.log('📚 Try it in Swagger: http://localhost:3000/api-docs\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating API key:', error);
    process.exit(1);
  }
}

// Usage info
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run generate-api-key [tenantId] [name] [permissions]

Arguments:
  tenantId     Optional. MongoDB ObjectId of the tenant. Uses first tenant if not specified.
  name         Optional. Name for the API key. Default: "Default API Key"
  permissions  Optional. Comma-separated list: read,write,delete. Default: all permissions

Examples:
  npm run generate-api-key
  npm run generate-api-key 507f1f77bcf86cd799439011
  npm run generate-api-key 507f1f77bcf86cd799439011 "My API Key"
  npm run generate-api-key 507f1f77bcf86cd799439011 "Read Only Key" read
  npm run generate-api-key 507f1f77bcf86cd799439011 "Full Access" read,write,delete
  `);
  process.exit(0);
}

generateApiKey();

