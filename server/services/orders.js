import mongoose from 'mongoose';
import { Book, Cart, MAX_LINES, MAX_QUANTITY, MAX_STOCK, Order } from '../models.js';
import { ApiError } from '../validation.js';

export async function getCart(customer) {
  const cart = await Cart.findOne({ customer }).populate('items.book', 'title authors coverPath priceCents stock archived').lean();
  const items = (cart?.items ?? []).map(line => ({
    book: line.book, quantity: line.quantity,
    available: Boolean(line.book && !line.book.archived && line.book.stock >= line.quantity),
    lineTotalCents: (line.book?.priceCents ?? 0) * line.quantity,
  }));
  return { items, revision: cart?.revision ?? 0,
    totalCents: items.reduce((total, line) => total + line.lineTotalCents, 0) };
}
export async function changeCart(customer, action, id, quantity) {
  await mongoose.connection.transaction(async session => {
    const cart = await Cart.findOne({ customer }).session(session);
    const line = cart.items.find(item => String(item.book) === id);
    if (action === 'clear') cart.items = [];
    else if (action === 'remove') {
      if (!line) throw new ApiError(404, 'Cart item not found.');
      cart.items = cart.items.filter(item => String(item.book) !== id);
    } else {
      if (action === 'set' && !line) throw new ApiError(404, 'Cart item not found.');
      const next = action === 'add' ? (line?.quantity ?? 0) + quantity : quantity;
      if (next > MAX_QUANTITY) throw new ApiError(400, 'Use a quantity between 1 and 99.', { quantity: 'Maximum 99 per book.' });
      if (!line && cart.items.length >= MAX_LINES) throw new ApiError(409, 'The cart can hold up to 50 different books.');
      const book = await Book.findOneAndUpdate(
        { _id: id, archived: false }, { $inc: { relationVersion: 1 } }, { session, timestamps: false },
      );
      if (!book) throw new ApiError(404, 'This book is unavailable.');
      if (book.stock < next) throw new ApiError(409, 'Only ' + book.stock + ' copies are available.');
      if (line) line.quantity = next;
      else cart.items.push({ book: id, quantity: next });
    }
    cart.revision += 1;
    await cart.save({ session });
  });
  return getCart(customer);
}
export async function checkout(customer, input) {
  return mongoose.connection.transaction(async session => {
    const existing = await Order.findOne({ customer, checkoutKey: input.checkoutKey }).session(session).lean();
    if (existing) return { order: existing, replayed: true };
    const cart = await Cart.findOne({ customer }).session(session);
    if (!cart?.items.length) throw new ApiError(409, 'Your cart is empty.');
    if (cart.revision !== input.revision) throw new ApiError(409, 'Your cart changed. Review the updated cart before ordering.');
    const lines = [];
    let totalCents = 0;
    for (const line of [...cart.items].sort((a, b) => String(a.book).localeCompare(String(b.book)))) {
      const book = await Book.findOneAndUpdate(
        { _id: line.book, archived: false, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } }, { session },
      );
      if (!book) throw new ApiError(409, 'A cart item is unavailable in the requested quantity. Review your cart.');
      lines.push({ book: book._id, title: book.title, quantity: line.quantity, unitPriceCents: book.priceCents });
      totalCents += book.priceCents * line.quantity;
    }
    if (totalCents !== input.expectedTotalCents) throw new ApiError(409, 'A price changed. Review the new total before ordering.');
    const [created] = await Order.create([{ customer, checkoutKey: input.checkoutKey, items: lines,
      delivery: input.delivery, totalCents }], { session });
    cart.items = [];
    cart.revision += 1;
    await cart.save({ session });
    return { order: await Order.findById(created._id).session(session).lean(), replayed: false };
  });
}

export const transitions = {
  Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'], Delivered: [], Cancelled: [],
};
export async function updateStatus(id, next) {
  return mongoose.connection.transaction(async session => {
    const order = await Order.findById(id).session(session);
    if (!order) throw new ApiError(404, 'Order not found.');
    if (order.status === next) return order.toObject();
    if (!transitions[order.status].includes(next)) throw new ApiError(409, 'This status change is not permitted.');
    if (next === 'Cancelled') {
      for (const line of order.items) {
        const result = await Book.updateOne({ _id: line.book, stock: { $lte: MAX_STOCK - line.quantity } },
          { $inc: { stock: line.quantity } }, { session });
        if (!result.matchedCount) throw new ApiError(409, 'Stock cannot be restored. Check inventory before cancelling.');
      }
      order.paymentStatus = 'Cancelled';
    }
    if (next === 'Delivered') order.paymentStatus = 'Paid';
    order.status = next;
    await order.save({ session });
    return order.toObject();
  });
}
