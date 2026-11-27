import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: root + '.env', quiet: true });
const port = Number(process.env.PORT || 4000);
export const defaultStore = Object.freeze({ name: 'Folio Bookshop' });
const storeFields = {
  name: 'STORE_LEGAL_NAME', address: 'STORE_ADDRESS', email: 'STORE_SUPPORT_EMAIL',
  phone: 'STORE_SUPPORT_PHONE', privacyEmail: 'STORE_PRIVACY_EMAIL',
  retention: 'STORE_RETENTION_NOTICE', delivery: 'STORE_DELIVERY_NOTICE',
};
const store = { ...defaultStore };
for (const [key, variable] of Object.entries(storeFields)) {
  if (process.env[variable]?.trim()) store[key] = process.env[variable].trim();
}
export const config = {
  host: process.env.HOST || '127.0.0.1',
  port,
  mongoUri: process.env.MONGODB_URI,
  publicOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  secure: process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
  production: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === '1',
  store,
};

export function validateStartup(settings) {
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  if (!settings.mongoUri) throw new Error('MONGODB_URI is required.');
  if (!settings.production) return;
  let origin;
  try { origin = new URL(settings.publicOrigin); } catch { /* Report a configuration error below. */ }
  if (!settings.secure || origin?.protocol !== 'https:' || origin.origin !== settings.publicOrigin) {
    throw new Error('Production requires secure cookies and an exact HTTPS APP_ORIGIN.');
  }
  const absent = Object.values(storeFields).filter(variable => !process.env[variable]?.trim());
  if (absent.length) throw new Error('Set the public store details: ' + absent.join(', '));
  if (![store.email, store.privacyEmail].every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    throw new Error('Set valid public support and privacy email addresses.');
  }
}
