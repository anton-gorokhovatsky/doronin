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
const plan = JSON.parse(await readFile(path.join(root, 'src/project-plan.json'), 'utf8'));
const finalStage = plan.segments.at(-1);
const startDay = Number(finalStage.startDate.slice(-2));
const endDay = Number(finalStage.endDate.slice(-2));
const finalDays = `${startDay}–${endDay}`;
const finalRow = `calendar-segment-${String(plan.segments.length).padStart(2, '0')}`;

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
// Saved editions keep their own composition while showing the current final stage.
for (const page of pages.slice(2)) {
  const file = path.join(destination, page);
  const lang = page.includes('en/') ? 'en' : 'ru';
  const en = lang === 'en';
  const values = {
    row: finalRow,
    start: finalStage.startDate,
    end: finalStage.endDate,
    days: finalDays,
    range: en ? `December ${finalDays}` : `${finalDays} декабря`,
    distance: String(finalStage.totalDistanceKm),
    deadline: en ? `By December ${endDay}:` : `К ${endDay} декабря —`,
    total: new Intl.NumberFormat(en ? 'en-US' : 'ru-RU').format(plan.targetDistanceKm).replace(/\s/gu, ' '),
  };
  const template = await readFile(file, 'utf8');
  const html = template.replace(/\{\{final-stage:([a-z]+)\}\}/g, (_, field) => {
    if (!Object.hasOwn(values, field)) throw new Error(`Unknown final-stage field in ${page}: ${field}`);
    return values[field];
  });
  await writeFile(file, html);
}
await buildFiveDays(destination, plan);

// The entry passes its version to dynamic imports. Its digest must therefore
// include those children, otherwise a controller-only change reuses an old URL.
const entry = path.join(destination, 'assets/start-day-2/day-two.js');
const currentEntry = path.join(destination, 'assets/five-days/current-day.js');
const entryDependencies = [
  path.join(destination, 'assets/start-day-2/stage-gallery.js'),
  path.join(destination, 'assets/start-day-2/stage-gallery-baseline.js'),
  path.join(destination, 'december-1-saved/assets/dubai-light.js'),
];
const versions = new Map();
async function resourceVersion(resource) {
  const hash = createHash('sha256').update(await readFile(resource));
  if (resource === entry) {
    for (const dependency of entryDependencies) hash.update(await readFile(dependency));
  }
  if (resource === currentEntry) hash.update(await readFile(path.join(destination, 'assets/five-days/current-day-layout.js')));
  return hash.digest('hex').slice(0, 10);
}
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
    if (/\/assets\/(?:start-day|start-day-2|five-days)\/[^/]+\.(?:js|css)$/.test(resource)) {
      if (!versions.has(resource)) versions.set(resource, await resourceVersion(resource));
      html = html.replaceAll(`"${href}"`, `"${href}?v=${versions.get(resource)}"`);
    }
  }
  await writeFile(pageFile, html);
}
console.log('Prepared /december/ in both languages, with five stages and the saved editions.');
