import { setupMongoMemoryServer } from './setup.js';

export default async function globalSetup() {
  await setupMongoMemoryServer();
};

