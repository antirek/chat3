import connectDB from '@chat3/config';
import { Tenant, ApiKey } from '@chat3/models';

async function generateDemoApiKey() {
  try {
    await connectDB();

    const demoTenant = await Tenant.findOne({ name: 'Demo Company' });
    if (!demoTenant) {
      console.error('❌ Demo Company tenant not found. Run "npm run seed" first.');
      process.exit(1);
    }

    console.log(`📋 Demo tenant: ${demoTenant.name} (${demoTenant.tenantId})`);

    // API ключ теперь системный, не привязан к tenant
    const apiKey = await ApiKey.create({
      key: ApiKey.generateKey(),
      name: 'Demo API Key',
      description: `System-wide API key. Use X-TENANT-ID: ${demoTenant.tenantId} for demo tenant`,
      permissions: ['read', 'write', 'delete'],
      isActive: true
    });

    console.log('\n✅ API Key generated successfully!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Name:        ${apiKey.name}`);
    console.log(`📄 Description: ${apiKey.description}`);
    console.log(`🔑 API Key:     ${apiKey.key}`);
    console.log(`🔐 Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`✓  Active:      ${apiKey.isActive}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n💡 Usage with default tenant (tnt_default):');
    console.log(`\n   curl -H "X-API-Key: ${apiKey.key}" http://localhost:3000/api/dialogs`);
    
    console.log('\n💡 Usage with demo tenant:');
    console.log(`\n   curl -H "X-API-Key: ${apiKey.key}" -H "X-TENANT-ID: ${demoTenant.tenantId}" http://localhost:3000/api/dialogs`);
    console.log(`   curl -H "X-API-Key: ${apiKey.key}" -H "X-TENANT-ID: ${demoTenant.tenantId}" http://localhost:3000/api/users/carl/dialogs`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating API key:', error);
    process.exit(1);
  }
}

generateDemoApiKey();
