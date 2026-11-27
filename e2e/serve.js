import mongoose from 'mongoose';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
import { connect, User } from '../server/models.js';
import { seedCatalog } from '../server/scripts/seed.js';

export default async function setup() {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await connect(database.getUri('folio_e2e'));
    const result = await seedCatalog();
    if (result.invalid || result.imported !== 193) throw new Error(JSON.stringify(result));
    await User.create({ name: 'Folio Tester', email: 'admin@example.test',
      passwordHash: await hashPassword('e2e-password-only'), role: 'admin' });
    const server = createApp({ publicOrigin: 'http://localhost:4175', authLimit: 100 }).listen(4175, '127.0.0.1');
    await once(server, 'listening');
    console.log('Folio browser test server ready. Imported', result.imported, 'books.');
    return async () => {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await mongoose.disconnect();
      await database.stop();
    };
  } catch (error) {
    await mongoose.disconnect();
    await database.stop();
    throw error;
  }
}
