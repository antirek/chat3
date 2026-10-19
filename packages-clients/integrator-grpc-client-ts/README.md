# @chat3/integrator-grpc-client-ts

Интеграторский TypeScript-клиент для `Chat3IntegratorService`.

```ts
import { Chat3IntegratorClient } from '@chat3/integrator-grpc-client-ts';

const client = new Chat3IntegratorClient({
  url: 'localhost:50051',
  apiKey: '...',
  tenantId: 'tnt_default'
});

await client.sendTypingIndicator({ userId: 'alice', dialogId: 'dlg_...' });

// Provisioning
await client.upsertUser({ userId: 'alice', name: 'Alice' });
const existing = await client.findDialogByMeta({
  userId: 'alice',
  metaKey: 'dmKey',
  metaValue: 'alice:bob'
});
await client.createDialog({
  userId: 'alice',
  memberUserIds: ['bob', 'carol'],
  meta: { type: 'group', title: 'Team' }
});
```

Auth в metadata (`x-api-key`, `x-tenant-id`); пользователь — в теле RPC.
