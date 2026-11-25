import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Session, User } from './models.js';
import { ApiError } from './validation.js';

const scrypt = promisify(scryptCallback);
const dummySalt = '0'.repeat(32);
const dummyKey = Buffer.alloc(64);
export const cookieName = 'folio_session';
export const sessionAge = 7 * 24 * 60 * 60 * 1000;
export const cookieOptions = secure => ({ httpOnly: true, secure, sameSite: 'lax', path: '/' });
const tokenHash = token => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, hash) {
  const [salt, hex] = hash?.split(':') ?? [dummySalt, null];
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(key, hex ? Buffer.from(hex, 'hex') : dummyKey) && Boolean(hash);
}
export const publicUser = user => ({
  _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
});
export async function issueSession(user, request, response, secure) {
  await endSession(request);
  const token = randomBytes(32).toString('base64url');
  await Session.create({ tokenHash: tokenHash(token), user: user._id, expiresAt: new Date(Date.now() + sessionAge) });
  response.cookie(cookieName, token, { ...cookieOptions(secure), maxAge: sessionAge });
  return publicUser(user);
}
export async function endSession(request) {
  const token = request.cookies[cookieName];
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) });
}
export async function authenticated(request, response, next) {
  const token = request.cookies[cookieName];
  const session = token && await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  request.user = session && await User.findById(session.user);
  if (!request.user) throw new ApiError(401, 'Sign in to continue.');
  next();
}
export const role = expected => (request, response, next) => {
  if (request.user.role !== expected) throw new ApiError(403, 'You do not have access to this action.');
  next();
};
