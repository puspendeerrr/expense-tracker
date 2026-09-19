import { MongoClient, type Collection, type Db, type Document } from 'mongodb';
import { logger } from '../utils/logger.js';

/**
 * Read-only access to the legacy MongoDB Atlas database.
 *
 * The source is the live production system and MUST NOT be modified. Rather than relying
 * on care alone, every collection is wrapped in a Proxy that throws if any mutating
 * driver method is even touched. A typo like `insertOne` fails immediately and loudly
 * instead of writing to production.
 */

const FORBIDDEN_METHODS = new Set([
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'bulkWrite',
  'drop',
  'dropIndex',
  'dropIndexes',
  'createIndex',
  'createIndexes',
  'rename',
  'insert',
  'update',
  'remove',
  'save',
  'initializeOrderedBulkOp',
  'initializeUnorderedBulkOp',
]);

export class ReadOnlyViolationError extends Error {
  constructor(method: string) {
    super(
      `Refusing to call "${method}" on the source database. ` +
        'The MongoDB source is read-only: this migration copies data out and never writes to it.',
    );
    this.name = 'ReadOnlyViolationError';
  }
}

const readOnlyCollection = <T extends Document>(collection: Collection<T>): Collection<T> =>
  new Proxy(collection, {
    get(target, property, receiver) {
      if (typeof property === 'string' && FORBIDDEN_METHODS.has(property)) {
        throw new ReadOnlyViolationError(property);
      }
      return Reflect.get(target, property, receiver);
    },
  });

export interface MongoSource {
  db: Db;
  collection: <T extends Document = Document>(name: string) => Collection<T>;
  close: () => Promise<void>;
}

/**
 * Connects to the source.
 *
 * `readPreference: secondaryPreferred` also keeps the load off the primary that the live
 * application is serving from.
 */
export const connectMongoSource = async (uri: string): Promise<MongoSource> => {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30_000,
    readPreference: 'secondaryPreferred',
    // Belt and braces: a retryable-writes session is never needed for reads.
    retryWrites: false,
  });

  await client.connect();
  const db = client.db();

  logger.info('migration.source_connected', { database: db.databaseName });

  return {
    db,
    collection: <T extends Document = Document>(name: string) =>
      readOnlyCollection(db.collection<T>(name)) as Collection<T>,
    close: () => client.close(),
  };
};
