import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { parse as csv } from 'csv-parse/sync';
import { config, root } from '../config.js';
import { Book, Category, connect, MAX_PRICE } from '../models.js';
import { bookInput, coverPath, slugify } from '../validation.js';
import { saveBook } from '../services/catalog.js';

const headers = 'book_id,title,subtitle,authors,publisher,published_date,category,google_categories,isbn,description,page_count,language,average_rating,ratings_count,price,image_path,cover_source_url,google_books_url'.split(',');
const names = { self_help: 'Self-help', science_fiction: 'Science fiction' };
const split = value => [...new Set(value.split(',').map(part => part.trim()).filter(Boolean))];
function number(value, max, integer = true) {
  if (value === '') return undefined;
  if (!(integer ? /^\d+$/ : /^\d+(?:\.\d+)?$/).test(value) || Number(value) > max) {
    throw new Error('Invalid numeric field.');
  }
  return Number(value);
}
function price(value) {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid price.');
  const [units, fraction = ''] = value.split('.');
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > MAX_PRICE) throw new Error('Price exceeds the supported maximum.');
  return cents;
}
function webUrl(value) {
  if (!value) return '';
  if (!['https:', 'http:'].includes(new URL(value).protocol)) throw new Error('Invalid source URL.');
  return value;
}
export async function seedCatalog(filename = root + 'dataset/books.csv') {
  const rows = csv(await readFile(filename), { bom: true, columns: columns => {
    if (columns.length !== headers.length || columns.some((name, i) => name !== headers[i])) {
      throw new Error('CSV header does not match the expected catalog fields.');
    }
    return columns;
  }, skip_empty_lines: true });
  const report = { imported: 0, updated: 0, skipped: 0, invalid: 0, missingCovers: 0, problems: [] };
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    try {
      const externalId = row.book_id.trim();
      if (!/^[\w-]{1,100}$/.test(externalId)) throw new Error('Invalid external ID.');
      if (seen.has(externalId)) throw new Error('Duplicate external ID within CSV.');
      seen.add(externalId);
      if (await Book.exists({ externalId })) {
        report.skipped += 1;
        continue;
      }
      if (!/^[a-z][a-z0-9_]*$/.test(row.category)) throw new Error('Invalid category.');
      const image = row.image_path.replace(/^images\//, '/covers/');
      let cover = coverPath.safeParse(image).success ? image : '';
      if (cover && !(await stat(root + cover.replace(/^\/covers\//, 'images/')).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      }))?.isFile()) cover = '';
      if (!cover) report.missingCovers += 1;
      const fields = bookInput.parse({
        title: row.title, subtitle: row.subtitle, authors: split(row.authors), publisher: row.publisher,
        publishedDate: row.published_date.replace(/^(\d{4}-\d{2}-\d{2})T\d\d:\d\d:\d\dZ$/, '$1'),
        category: '0'.repeat(24), isbn: row.isbn, description: row.description,
        pageCount: number(row.page_count, 100000), language: row.language,
        priceCents: price(row.price), stock: 12, coverPath: cover,
      });
      const metadata = { averageRating: number(row.average_rating, 5, false),
        ratingsCount: number(row.ratings_count, 1_000_000_000), googleCategories: split(row.google_categories),
        coverSourceUrl: webUrl(row.cover_source_url), googleBooksUrl: webUrl(row.google_books_url) };
      const name = names[row.category] ?? row.category[0].toUpperCase() + row.category.slice(1).replaceAll('_', ' ');
      const slug = slugify(name);
      const now = new Date();
      const category = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { slug, name, createdAt: now, updatedAt: now } },
        { upsert: true, new: true, runValidators: true, timestamps: false, overwriteImmutable: true });
      await saveBook(null, { ...fields, ...metadata, category: category.id, externalId });
      report.imported += 1;
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.externalId) {
        report.skipped += 1;
      } else if (error.name === 'ZodError' || error.name === 'ValidationError' || !error.code && error.constructor === Error && !error.errorLabels) {
        report.invalid += 1;
        report.problems.push({ row: index + 2, issue: error.issues?.map(issue => issue.path.join('.') + ': ' + issue.message).join('; ') ?? error.message });
      } else {
        throw error;
      }
    }
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connect(config.mongoUri);
    const report = await seedCatalog(process.argv[2]);
    console.log(JSON.stringify(report, null, 2));
    if (report.invalid) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
