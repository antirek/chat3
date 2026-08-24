import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';

let mongoServer;

function withUniqueDb(mongoUri, dbName) {
  return mongoUri.replace(
    /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/,
    `$1/${dbName}$2`
  );
}

/**
 * Setup in-memory MongoDB before all tests.
 * When CHAT3_TEST_MONGO_URI is set, use external MongoDB (Alpine / no glibc mongod).
 */
export async function setupMongoMemoryServer() {
  const external = process.env.CHAT3_TEST_MONGO_URI;
  if (external) {
    const dbName = `chat3_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const mongoUri = withUniqueDb(external, dbName);
    await mongoose.connect(mongoUri);
    mongoServer = {
      getUri: () => mongoUri,
      stop: async () => {}
    };
    return mongoUri;
  }

  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
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

