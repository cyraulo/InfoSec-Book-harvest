import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { root } from '../config.js';
import { coverPath } from '../validation.js';

// The CDN serves the same /covers URLs used by the seeded catalog.
let copied = 0;
for (const category of await readdir(root + 'images', { withFileTypes: true })) {
  if (!category.isDirectory() || !/^[a-z0-9_-]+$/i.test(category.name)) continue;
  const source = root + 'images/' + category.name;
  const destination = root + 'client/dist/covers/' + category.name;
  await mkdir(destination, { recursive: true });
  for (const file of await readdir(source, { withFileTypes: true })) {
    if (!file.isFile() || !coverPath.safeParse('/covers/' + category.name + '/' + file.name).success) continue;
    await copyFile(source + '/' + file.name, destination + '/' + file.name);
    copied += 1;
  }
}
console.log(copied + ' book covers copied into the static deployment.');
