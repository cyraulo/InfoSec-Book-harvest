import mongoose from 'mongoose';
import { Book, Cart, Category, Order, User } from './models.js';
import { cookieOptions, createSession, endSession, hashPassword, needsPasswordUpgrade, publicUser,
  sessionCookie, setSessionCookie, verifyPassword } from './auth.js';
import * as rules from './validation.js';
import * as catalog from './services/catalog.js';
import * as orders from './services/orders.js';

const id = request => rules.parse(rules.objectId, request.params.id);
const body = schema => request => rules.parse(schema, request.body);
const authBody = { login: body(rules.login), registration: body(rules.customerRegistration), profile: body(rules.profile) };
export function authControllers(secure) {
  return {
    async register(request, response) {
      const { password, ...input } = authBody.registration(request);
      const passwordHash = await hashPassword(password);
      const { customer, token } = await mongoose.connection.transaction(async session => {
        const [customer] = await User.create([{ ...input, passwordHash, termsAcceptedAt: new Date() }], { session });
        await Cart.create([{ customer: customer._id }], { session });
        return { customer, token: await createSession(customer, request, secure, session) };
      });
      setSessionCookie(response, token, secure);
      response.status(201).json(publicUser(customer));
    },
    async login(request, response) {
      const { email, password } = authBody.login(request);
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!(await verifyPassword(password, user?.passwordHash))) throw new rules.ApiError(401, 'Email or password is incorrect.');
      const passwordHash = needsPasswordUpgrade(user.passwordHash) ? await hashPassword(password) : user.passwordHash;
      const token = await mongoose.connection.transaction(async session => {
        // Serialize session issuance with password rotation, even when the hash is already current.
        const result = await User.updateOne({ _id: user._id, passwordHash: user.passwordHash },
          { $set: { passwordHash }, $inc: { __v: 1 } }, { session, timestamps: false });
        if (!result.matchedCount) throw new rules.ApiError(401, 'Email or password is incorrect.');
        return createSession(user, request, secure, session);
      });
      setSessionCookie(response, token, secure);
      response.json(publicUser(user));
    },
    async logout(request, response) {
      await endSession(request, secure);
      response.clearCookie(sessionCookie(secure), cookieOptions(secure)).sendStatus(204);
    },
    profile(request, response) {
      response.json(publicUser(request.user));
    },
    async updateProfile(request, response) {
      const user = await User.findByIdAndUpdate(request.user._id, { $set: authBody.profile(request) },
        { new: true, runValidators: true });
      response.json(publicUser(user));
    },
  };
}
export const books = admin => ({
  async list(request, response) {
    response.json(await catalog.listBooks(rules.parse(rules.catalogQuery, request.query), admin));
  },
  async get(request, response) {
    response.json(await catalog.getBook(id(request), admin));
  },
  async create(request, response) {
    response.status(201).json(await catalog.saveBook(null, body(rules.bookInput)(request)));
  },
  async edit(request, response) {
    response.json(await catalog.saveBook(id(request), body(rules.bookInput)(request)));
  },
  async remove(request, response) {
    response.json(await catalog.removeBook(id(request)));
  },
});
export const categories = {
  async list(request, response) {
    response.json(await Category.find().sort({ name: 1, _id: 1 }).lean());
  },
  async get(request, response) {
    response.json(await catalog.getCategory(id(request)));
  },
  async create(request, response) {
    response.status(201).json(await catalog.saveCategory(null, body(rules.categoryInput)(request)));
  },
  async edit(request, response) {
    response.json(await catalog.saveCategory(id(request), body(rules.categoryInput)(request)));
  },
  async remove(request, response) {
    await catalog.removeCategory(id(request));
    response.sendStatus(204);
  },
};
export const cart = {
  async get(request, response) {
    response.json(await orders.getCart(request.user._id));
  },
  async add(request, response) {
    const { book, quantity } = body(rules.addLine)(request);
    response.json(await orders.changeCart(request.user._id, 'add', book, quantity));
  },
  async set(request, response) {
    const { quantity } = body(rules.lineQuantity)(request);
    response.json(await orders.changeCart(request.user._id, 'set', id(request), quantity));
  },
  async remove(request, response) {
    response.json(await orders.changeCart(request.user._id, 'remove', id(request)));
  },
  async clear(request, response) {
    response.json(await orders.changeCart(request.user._id, 'clear'));
  },
};
export const order = admin => ({
  async findCheckout(request, response) {
    const checkoutKey = rules.parse(rules.checkoutInput.shape.checkoutKey, request.params.key);
    const result = await Order.findOne({ customer: request.user._id, checkoutKey }).select('_id').lean();
    if (!result) throw new rules.ApiError(404, 'No order was found for this checkout.');
    response.json(result);
  },
  async list(request, response) {
    const { page } = rules.parse(rules.pageQuery, request.query);
    const query = admin ? {} : { customer: request.user._id };
    if (admin && request.query.status) query.status = rules.parse(rules.statusInput, { status: request.query.status }).status;
    response.json(await catalog.paginate(Order, query, {
      page, sort: { createdAt: -1, _id: -1 },
      select: 'status paymentMethod paymentStatus totalCents currency createdAt delivery.name',
    }));
  },
  async get(request, response) {
    const query = { _id: id(request) };
    if (!admin) query.customer = request.user._id;
    const result = await Order.findOne(query).lean();
    if (!result) throw new rules.ApiError(404, 'Order not found.');
    response.json({ ...result, nextStatuses: admin ? orders.transitions[result.status] : [] });
  },
  async checkout(request, response) {
    const result = await orders.checkout(request.user._id, body(rules.checkoutInput)(request));
    response.status(result.replayed ? 200 : 201).json(result.order);
  },
  async update(request, response) {
    const result = await orders.updateStatus(id(request), body(rules.statusInput)(request).status);
    response.json({ ...result, nextStatuses: orders.transitions[result.status] });
  },
});
export async function dashboard(request, response) {
  const [pending, lowStock, recent] = await Promise.all([
    Order.countDocuments({ status: 'Pending' }),
    Book.find({ archived: false, stock: { $lte: 5 } }).sort({ stock: 1, title: 1 }).limit(8).select('title stock').lean(),
    Order.find().sort({ createdAt: -1 }).limit(5).select('status totalCents createdAt').lean(),
  ]);
  response.json({ pending, lowStock, recent });
}
