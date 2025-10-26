import connectDB from '../config/database.js';
import { Tenant, ApiKey } from '../models/index.js';

async function generateDemoApiKey() {
  try {
    await connectDB();

    const demoTenant = await Tenant.findOne({ name: 'Demo Company' });
    if (!demoTenant) {
      console.error('❌ Demo Company tenant not found');
      process.exit(1);
    }

    console.log(`📋 Using tenant: ${demoTenant.name} (${demoTenant.domain})`);

    const apiKey = await ApiKey.create({
      key: ApiKey.generateKey(),
      name: 'Demo API Key',
      tenantId: demoTenant._id,
      permissions: ['read', 'write', 'delete'],
      isActive: true
    });

    console.log('\n✅ API Key generated successfully!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Name:        ${apiKey.name}`);
    console.log(`🔑 API Key:     ${apiKey.key}`);
    console.log(`🏢 Tenant ID:   ${apiKey.tenantId}`);
    console.log(`🔐 Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`✓  Active:      ${apiKey.isActive}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n💡 Usage examples:');
    console.log(`\n   curl -H "X-API-Key: ${apiKey.key}" http://localhost:3000/api/dialogs`);
    console.log(`   curl -H "X-API-Key: ${apiKey.key}" http://localhost:3000/api/users/carl/dialogs`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating API key:', error);
    process.exit(1);
  }
}

generateDemoApiKey();
