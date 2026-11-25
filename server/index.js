import mongoose from 'mongoose';
import { access } from 'node:fs/promises';
import { once } from 'node:events';
import { config, root, validateStartup } from './config.js';
import { connect } from './models.js';
import { createApp } from './app.js';

let stage = 'configuration';
try {
  validateStartup(config);
  if (config.production) await access(root + 'client/dist/index.html');
  stage = 'database connection';
  await connect(config.mongoUri);
  stage = 'HTTP listener';
  const server = createApp(config).listen(config.port, config.host);
  await once(server, 'listening');
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  console.log('Folio API listening on http://' + config.host + ':' + config.port);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => {
      await mongoose.disconnect();
      process.exitCode = 0;
    }));
  }
} catch (error) {
  console.error('Could not start Folio during ' + stage + '.',
    stage === 'configuration' ? (error.code === 'ENOENT' ? 'Run npm run build before starting.' : error.message)
      : 'Check the service configuration and availability.');
  await mongoose.disconnect();
  process.exitCode = 1;
}
