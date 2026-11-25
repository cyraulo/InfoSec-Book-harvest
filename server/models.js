import mongoose from 'mongoose';
const { Schema } = mongoose;
const id = Schema.Types.ObjectId;
const ref = (model, required = true) => ({ type: id, ref: model, required });
const integer = (min, max, required = true) => ({
  type: Number, required, min, max,
  validate: value => (!required && value == null) || Number.isInteger(value),
});
export const MAX_PRICE = 10_000_000;
export const MAX_STOCK = 1_000_000;
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;
export const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const timestamps = { timestamps: true };
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, default: '', maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  termsVersion: { type: String, select: false },
  termsAcceptedAt: { type: Date, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', required: true },
}, timestamps);
const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  user: { ...ref('User'), index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, timestamps);
const categorySchema = new Schema({
  name: { type: String, required: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '', maxlength: 500 },
  relationVersion: { type: Number, default: 0, select: false },
}, timestamps);
const bookSchema = new Schema({
  externalId: { type: String, unique: true, sparse: true, maxlength: 100 },
  title: { type: String, required: true, maxlength: 500 },
  subtitle: { type: String, default: '', maxlength: 500 },
  authors: [String],
  publisher: { type: String, default: '', maxlength: 250 },
  publishedDate: { type: String, default: '' },
  category: ref('Category'),
  googleCategories: [String],
  isbn: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 50000 },
  pageCount: integer(0, 100000, false),
  language: { type: String, default: '', maxlength: 20 },
  averageRating: { type: Number, min: 0, max: 5 },
  ratingsCount: integer(0, 1_000_000_000, false),
  priceCents: integer(0, MAX_PRICE),
  stock: integer(0, MAX_STOCK),
  coverPath: { type: String, default: '', maxlength: 500 },
  coverSourceUrl: String,
  googleBooksUrl: String,
  archived: { type: Boolean, default: false, required: true },
  relationVersion: { type: Number, default: 0, select: false },
}, timestamps);
bookSchema.index({ archived: 1, category: 1, priceCents: 1 });
bookSchema.index({ archived: 1, priceCents: 1 });
bookSchema.index({ archived: 1, title: 1 });
bookSchema.index({ archived: 1, stock: 1 });
bookSchema.index({ archived: 1, isbn: 1 });
const cartLine = new Schema({
  book: ref('Book'),
  quantity: integer(1, MAX_QUANTITY),
}, { _id: false });
const cartSchema = new Schema({
  customer: { ...ref('User'), unique: true },
  items: { type: [cartLine], default: [], validate: items => items.length <= MAX_LINES },
  revision: { type: Number, default: 0, required: true },
}, timestamps);
cartSchema.index({ 'items.book': 1 });
const orderLine = new Schema({
  book: ref('Book'),
  title: { type: String, required: true },
  quantity: integer(1, MAX_QUANTITY),
  unitPriceCents: integer(0, MAX_PRICE),
}, { _id: false });
const deliverySchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  phone: { type: String, required: true, maxlength: 30 },
  address: { type: String, required: true, maxlength: 500 },
}, { _id: false });
const orderSchema = new Schema({
  customer: ref('User'),
  checkoutKey: { type: String, required: true, select: false },
  items: { type: [orderLine], required: true, validate: items => items.length > 0 && items.length <= MAX_LINES },
  delivery: { type: deliverySchema, required: true },
  status: { type: String, enum: STATUSES, default: 'Pending', required: true },
  paymentMethod: { type: String, enum: ['Cash on delivery'], default: 'Cash on delivery', required: true },
  paymentStatus: { type: String, enum: ['Unpaid', 'Paid', 'Cancelled'], default: 'Unpaid', required: true },
  totalCents: integer(0, MAX_PRICE * MAX_QUANTITY * MAX_LINES),
  currency: { type: String, enum: ['PHP'], default: 'PHP', required: true },
}, timestamps);
orderSchema.index({ customer: 1, checkoutKey: 1 }, { unique: true });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.book': 1 });

export const User = mongoose.model('User', userSchema);
export const Session = mongoose.model('Session', sessionSchema);
export const Category = mongoose.model('Category', categorySchema);
export const Book = mongoose.model('Book', bookSchema);
export const Cart = mongoose.model('Cart', cartSchema);
export const Order = mongoose.model('Order', orderSchema);

export async function connect(uri) {
  if (!uri) throw new Error('Set MONGODB_URI in .env before starting.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('MongoDB must be a replica set or sharded cluster for checkout.');
  }
  await Promise.all([User, Session, Category, Book, Cart, Order].map(model => model.init()));
}
