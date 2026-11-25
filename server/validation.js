import { z } from 'zod';
import { MAX_PRICE, MAX_QUANTITY, MAX_STOCK, STATUSES } from './models.js';
import { policyVersion } from '../shared/policies.js';

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields = Object.create(null);
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'form';
    fields[field] ??= issue.code === 'unrecognized_keys' ? 'Remove unsupported fields and try again.' : issue.message;
  }
  throw new ApiError(400, 'Check the highlighted values and try again.', fields);
}
export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid record identifier.');
export const email = z.string().trim().max(254).email().toLowerCase();
export const password = z.string().min(10, 'Use at least 10 characters.').max(128);
const name = z.string().trim().min(1, 'Enter a name.').max(100);
const phone = z.string().trim().regex(/^[+\d(). -]{7,30}$/, 'Enter a valid phone number.')
  .refine(value => value.replace(/\D/g, '').length >= 7, 'Enter at least seven digits.');
export const login = z.strictObject({ email, password: z.string().min(1).max(128) });
export const registration = z.strictObject({ name, email, password });
export const customerRegistration = registration.extend({
  termsVersion: z.literal(policyVersion, 'Review and accept the current terms to continue.'),
});
export const profile = z.strictObject({ name, phone: z.union([phone, z.literal('')]) });
export const slugify = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const categoryInput = z.strictObject({
  name: z.string().trim().min(1).max(80).refine(value => Boolean(slugify(value)), 'Use at least one Latin letter or digit.'),
  description: z.string().trim().max(500).default(''),
});
export const publication = z.string().refine(value => {
  if (!value) return true;
  if (!/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) return false;
  if (value.length < 10) return true;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Use YYYY, YYYY-MM, or a valid YYYY-MM-DD date.');
export const coverPath = z.string().max(500).regex(
  /^(?:\/covers\/[a-z0-9_-]+\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif))?$/i,
  'Use a local /covers/category/filename path or leave blank.',
);
export const isbn = z.string().trim().refine(
  value => !value || /^(?:\d{9}[\dX]|\d{13})$/i.test(value.replace(/[-\s]/g, '')),
  'Enter a 10 or 13 character ISBN.',
).transform(value => value.replace(/[-\s]/g, '').toUpperCase());
export const bookInput = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title.').max(500),
  subtitle: z.string().trim().max(500).optional(),
  authors: z.array(z.string().trim().min(1).max(250)).max(30),
  publisher: z.string().trim().max(250).optional(),
  publishedDate: publication.optional(),
  category: objectId,
  isbn: isbn.optional(),
  description: z.string().trim().max(50000).optional(),
  pageCount: z.number().int().min(0).max(100000).nullable().optional(),
  language: z.string().trim().max(20).optional(),
  priceCents: z.number().int().min(0).max(MAX_PRICE),
  stock: z.number().int().min(0).max(MAX_STOCK),
  coverPath: coverPath.optional(),
});
const queryInteger = (min, max) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
export const pageQuery = z.object({ page: queryInteger(1, 10000).default(1) });
export const catalogQuery = pageQuery.extend({
  q: z.string().trim().max(120).default(''),
  category: z.string().max(80).regex(/^[a-z0-9-]+$/).optional(),
  min: queryInteger(0, MAX_PRICE).optional(),
  max: queryInteger(0, MAX_PRICE).optional(),
  availability: z.enum(['in', 'out']).optional(),
  sort: z.enum(['title', 'price-asc', 'price-desc', 'recent']).default('title'),
}).refine(query => query.min === undefined || query.max === undefined || query.min <= query.max,
  { path: ['max'], message: 'Maximum must be at least the minimum.' });
export const addLine = z.strictObject({ book: objectId, quantity: z.number().int().min(1).max(MAX_QUANTITY) });
export const lineQuantity = z.strictObject({ quantity: addLine.shape.quantity });
export const checkoutInput = z.strictObject({
  checkoutKey: z.uuid(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expectedTotalCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  delivery: z.strictObject({ name, phone, address: z.string().trim().min(8).max(500) }),
});
export const statusInput = z.strictObject({ status: z.enum(STATUSES) });
