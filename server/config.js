import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: root + '.env', quiet: true });
const port = Number(process.env.PORT || 4000);
export const config = {
  host: process.env.HOST || '127.0.0.1',
  port,
  mongoUri: process.env.MONGODB_URI,
  publicOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  secure: process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
  production: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === '1',
};
