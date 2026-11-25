import { mkdir } from 'node:fs/promises';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { root } from '../config.js';

const directory = root + '.local/mongo';
await mkdir(directory, { recursive: true });
const database = await MongoMemoryReplSet.create({
  instanceOpts: [{ port: 27018, dbPath: directory }],
  replSet: { name: 'folio', count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
});
console.log('Development MongoDB: ' + database.getUri('folio'));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await database.stop({ doCleanup: false }); });
}
