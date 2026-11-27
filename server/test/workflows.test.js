import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID, scryptSync } from 'node:crypto';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { hashPassword } from '../auth.js';
import { Book, connect, Session, User } from '../models.js';
import { seedCatalog } from '../scripts/seed.js';
import { root } from '../config.js';
import { policyVersion } from '../../shared/policies.js';

let database, app, admin, shop, other, category, book;
const password = 'test-password-only';
const missing = 'a'.repeat(24);
const base = '/api/admin';
const recipient = { name: 'Test Shopper', phone: '09171234567', address: '42 Demo Street, Manila 1000' };
const fixture = overrides => ({
  title: 'Workflow Test Book', authors: ['Tester'], category: category._id, priceCents: 34950, stock: 8, ...overrides,
});
async function register(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Test Shopper', email, password, termsVersion: policyVersion }).expect(201);
  return agent;
}
async function createBook(overrides) {
  return (await admin.post(base + '/books').send(fixture(overrides)).expect(201)).body;
}
async function add(agent, value, quantity) {
  return (await agent.post('/api/cart/items').send({ book: value._id, quantity }).expect(200)).body;
}
const checkout = (cart, overrides) => ({
  checkoutKey: randomUUID(), revision: cart.revision, expectedTotalCents: cart.totalCents, delivery: recipient, ...overrides,
});
const status = (id, value) => admin.patch(base + '/orders/' + id + '/status').send({ status: value });
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connect(database.getUri('folio_api_tests'));
  app = createApp({ authLimit: 100 });
  await User.create({ name: 'Administrator', email: 'admin@example.test', role: 'admin', passwordHash: await hashPassword(password) });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'admin@example.test', password }).expect(200);
  shop = await register('buyer@example.test');
  other = await register('other@example.test');
  category = (await admin.post(base + '/categories').send({ name: 'Test Fiction' }).expect(201)).body;
  assert.equal((await request(app).get('/api/books').expect(200)).body.total, 0);
});
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test('AUTH-01 normalized registration, invalid input, duplicate email, profile, login, cookie, expiry and logout', async () => {
  const agent = request.agent(app);
  const login = '/api/auth/login';
  await agent.get('/api/profile').expect(401);
  await agent.post('/api/auth/register').send({ name: 'A', email: 'invalid', password: 'short' }).expect(400);
  await agent.post('/api/auth/register').send({ name: 'A', email: 'BUYER@EXAMPLE.TEST', password, termsVersion: policyVersion }).expect(409);
  await agent.post(login).send({ email: 'buyer@example.test', password: 'wrong-password' }).expect(401);
  const response = await agent.post(login).send({ email: ' BUYER@example.test ', password }).expect(200);
  assert.equal(response.body.email, 'buyer@example.test');
  assert.equal(response.body.passwordHash, undefined);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  await agent.patch('/api/profile').send({ name: 'Changed name', phone: '09171234567', role: 'admin' }).expect(400);
  await agent.patch('/api/profile').send({ name: 'Changed name', phone: '09171234567' }).expect(200);
  assert.equal((await shop.get('/api/profile').expect(200)).body.name, 'Changed name');
  await agent.post('/api/auth/logout').send({}).expect(204);
  await agent.get('/api/profile').expect(401);
  await agent.post(login).send({ email: 'buyer@example.test', password }).expect(200);
  await Session.updateMany({ user: response.body._id }, { expiresAt: new Date(0) });
  await agent.get('/api/profile').expect(401);
  shop = request.agent(app);
  await shop.post(login).send({ email: 'buyer@example.test', password }).expect(200);
  await shop.patch('/api/profile').set('Origin', 'https://unrelated.example.test')
    .send({ name: 'Blocked', phone: '' }).expect(403);
});
test('AUTH-02 auth limit returns a consistent 429', async () => {
  const limited = request(createApp({ authLimit: 1 }));
  const payload = { email: 'unknown@example.test', password };
  await limited.post('/api/auth/login').send(payload).expect(401);
  const result = await limited.post('/api/auth/login').send(payload).expect(429);
  assert.match(result.body.error.message, /Too many/);
});
test('SEC-01 current terms are required and recorded without exposing acceptance or credentials', async () => {
  const email = 'policy@example.test';
  const profile = { name: 'Policy Test', email, password };
  await request(app).post('/api/auth/register').send(profile).expect(400);
  await request(app).post('/api/auth/register').send({ ...profile, termsVersion: 'obsolete' }).expect(400);
  assert.equal(await User.exists({ email }), null);
  const registered = await request(app).post('/api/auth/register').send({ ...profile, termsVersion: policyVersion }).expect(201);
  const saved = await User.findOne({ email }).select('+termsVersion +termsAcceptedAt +passwordHash');
  assert.equal(saved.termsVersion, policyVersion);
  assert(saved.termsAcceptedAt instanceof Date);
  assert.match(saved.passwordHash, /^scrypt2:/);
  assert.equal(registered.body.passwordHash, undefined);
  assert.equal(registered.body.termsVersion, undefined);
});
test('SEC-02 production origin, cookie flags, no-store, CSP and clean client errors', async t => {
  const origin = 'https://bookshop.example.test';
  const production = request(createApp({ publicOrigin: origin, secure: true }));
  await production.post('/api/auth/login').send({ email: 'buyer@example.test', password }).expect(403);
  await production.post('/api/auth/login').set('Origin', origin).set('Sec-Fetch-Site', 'cross-site')
    .send({ email: 'buyer@example.test', password }).expect(403);
  const result = await production.post('/api/auth/login').set('Origin', origin)
    .send({ email: 'buyer@example.test', password }).expect(200).expect('Cache-Control', 'no-store');
  const cookie = result.headers['set-cookie'][0];
  assert.match(cookie, /^__Host-folio_session=/);
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/']) assert(cookie.includes(attribute));
  assert(!cookie.includes('Domain='));
  assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert(result.headers['strict-transport-security']);
  await production.get('/api/profile').set('Cookie', cookie.split(';')[0]).expect(200);
  await production.post('/api/auth/logout').set('Origin', origin).set('Cookie', cookie.split(';')[0]).send({}).expect(204);
  await production.get('/api/profile').set('Cookie', cookie.split(';')[0]).expect(401);
  const invalid = await production.post('/api/auth/login').set('Origin', origin).type('json').send('{').expect(400);
  assert.deepEqual(invalid.body, { error: { message: 'The submitted data is invalid or too large.' } });
  await production.get('/api/ready').expect(200, { status: 'ready' });
  const limited = request(createApp({ apiLimit: 1 }));
  await limited.get('/api/books').expect(200);
  await limited.get('/api/books').expect(429);
  t.mock.method(Book, 'countDocuments', () => { throw new Error('private diagnostic sent to the server'); });
  const failure = await production.get('/api/books').expect(500);
  assert.deepEqual(failure.body, { error: { message: 'The server could not complete this request. Try again.' } });
});
test('SEC-03 existing password verifies and is replaced with the stronger hash on successful login', async () => {
  const email = 'legacy@example.test';
  const salt = '1'.repeat(32);
  const oldHash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  await User.create({ name: 'Existing account', email, passwordHash: oldHash });
  await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  const saved = await User.findOne({ email }).select('+passwordHash');
  assert.match(saved.passwordHash, /^scrypt2:/);
});
test('CAT-01 category create/list/read/edit/delete, duplicate, invalid, missing and forbidden', async () => {
  await shop.post(base + '/categories').send({ name: 'Blocked' }).expect(403);
  await admin.post(base + '/categories').send({ name: ' ' }).expect(400);
  await admin.post(base + '/categories').send({ name: 'Test Fiction' }).expect(409);
  const created = (await admin.post(base + '/categories').send({ name: 'Temporary' }).expect(201)).body;
  const url = base + '/categories/' + created._id;
  await admin.put(url).send({ name: 'Renamed', description: 'A test category' }).expect(200);
  assert.equal((await admin.get(url).expect(200)).body.name, 'Renamed');
  assert((await admin.get(base + '/categories').expect(200)).body.some(item => item._id === created._id));
  await admin.delete(url).expect(204);
  await admin.get(url).expect(404);
  await admin.put(url).send({ name: 'Missing' }).expect(404);
  await admin.delete(url).expect(404);
});
test('BOOK-01 full CRUD, queries, admin enforcement and used category restriction', async () => {
  await request(app).get(base + '/books').expect(401);
  await shop.post(base + '/books').send(fixture()).expect(403);
  await admin.post(base + '/books').send(fixture({ stock: -1 })).expect(400);
  await admin.post(base + '/books').send(fixture({ category: missing })).expect(400);
  await admin.post(base + '/books').send(fixture({ priceCents: -1 })).expect(400);
  book = await createBook({ isbn: '9780525522881', pageCount: null });
  const url = base + '/books/' + book._id;
  await admin.put(url).send(fixture({ title: 'Updated long title', isbn: '9780525522881' })).expect(200);
  assert.equal((await request(app).get('/api/books/' + book._id).expect(200)).body.title, 'Updated long title');
  for (const q of ['Updated', 'Tester', '978-0525522881']) {
    const result = await request(app).get('/api/books').query({ q, category: category.slug, availability: 'in', min: '30000', max: '35000', sort: 'price-asc' }).expect(200);
    assert(result.body.items.some(item => item._id === book._id));
  }
  await request(app).get('/api/books/wrong').expect(400);
  await admin.put(base + '/books/' + missing).send(fixture()).expect(404);
  await admin.delete(base + '/categories/' + category._id).expect(409);
  const temporary = await createBook();
  await admin.delete(base + '/books/' + temporary._id).expect(200, { action: 'deleted' });
  await request(app).get('/api/books/' + temporary._id).expect(404);
  await admin.delete(base + '/books/' + temporary._id).expect(404);
});
test('CART-01 add, update, remove, clear and re-read; validate quantities, missing IDs and access', async () => {
  await request(app).get('/api/cart').expect(401);
  await admin.get('/api/cart').expect(403);
  await shop.post('/api/cart/items').send({ book: book._id, quantity: 0 }).expect(400);
  await shop.post('/api/cart/items').send({ book: missing, quantity: 1 }).expect(404);
  const url = '/api/cart/items/' + book._id;
  await shop.patch(url).send({ quantity: 1 }).expect(404);
  await add(shop, book, 1);
  await shop.patch(url).send({ quantity: 1.5 }).expect(400);
  await shop.patch(url).send({ quantity: 9 }).expect(409);
  await shop.patch(url).send({ quantity: 2 }).expect(200);
  assert.equal((await shop.get('/api/cart').expect(200)).body.items[0].quantity, 2);
  assert.equal((await other.get('/api/cart').expect(200)).body.items.length, 0);
  await shop.delete(url).expect(200);
  await shop.delete(url).expect(404);
  await add(shop, book, 1);
  assert.equal((await shop.delete('/api/cart').expect(200)).body.items.length, 0);
  assert.equal((await shop.get('/api/cart').expect(200)).body.items.length, 0);
});
test('ORDER-01 server repricing, multi-line rollback, stock conflict, replay, histories and ownership', async () => {
  const second = await createBook({ stock: 2, title: 'Second title' });
  await add(shop, book, 2);
  let cart = await add(shop, second, 2);
  const before = (await Book.findById(book._id)).stock;
  await shop.post('/api/orders').send(checkout(cart, { expectedTotalCents: 1 })).expect(409);
  assert.equal((await Book.findById(book._id)).stock, before);
  await admin.put(base + '/books/' + second._id).send(fixture({ stock: 1, title: second.title })).expect(200);
  await shop.post('/api/orders').send(checkout(cart)).expect(409);
  assert.equal((await Book.findById(book._id)).stock, before);
  assert.equal((await shop.get('/api/orders').expect(200)).body.total, 0);
  await shop.delete('/api/cart/items/' + second._id).expect(200);
  cart = (await shop.get('/api/cart').expect(200)).body;
  const input = checkout(cart);
  const results = await Promise.all([shop.post('/api/orders').send(input), shop.post('/api/orders').send(input)]);
  assert.deepEqual(results.map(item => item.status).sort(), [200, 201]);
  const order = results[0].body;
  assert.equal(results[1].body._id, order._id);
  assert.equal(order.totalCents, 69900);
  assert.equal(order.checkoutKey, undefined);
  assert.equal(order.customer, undefined);
  assert.equal(order.__v, undefined);
  await shop.get('/api/orders/checkout/' + input.checkoutKey).expect(200, { _id: order._id });
  await other.get('/api/orders/checkout/' + input.checkoutKey).expect(404);
  await other.get('/api/orders/' + order._id).expect(404);
  const detail = (await shop.get('/api/orders/' + order._id).expect(200)).body;
  assert.deepEqual(detail.delivery, recipient);
  assert.equal(detail.customer, undefined);
  assert.equal(detail.checkoutKey, undefined);
  await request(app).get('/api/orders/' + order._id).expect(401);
  assert.equal((await other.get('/api/orders').expect(200)).body.total, 0);
  const history = (await shop.get('/api/orders').expect(200)).body;
  assert.equal(history.total, 1);
  assert.equal(history.items[0].delivery, undefined);
  assert.equal((await Book.findById(book._id)).stock, before - 2);
  assert.equal((await shop.get('/api/cart').expect(200)).body.items.length, 0);
  await shop.patch(base + '/orders/' + order._id + '/status').send({ status: 'Confirmed' }).expect(403);
  await status(missing, 'Confirmed').expect(404);
  await status(order._id, 'Unknown').expect(400);
  await status(order._id, 'Delivered').expect(409);
  await status(order._id, 'Confirmed').expect(200);
  const cancels = await Promise.all([status(order._id, 'Cancelled'), status(order._id, 'Cancelled')]);
  assert(cancels.every(result => result.status === 200 && result.body.paymentStatus === 'Cancelled'));
  assert.equal((await Book.findById(book._id)).stock, before);
  await status(order._id, 'Shipped').expect(409);
  await admin.delete(base + '/books/' + book._id).expect(200, { action: 'archived' });
  await request(app).get('/api/books/' + book._id).expect(404);
  assert.equal((await shop.get('/api/orders/' + order._id).expect(200)).body.items[0].title, 'Updated long title');
});
test('ORDER-02 concurrent customers cannot oversell; delivered COD becomes paid', async () => {
  const scarce = await createBook({ stock: 1, title: 'Last copy' });
  const [a, b] = await Promise.all([add(shop, scarce, 1), add(other, scarce, 1)]);
  const results = await Promise.all([shop.post('/api/orders').send(checkout(a)), other.post('/api/orders').send(checkout(b))]);
  assert.deepEqual(results.map(item => item.status).sort(), [201, 409]);
  assert.equal((await Book.findById(scarce._id)).stock, 0);
  const id = results.find(result => result.status === 201).body._id;
  await status(id, 'Confirmed').expect(200);
  await status(id, 'Shipped').expect(200);
  await status(id, 'Cancelled').expect(409);
  const finished = await status(id, 'Delivered').expect(200);
  assert.equal(finished.body.paymentStatus, 'Paid');
});
test('SEED-01 imports the real dataset twice without overriding an edit, and serves covers', async () => {
  const first = await seedCatalog();
  assert.deepEqual(first, { imported: 193, updated: 0, skipped: 0, invalid: 0, missingCovers: 0, problems: [] });
  const imported = await Book.findOne({ externalId: 'In8mDwAAQBAJ' });
  const publicBook = (await request(app).get('/api/books/' + imported._id).expect(200)).body;
  assert.equal(publicBook.title, imported.title);
  for (const field of ['__v', 'externalId', 'coverSourceUrl', 'googleBooksUrl', 'relationVersion']) {
    assert.equal(publicBook[field], undefined);
  }
  assert.equal(imported.priceCents, 39900);
  assert.equal(imported.isbn, '9780525522881');
  await Book.updateOne({ _id: imported._id }, { $set: { stock: 4 } });
  assert.equal((await seedCatalog()).skipped, 193);
  assert.equal((await Book.findById(imported._id)).stock, 4);
  await request(app).get(imported.coverPath).expect(200).expect('Content-Type', /image/);
  await request(app).get('/covers/fiction/missing.jpg').expect(404);
});

test('SHELF-01 featured editions use current inventory and active replacements', async () => {
  await seedCatalog();
  await Book.updateOne({ externalId: 'In8mDwAAQBAJ' }, { $set: { stock: 3 } });
  const load = async () => (await request(app).get('/api/books/front-table').expect(200)).body;
  const original = await load();
  assert.equal(original.length, 9);
  assert.equal(original[0].externalId, 'In8mDwAAQBAJ');
  assert.equal(original[0].stock, 3);
  assert.equal(original[0].category.slug, 'fiction');
  await Book.updateOne({ _id: original[0]._id }, { $set: { archived: true } });
  const updated = await load();
  assert.equal(new Set(updated.map(item => item._id)).size, 9);
  assert.equal(updated[0]._id, original[1]._id);
  assert.ok(!updated.some(item => item._id === original[0]._id));
});

test('SETUP-01 seed and administrator commands use environment configuration and can be rerun', async () => {
  const child = promisify(execFile);
  const options = { cwd: root, env: { ...process.env, MONGODB_URI: database.getUri('folio_api_tests'),
    ADMIN_NAME: 'CLI Admin', ADMIN_EMAIL: 'cli@example.test', ADMIN_PASSWORD: password } };
  const seeded = await child(process.execPath, ['server/scripts/seed.js'], options);
  assert.equal(JSON.parse(seeded.stdout).skipped, 193);
  const first = await child(process.execPath, ['server/scripts/admin.js'], options);
  const second = await child(process.execPath, ['server/scripts/admin.js'], options);
  assert.match(first.stdout, /Administrator created/);
  assert.match(second.stdout, /Administrator already exists/);
  const cliAdmin = request.agent(app);
  await cliAdmin.post('/api/auth/login').send({ email: 'cli@example.test', password }).expect(200);
  const newPassword = 'rotated-test-password';
  const rotated = await child(process.execPath, ['server/scripts/admin.js', '--rotate-password'],
    { ...options, env: { ...options.env, ADMIN_PASSWORD: newPassword } });
  assert.match(rotated.stdout, /existing sessions revoked/);
  await cliAdmin.get('/api/profile').expect(401);
  await cliAdmin.post('/api/auth/login').send({ email: 'cli@example.test', password }).expect(401);
  await cliAdmin.post('/api/auth/login').send({ email: 'cli@example.test', password: newPassword }).expect(200);
});
