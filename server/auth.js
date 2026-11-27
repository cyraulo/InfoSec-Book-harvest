import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Session, User } from './models.js';
import { ApiError } from './validation.js';

const scrypt = promisify(scryptCallback);
const dummySalt = '0'.repeat(32);
const dummyKey = Buffer.alloc(64);
export const cookieName = 'folio_session';
export const sessionCookie = secure => secure ? '__Host-' + cookieName : cookieName;
export const sessionAge = 7 * 24 * 60 * 60 * 1000;
export const cookieOptions = secure => ({ httpOnly: true, secure, sameSite: 'lax', path: '/' });
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const currentOptions = { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
const currentVersion = 'scrypt2';
const readToken = (request, secure) => {
  const token = request.cookies[sessionCookie(secure)];
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
};
let activeHashes = 0;
async function deriveKey(password, salt, options) {
  if (activeHashes >= 4) throw new ApiError(503, 'Sign-in services are busy. Please try again shortly.');
  activeHashes += 1;
  try {
    return await scrypt(password, salt, 64, options);
  } finally {
    activeHashes -= 1;
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, currentOptions);
  return currentVersion + ':' + salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, hash) {
  const match = /^(scrypt2:)?([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash ?? '');
  const key = await deriveKey(password, match?.[2] ?? dummySalt, match && !match[1] ? {} : currentOptions);
  return timingSafeEqual(key, match ? Buffer.from(match[3], 'hex') : dummyKey) && Boolean(match);
}
export const needsPasswordUpgrade = hash => !hash.startsWith(currentVersion + ':');
export const publicUser = user => ({
  _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
});
export async function createSession(user, request, secure, session) {
  await endSession(request, secure, session);
  const token = randomBytes(32).toString('base64url');
  await Session.create([{ tokenHash: tokenHash(token), user: user._id, expiresAt: new Date(Date.now() + sessionAge) }], { session });
  return token;
}
export function setSessionCookie(response, token, secure) {
  response.cookie(sessionCookie(secure), token, { ...cookieOptions(secure), maxAge: sessionAge });
}
export async function endSession(request, secure, session) {
  const token = readToken(request, secure);
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) }, { session });
}
export const authenticated = secure => async (request, response, next) => {
  const token = readToken(request, secure);
  const session = token && await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  request.user = session && await User.findById(session.user);
  if (!request.user) throw new ApiError(401, 'Sign in to continue.');
  next();
};
export const role = expected => (request, response, next) => {
  if (request.user.role !== expected) throw new ApiError(403, 'You do not have access to this action.');
  next();
};
