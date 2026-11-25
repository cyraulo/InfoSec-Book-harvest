import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { root } from './config.js';
import { routes } from './routes.js';
import { ApiError } from './validation.js';
export function createApp({ publicOrigin = 'http://localhost:5173', secure = false, trustProxy = false, authLimit = 25 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(helmet({
    strictTransportSecurity: secure ? undefined : false,
    contentSecurityPolicy: { directives: {
      upgradeInsecureRequests: secure ? [] : null,
      imgSrc: ["'self'", 'data:'],
    } },
  }));
  app.use('/covers', express.static(path.join(root, 'images'), { index: false }));
  app.use('/covers', (request, response) => response.sendStatus(404));
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const origin = request.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        ((origin && origin !== publicOrigin) || request.get('sec-fetch-site') === 'cross-site')) {
      return next(new ApiError(403, 'This request came from an untrusted origin.'));
    }
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && !request.is('application/json')) {
      return next(new ApiError(415, 'Send this request as JSON.'));
    }
    next();
  }, express.json({ limit: '96kb' }), cookieParser(), routes({ secure, authLimit }));
  app.use('/api', (request, response, next) => next(new ApiError(404, 'API route not found.')));
  const dist = path.join(root, 'client', 'dist');
  app.use(express.static(dist));
  app.get('/{*route}', (request, response) => {
    if (!request.accepts('html') || path.extname(request.path)) return response.sendStatus(404);
    response.sendFile(path.join(dist, 'index.html'), error => {
      if (error && !response.headersSent) response.status(404).send('Build the web app or use the Vite development server.');
    });
  });
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof ApiError) {
      return response.status(error.status).json({ error: { message: error.message, fields: error.fields } });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0];
      const message = field === 'email' ? 'An account already uses this email.' : 'A record with this identifier already exists.';
      return response.status(409).json({ error: { message, fields: field === 'email' ? { email: message } : undefined } });
    }
    if ([400, 413, 415].includes(error.status) || error.name === 'ValidationError') {
      return response.status(error.status || 400).json({ error: { message: 'The submitted data is invalid or too large.' } });
    }
    console.error('API failure', request.method, request.path, error.name, error.code ?? '');
    response.status(500).json({ error: { message: 'The server could not complete this request. Try again.' } });
  });
  return app;
}
