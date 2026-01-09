import connectDB from '@chat3/config';
import { ApiKey } from '@chat3/models';

async function generateApiKey() {
  try {
    await connectDB();

    // Get name from command line or use default
    const name = process.argv[2] || 'Default API Key';

    // Get description from command line
    const description = process.argv[3] || '';

    // Get permissions from command line or use all
    const permissionsArg = process.argv[4];
    let permissions = ['read', 'write', 'delete'];
    if (permissionsArg) {
      permissions = permissionsArg.split(',');
    }

    // Generate key
    const key = ApiKey.generateKey();

    // Create API key in database (системный, без привязки к tenant)
    const apiKey = await ApiKey.create({
      key,
      name,
      description,
      permissions,
      isActive: true
    });

    console.log('\n✅ API Key generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Name:        ${apiKey.name}`);
    console.log(`📄 Description: ${apiKey.description || '(none)'}`);
    console.log(`🔑 API Key:     ${apiKey.key}`);
    console.log(`🔐 Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`✓  Active:      ${apiKey.isActive}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Usage examples (without tenant - uses tnt_default):\n');
    console.log('   curl -H "X-API-Key: ' + apiKey.key + '" http://localhost:3000/api/dialogs');
    console.log('   curl -H "X-API-Key: ' + apiKey.key + '" http://localhost:3000/api/tenants\n');
    console.log('💡 Usage with specific tenant:\n');
    console.log('   curl -H "X-API-Key: ' + apiKey.key + '" -H "X-TENANT-ID: tnt_demo1234" http://localhost:3000/api/dialogs\n');
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
Usage: npm run generate-key [name] [description] [permissions]

Arguments:
  name         Optional. Name for the API key. Default: "Default API Key"
  description  Optional. Description for the API key.
  permissions  Optional. Comma-separated list: read,write,delete. Default: all permissions

Note: API keys are now system-wide and not tied to a specific tenant.
      Tenant is determined by X-TENANT-ID header at request time.

Examples:
  npm run generate-key
  npm run generate-key "My API Key"
  npm run generate-key "Production Key" "Used for production API"
  npm run generate-key "Read Only Key" "Read access" read
  npm run generate-key "Full Access" "All permissions" read,write,delete
  `);
  process.exit(0);
}

generateApiKey();

