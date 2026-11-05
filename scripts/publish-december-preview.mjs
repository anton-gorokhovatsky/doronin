import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildFiveDays } from '../prototypes/five-days/build.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public-previews/december');
const destination = path.join(root, 'site/december');
const pages = [
  'index.html', 'en/index.html',
  'december-2.html', 'en/december-2.html',
  'december-1-saved/december-1.html', 'december-1-saved/en/december-1.html',
];

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await buildFiveDays(destination);

const versions = new Map();
for (const page of pages) {
  const pageFile = path.join(destination, page);
  let html = await readFile(pageFile, 'utf8');
  if (!html.includes('name="robots" content="noindex,nofollow"')) {
    throw new Error(`Missing preview indexing policy: ${page}`);
  }
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/.test(href)) continue;
    const resource = path.resolve(destination, path.dirname(page), href);
    if (resource !== destination && !resource.startsWith(`${destination}${path.sep}`)) throw new Error(`Preview escape: ${page}: ${href}`);
    await stat(resource);
    if (/\/assets\/(?:start-day-2|five-days)\/[^/]+\.(?:js|css)$/.test(resource)) {
      if (!versions.has(resource)) versions.set(resource, createHash('sha256').update(await readFile(resource)).digest('hex').slice(0, 10));
      html = html.replaceAll(`"${href}"`, `"${href}?v=${versions.get(resource)}"`);
    }
  }
  await writeFile(pageFile, html);
}
console.log('Prepared /december/ in both languages, with five stages and the saved editions.');
