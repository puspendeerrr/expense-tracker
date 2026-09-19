import 'dotenv/config';
import { connectMongoSource, ReadOnlyViolationError } from '../src/migration/mongoSource.js';

/** Proves the read-only proxy blocks mutating driver methods on the live source. */
const run = async (): Promise<void> => {
  const uri = process.env.SOURCE_MONGODB_URI;
  if (!uri) throw new Error('SOURCE_MONGODB_URI not set');

  const source = await connectMongoSource(uri);
  const collection = source.collection('groups');

  const blocked: string[] = [];
  const leaked: string[] = [];

  for (const method of [
    'insertOne',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'findOneAndUpdate',
    'bulkWrite',
    'drop',
    'replaceOne',
  ]) {
    try {
      // Merely touching the property must throw; it is never invoked.
      void (collection as unknown as Record<string, unknown>)[method];
      leaked.push(method);
    } catch (error) {
      if (error instanceof ReadOnlyViolationError) blocked.push(method);
      else leaked.push(method);
    }
  }

  // Reads must still work.
  const count = await collection.countDocuments({});

  console.log(`blocked write methods : ${blocked.length}/9`);
  console.log(`leaked                : ${leaked.length ? leaked.join(', ') : 'none'}`);
  console.log(`reads still work      : ${count > 0 ? 'yes' : 'no'} (${count} groups)`);

  await source.close();
  process.exit(leaked.length === 0 && count > 0 ? 0 : 1);
};

void run();
