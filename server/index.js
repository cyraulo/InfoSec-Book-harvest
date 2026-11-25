import mongoose from 'mongoose';
import { config } from './config.js';
import { connect } from './models.js';
import { createApp } from './app.js';

if (config.production && !config.secure) {
  console.warn('Secure cookies are disabled. Use this setting only for a localhost production build preview.');
}
try {
  await connect(config.mongoUri);
  const server = createApp(config).listen(config.port, config.host, () =>
    console.log('Folio API listening on http://' + config.host + ':' + config.port));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => {
      await mongoose.disconnect();
      process.exitCode = 0;
    }));
  }
} catch (error) {
  console.error('Could not start Folio:', error.name === 'MongooseServerSelectionError'
    ? 'Cannot connect to MongoDB. Check MONGODB_URI and replica-set readiness.' : error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
