import { teardownMongoMemoryServer } from './setup.js';

export default async function globalTeardown() {
  await teardownMongoMemoryServer();
};

