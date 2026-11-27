import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { authenticated, role } from './auth.js';
import { authControllers, books, cart, categories, dashboard, order } from './controllers.js';

export function routes({ secure, authLimit, store }) {
  const api = Router();
  const requireSession = authenticated(secure);
  const auth = authControllers(secure);
  const catalog = books(false);
  const managedBooks = books(true);
  const ownOrders = order(false);
  const managedOrders = order(true);
  const accountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (request, response) => response.status(429).json({ error: { message: 'Too many attempts. Try again later.' } }),
  });
  api.get('/health', (request, response) => response.json({ status: 'ok' }));
  api.get('/ready', (request, response) => {
    const ready = mongoose.connection.readyState === 1;
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });
  api.get('/store-info', (request, response) => response.json(store));
  api.post('/auth/register', accountLimiter, auth.register);
  api.post('/auth/login', accountLimiter, auth.login);
  api.post('/auth/logout', auth.logout);
  api.get('/profile', requireSession, auth.profile);
  api.patch('/profile', requireSession, auth.updateProfile);
  api.get('/books', catalog.list);
  api.get('/books/front-table', catalog.frontTable);
  api.get('/books/:id', catalog.get);
  api.get('/categories', categories.list);

  api.use(['/cart', '/orders'], requireSession, role('customer'));
  api.get('/cart', cart.get);
  api.post('/cart/items', cart.add);
  api.patch('/cart/items/:id', cart.set);
  api.delete('/cart/items/:id', cart.remove);
  api.delete('/cart', cart.clear);
  api.get('/orders', ownOrders.list);
  api.post('/orders', ownOrders.checkout);
  api.get('/orders/checkout/:key', ownOrders.findCheckout);
  api.get('/orders/:id', ownOrders.get);

  api.use('/admin', requireSession, role('admin'));
  api.get('/admin/dashboard', dashboard);
  api.get('/admin/books', managedBooks.list);
  api.post('/admin/books', managedBooks.create);
  api.get('/admin/books/:id', managedBooks.get);
  api.put('/admin/books/:id', managedBooks.edit);
  api.delete('/admin/books/:id', managedBooks.remove);
  api.get('/admin/categories', categories.list);
  api.post('/admin/categories', categories.create);
  api.get('/admin/categories/:id', categories.get);
  api.put('/admin/categories/:id', categories.edit);
  api.delete('/admin/categories/:id', categories.remove);
  api.get('/admin/orders', managedOrders.list);
  api.get('/admin/orders/:id', managedOrders.get);
  api.patch('/admin/orders/:id/status', managedOrders.update);
  return api;
}
