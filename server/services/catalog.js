import mongoose from 'mongoose';
import { Book, Cart, Category, Order } from '../models.js';
import { ApiError, slugify } from '../validation.js';

const sorts = {
  title: { title: 1, _id: 1 }, 'price-asc': { priceCents: 1, _id: 1 },
  'price-desc': { priceCents: -1, _id: 1 }, recent: { createdAt: -1, _id: -1 },
};
// The front table is a shop selection. Prices, covers and availability always come from live records.
const frontTableIds = [
  'In8mDwAAQBAJ', 'FD72ekYZqIkC', 'BKjCQgAACAAJ', 'oNY0DwAAQBAJ', 'nAYBEAAAQBAJ',
  'Xm5H_tRsgWcC', 'WADDM36d3TAC', '5wBQEp6ruIAC', 'gN6ySQnUnfwC',
];
export async function frontTable() {
  const fields = 'externalId title authors category priceCents stock coverPath';
  const active = { archived: false };
  const picks = await Book.find({ ...active, externalId: { $in: frontTableIds } })
    .select(fields).populate('category', 'name slug').lean();
  picks.sort((a, b) => frontTableIds.indexOf(a.externalId) - frontTableIds.indexOf(b.externalId));
  if (picks.length === frontTableIds.length) return picks;
  const others = await Book.find({ ...active, _id: { $nin: picks.map(book => book._id) } })
    .sort(sorts.title).limit(frontTableIds.length - picks.length).select(fields).populate('category', 'name slug').lean();
  return picks.concat(others);
}
export async function paginate(model, query, { page, size = 12, sort = sorts.title, populate, select }) {
  const pages = Math.max(1, Math.ceil(await model.countDocuments(query) / size));
  const current = Math.min(page, pages);
  const cursor = model.find(query).sort(sort).skip((current - 1) * size).limit(size);
  if (populate) cursor.populate(populate);
  if (select) cursor.select(select);
  const [items, total] = await Promise.all([cursor.lean(), model.countDocuments(query)]);
  return { items, total, page: current, pages };
}
const escape = value => value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
export async function listBooks({ q, category, min, max, availability, sort, page }, admin = false) {
  const query = admin ? {} : { archived: false };
  if (q) {
    const matcher = new RegExp(escape(q), 'i');
    const compact = q.replace(/[-\s]/g, '');
    query.$or = [{ title: matcher }, { authors: matcher }, { isbn: /^\d{9}[\dXx]$|^\d{13}$/.test(compact) ? compact.toUpperCase() : matcher }];
  }
  if (category) {
    const parent = await Category.findOne({ slug: category }).select('_id');
    if (!parent) return { items: [], total: 0, page: 1, pages: 1 };
    query.category = parent._id;
  }
  if (min !== undefined || max !== undefined) {
    query.priceCents = {};
    if (min !== undefined) query.priceCents.$gte = min;
    if (max !== undefined) query.priceCents.$lte = max;
  }
  if (availability) query.stock = availability === 'in' ? { $gt: 0 } : 0;
  return paginate(Book, query, { page, sort: sorts[sort], populate: 'category',
    select: 'title authors category isbn priceCents stock coverPath archived' });
}
export async function getBook(id, admin = false) {
  const book = await Book.findOne(admin ? { _id: id } : { _id: id, archived: false }).populate('category').lean();
  if (!book) throw new ApiError(404, 'Book not found.');
  return book;
}
export async function saveBook(id, input) {
  return mongoose.connection.transaction(async session => {
    // Coordinate reference creation with category deletion.
    const result = await Category.updateOne({ _id: input.category }, { $inc: { relationVersion: 1 } }, { session, timestamps: false });
    if (!result.matchedCount) throw new ApiError(400, 'Choose an existing category.', { category: 'This category no longer exists.' });
    if (!id) {
      const [book] = await Book.create([input], { session });
      return Book.findById(book._id).session(session).populate('category').lean();
    }
    const book = await Book.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true, session })
      .populate('category').lean();
    if (!book) throw new ApiError(404, 'Book not found.');
    return book;
  });
}
export async function removeBook(id) {
  return mongoose.connection.transaction(async session => {
    const book = await Book.findByIdAndUpdate(id, { $set: { archived: true } }, { new: true, session });
    if (!book) throw new ApiError(404, 'Book not found.');
    const purchased = await Order.exists({ 'items.book': id }).session(session);
    const inCart = await Cart.exists({ 'items.book': id }).session(session);
    if (purchased || inCart) return { action: 'archived' };
    await Book.deleteOne({ _id: id }, { session });
    return { action: 'deleted' };
  });
}
export async function getCategory(id) {
  const category = await Category.findById(id).lean();
  if (!category) throw new ApiError(404, 'Category not found.');
  return category;
}
export async function saveCategory(id, input) {
  if (!id) {
    const category = await Category.create({ ...input, slug: slugify(input.name) });
    return getCategory(category._id);
  }
  const category = await Category.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).lean();
  if (!category) throw new ApiError(404, 'Category not found.');
  return category;
}
export async function removeCategory(id) {
  return mongoose.connection.transaction(async session => {
    const result = await Category.updateOne({ _id: id }, { $inc: { relationVersion: 1 } }, { session });
    if (!result.matchedCount) throw new ApiError(404, 'Category not found.');
    if (await Book.exists({ category: id }).session(session)) {
      throw new ApiError(409, 'Move every book in this category to another category before deleting it.');
    }
    await Category.deleteOne({ _id: id }, { session });
  });
}
