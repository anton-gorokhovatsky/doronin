import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public-previews/december');
const destination = path.join(root, 'site/december');
const pages = [
  'december-2.html', 'en/december-2.html',
  'december-1-saved/december-1.html', 'december-1-saved/en/december-1.html',
];

// The preview owns its assets and clock. Rebuilding November must not change it.
for (const page of pages) {
  const html = await readFile(path.join(source, page), 'utf8');
  if (!html.includes('name="robots" content="noindex,nofollow"')) {
    throw new Error(`Missing preview indexing policy: ${page}`);
  }
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/.test(href)) continue;
    const resource = path.resolve(source, path.dirname(page), href);
    if (!resource.startsWith(`${source}${path.sep}`)) throw new Error(`Preview escape: ${page}: ${href}`);
    await stat(resource);
  }
}
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log('Published separate December preview to site/december (RU/EN; December 1 and 2).');
