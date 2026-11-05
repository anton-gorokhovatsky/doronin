import { writeFile } from 'node:fs/promises';
import { readDust } from '../src/assets/dubai-light.js';
import { readDustMetadata, readDustAscii } from './lib/dust-data.mjs';
const base = 'https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/fcast/tavg3_2d_aer_Nx';
const get = async (url, timeout = 20000) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': '11111.life environmental display (https://11111.life)' } });
  if (!response.ok) throw new Error(`NASA returned ${response.status}`);
  const text = await response.text();
  if (text.length > 250000) throw new Error('Unexpected NASA response size');
  return text;
};
const now = Date.now();
async function latestForecast() {
  const directory = await get(base);
  const runs = [...new Set([...directory.matchAll(/tavg3_2d_aer_Nx\.(\d{8}_\d{2})/g)].map(m => m[1]))].sort().reverse();
  for (const run of runs.slice(0, 4)) {
    const issuedAt = `${run.slice(0,4)}-${run.slice(4,6)}-${run.slice(6,8)}T${run.slice(9)}:00:00Z`;
    if (Date.parse(issuedAt) > now || now - Date.parse(issuedAt) > 72 * 3600000) continue;
    const sourceUrl = `${base}/tavg3_2d_aer_Nx.${run}`;
    try {
      const meta = readDustMetadata(await get(`${sourceUrl}.das`));
      if (meta.start > now || meta.start + meta.count * meta.step * 60000 <= now) continue;
      meta.count = Math.min(meta.count, 41);
      const slice = `[0:1:${meta.count - 1}][461][753]`;
      const data = await get(`${sourceUrl}.ascii?${encodeURI(`dusmass${slice},duexttau${slice}`).replaceAll('[', '%5B').replaceAll(']', '%5D')}`, 60000);
      const snapshot = { version: 1, source: 'NASA GEOS-FP', sourceUrl: `${sourceUrl}.info`, issuedAt, fetchedAt: new Date(now).toISOString(), grid: { latitude: 25.25, longitude: 55.3125 }, intervalMinutes: 180, points: readDustAscii(data, meta) };
      if (readDust(snapshot, now)) return snapshot;
    } catch (error) { console.error(`${run}: ${error.message}`); }
  }
  throw new Error('No fresh NASA run covers this hour');
}
let result;
try {
  result = await latestForecast();
} catch (error) {
  const previous = JSON.parse(await get('https://11111.life/assets/dubai-dust.json'));
  if (!readDust(previous, now)) throw error;
  console.warn(`${error.message}; keeping the valid published dust forecast`);
  result = previous;
}
await writeFile(process.argv[2] || 'src/assets/dubai-dust.json', `${JSON.stringify(result)}\n`);
console.log(`NASA dust: ${result.points.length} points, run ${result.issuedAt}`);
