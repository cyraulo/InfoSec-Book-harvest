import { config, validateStartup } from '../server/config.js';
import { connect } from '../server/models.js';
import { createApp } from '../server/app.js';

let initialization;
async function initialize() {
  validateStartup(config);
  await connect(config.mongoUri);
  return createApp(config);
}

export default async function handler(request, response) {
  try {
    // Share initialization across concurrent requests and reuse the warm connection.
    initialization ??= initialize().catch(error => {
      initialization = undefined;
      throw error;
    });
    const app = await initialization;
    return app(request, response);
  } catch (error) {
    console.error('API initialization failed', { type: error.name, code: error.code ?? '' });
    response.setHeader('Cache-Control', 'no-store');
    response.status(503).json({ error: { message: 'The bookstore is temporarily unavailable. Please try again shortly.' } });
  }
}
