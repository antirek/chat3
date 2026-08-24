import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';

function withUniqueDb(mongoUri, dbName) {
  // mongodb://host:27017[/db][?opts] → mongodb://host:27017/<dbName>[?opts]
  return mongoUri.replace(
    /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/,
    `$1/${dbName}$2`
  );
}

/**
 * Prefer MongoMemoryServer; when CHAT3_TEST_MONGO_URI is set (e.g. Alpine hosts
 * without a runnable glibc mongod), use an external MongoDB with a unique DB.
 *
 * @returns {Promise<{ getUri: () => string, stop: () => Promise<void> }>}
 */
export async function createTestMongoServer() {
  const external = process.env.CHAT3_TEST_MONGO_URI;
  if (external) {
    const dbName = `chat3_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const uri = withUniqueDb(external, dbName);
    return {
      getUri: () => uri,
      stop: async () => {
        if (mongoose.connection.readyState !== 0) {
          try {
            await mongoose.connection.dropDatabase();
          } catch {
            // ignore drop errors on teardown
          }
        }
      }
    };
  }

  return MongoMemoryServer.create();
}
