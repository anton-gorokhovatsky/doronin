import { writeFile } from 'node:fs/promises';
import { readWeather } from '../src/assets/dubai-light.js';
import { DUBAI } from '../src/assets/solar-clock.js';

const sourceUrl = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
sourceUrl.search = new URLSearchParams({ lat: DUBAI.latitude, lon: DUBAI.longitude });
const output = process.argv[2] || 'site/assets/dubai-weather.json';
const now = Date.now();
const headers = { 'User-Agent': '11111.life/1.0 (https://11111.life/)' };
const request = (url, extra = {}) => fetch(url, {
  headers: { ...headers, ...extra },
  signal: AbortSignal.timeout(15000),
});

// A push deploy starts from Git, so reuse the cache of the previous deployment.
async function previousSnapshot() {
  try {
    const response = await request('https://11111.life/assets/dubai-weather.json');
    if (!response.ok) return null;
    const saved = await response.json();
    return saved.version === 1 && saved.sourceUrl === sourceUrl.href && readWeather(saved.forecast, now) ? saved : null;
  } catch {
    return null;
  }
}

async function refresh(previous) {
  if (previous && Date.parse(previous.expires) > now) return previous;
  const response = await request(sourceUrl, previous?.lastModified ? { 'If-Modified-Since': previous.lastModified } : {});
  const expires = response.headers.get('Expires');
  if (response.status === 304 && previous) return { ...previous, expires };
  if (!response.ok) throw new Error(`MET Norway returned ${response.status}`);
  const forecast = await response.json();
  if (!readWeather(forecast, now)) throw new Error('No current hourly forecast in the MET Norway response');
  return {
    version: 1,
    source: 'MET Norway Locationforecast',
    sourceUrl: sourceUrl.href,
    expires,
    lastModified: response.headers.get('Last-Modified'),
    forecast,
  };
}

const previous = await previousSnapshot();
let snapshot;
try {
  snapshot = await refresh(previous);
} catch (error) {
  if (!previous) {
    await writeFile(output, '{"version":1,"forecast":null}\n');
    throw error;
  }
  console.warn(`${error.message}; keeping the valid published forecast`);
  snapshot = previous;
}
await writeFile(output, `${JSON.stringify(snapshot)}\n`);
console.log(`MET Norway: forecast issued ${snapshot.forecast.properties.meta.updated_at}`);
