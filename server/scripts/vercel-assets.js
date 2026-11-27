import { cp } from 'node:fs/promises';
import { root } from '../config.js';

// The CDN serves the same /covers URLs used by the seeded catalog.
await cp(root + 'images', root + 'client/dist/covers', { recursive: true });
console.log('Book covers copied into the static deployment.');
