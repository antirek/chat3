import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

/**
 * Setup in-memory MongoDB before all tests
 */
export async function setupMongoMemoryServer() {
  // Create an in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect mongoose to the in-memory database
  await mongoose.connect(mongoUri);
  
  return mongoUri;
}

/**
 * Close database connection and stop MongoDB instance after all tests
 */
export async function teardownMongoMemoryServer() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Clear all collections in the database
 */
export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export default {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
};

