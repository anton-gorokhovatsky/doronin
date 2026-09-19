import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { dubaiClock, solarPosition, lightPalette, readWeather, readOutlook } from '../src/assets/dubai-light.js';
import { solarTheme } from '../src/assets/solar-clock.js';
import { startSiteServer } from './lib/site-server.mjs';
import { checkRenderedTextContrast } from './lib/rendered-contrast.mjs';

// Independent civil-time and published astronomical checkpoints.
assert.deepEqual(dubaiClock(new Date('2026-11-30T20:15:00Z')), { date: '2026-12-01', minutes: 15 });
assert.deepEqual(dubaiClock(new Date('2026-12-31T20:00:00Z')), { date: '2027-01-01', minutes: 0 });
const december = solarPosition('2026-12-01', 720);
assert(Math.abs(december.sunrise - 407) < 3 && Math.abs(december.sunset - 1048) < 3);
assert(december.altitude > 42 && december.altitude < 44);
assert.equal(solarPosition('2026-12-01', 1260).sunrise, december.sunrise);
assert.equal(solarPosition('2026-12-01', 420).sunset, december.sunset);
assert.equal(solarPosition('2026-12-01', 420).phase, 'dawn');
assert.equal(solarPosition('2026-12-01', 1035).phase, 'sunset');
assert.equal(solarPosition('2026-12-01', 1260).phase, 'night');
assert.equal(solarTheme('2026-09-19', 18 * 60 + 25), 'light', 'Evening civil twilight is not yet the night theme');
assert.equal(solarTheme('2026-09-19', 18 * 60 + 45), 'dark', 'Night begins after civil twilight');
for (const date of ['2026-09-19', '2026-12-01', '2026-12-31']) {
  for (let minute = 0; minute < 1440; minute++) {
    assert.equal(solarTheme(date, minute) === 'dark', solarPosition(date, minute).phase === 'night', 'Theme and sunlight share dawn and dusk boundaries');
  }
}
const now = Date.parse('2026-09-12T09:00:00Z');
const forecastAt = (time, details = {}) => ({
  time: new Date(time).toISOString(),
  data: { instant: { details: { cloud_area_fraction: 80, wind_speed: 4, wind_from_direction: 270, air_temperature: 42, apparent_air_temperature: 46, relative_humidity: 75, ultraviolet_index_clear_sky: 6.3, ...details } } },
});
const fresh = { properties: {
  meta: { updated_at: new Date(now - 3600000).toISOString() },
  timeseries: [forecastAt(now), forecastAt(now + 3600000, { cloud_area_fraction: 10 })],
} };
const outlook = { properties: { ...fresh.properties, timeseries: [
  ...fresh.properties.timeseries,
  ...[2, 4, 6].map((hour, index) => forecastAt(now + hour * 3600000, { air_temperature: 40 - index, apparent_air_temperature: 44 - index, relative_humidity: 65 + index * 5 })),
] } };
assert(readWeather(fresh, now));
assert.equal(readWeather(fresh, now + 151 * 60000), null);
assert.equal(readWeather(fresh, now + 3600000).cloudCover, 10, 'Move to the forecast for the new hour');
const withSeries = timeseries => ({ properties: { ...fresh.properties, timeseries } });
assert.equal(readWeather(withSeries([forecastAt(now, { cloud_area_fraction: null })]), now), null);
assert.equal(readWeather(withSeries([forecastAt(now + 3600000)]), now), null);
assert.equal(readWeather(withSeries([null, {}]), now), null);
assert.equal(readWeather({ properties: { ...fresh.properties, meta: { updated_at: new Date(now - 19 * 3600000).toISOString() } } }, now), null);
assert.equal(readWeather({ properties: { ...fresh.properties, meta: { updated_at: new Date(now + 3600000).toISOString() } } }, now), null);
const weather = readWeather(fresh, now);
assert(lightPalette('2026-12-01', 720, weather).strength < lightPalette('2026-12-01', 720).strength);
assert.equal(readWeather(withSeries([forecastAt(now, { ultraviolet_index_clear_sky: null })]), now).uvClearSky, null);
assert.equal(readWeather(withSeries([forecastAt(now, { air_temperature: null })]), now).temperature, null);
const clearHot = { ...weather, cloudCover: 0 };
assert(lightPalette('2026-09-12', 720, clearHot).mediaSaturation < lightPalette('2026-09-12', 720).mediaSaturation);
assert(lightPalette('2026-09-12', 720, { ...clearHot, windSpeed: 10 }).airDuration < lightPalette('2026-09-12', 720, { ...clearHot, windSpeed: 1 }).airDuration);
assert.equal(readWeather(withSeries([forecastAt(now, { relative_humidity: 101, apparent_air_temperature: null })]), now).humidity, null);
assert.equal(readWeather(withSeries([forecastAt(now, { relative_humidity: 0 })]), now).humidity, 0, 'A zero humidity is a value, not missing data');
const humid = lightPalette('2026-09-12', 720, { ...clearHot, humidity: 90 });
const dry = lightPalette('2026-09-12', 720, { ...clearHot, humidity: 30 });
assert(humid.diffusion > dry.diffusion && humid.mediaContrast < dry.mediaContrast);
assert.equal(humid.dustOpacity, dry.dustOpacity, 'Humidity does not manufacture dust');
assert.deepEqual(readOutlook(outlook, now + 59 * 60000).map(period => period.reading.temperature), [40, 39, 38], 'Forecast slots use civil hours');
const missing = readOutlook(withSeries([forecastAt(now + 2 * 3600000), forecastAt(now + 3 * 3600000), forecastAt(now + 6 * 3600000, { relative_humidity: null })]), now);
assert.equal(missing[1].reading, null, 'Do not interpolate a missing forecast hour');
assert.equal(missing[2].reading.humidity, null, 'An absent optional measure leaves the other forecast values usable');
assert.equal(readOutlook(withSeries([forecastAt(now + 2 * 3600000), forecastAt(now + 2 * 3600000)]), now)[0].reading, null, 'Conflicting duplicate slots are not published');
assert(readOutlook({ properties: { ...outlook.properties, meta: { updated_at: new Date(now - 19 * 3600000).toISOString() } } }, now).every(period => !period.reading));
const midnight = Date.parse('2026-12-31T19:45:00Z');
assert.deepEqual(readOutlook(null, midnight).map(period => dubaiClock(new Date(period.timestamp))), [
  { date: '2027-01-01', minutes: 60 }, { date: '2027-01-01', minutes: 180 }, { date: '2027-01-01', minutes: 300 },
]);

const out = 'tmp/dubai-light-check';
await mkdir(out, { recursive: true });
const server = await startSiteServer(process.argv[2] || 'preview');
const report = [];
const readControlGeometry = page => page.evaluate(() => {
  const selectors = ['.dubai-light__modes', '#dubai-time', '.site-footer__wordmark'];
  return selectors.map(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return { selector, top: rect.top + scrollY, left: rect.left, width: rect.width };
  });
});
const settleLayout = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const settleInitialLayout = page => page.evaluate(async () => {
  await Promise.all([
    document.fonts.load('700 32px Micra', 'ДA1'),
    document.fonts.load('400 16px Commissioner', 'ЯA'),
  ]);
  await document.fonts.ready;
  let previous = '';
  let unchangedSince = performance.now();
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const current = JSON.stringify(['.hero', '.dubai-light__modes', '#dubai-time', '.site-footer__wordmark'].map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [r.top + scrollY, r.width, r.height];
    }));
    if (current !== previous) { previous = current; unchangedSince = performance.now(); }
    if (document.fonts.status === 'loaded' && performance.now() - unchangedSince >= 250) return;
  }
  throw new Error('The initial page layout did not settle before the mode comparison');
});
const assertStableControls = (before, after, label) => {
  before.forEach((first, index) => {
    for (const property of ['top', 'left', 'width']) {
      assert(Math.abs(first[property] - after[index][property]) <= 1,
        `${label}: ${first.selector} ${property} moved from ${first[property]} to ${after[index][property]}`);
    }
  });
};
try {
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      for (const locale of ['ru', 'en']) {
        for (const spec of [
          { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
          { name: 'desktop-dark', width: 1440, height: 900, theme: 'dark' },
          { name: 'mobile', width: 390, height: 844, theme: 'light' },
          { name: 'narrow-200', width: 320, height: 844, theme: 'dark', text: 200 },
        ]) {
          const context = await browser.newContext({ viewport: spec, reducedMotion: spec.text ? 'reduce' : 'no-preference' });
          const page = await context.newPage();
          await page.clock.setFixedTime(new Date(now));
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('https://mc.yandex.ru/**', route => route.abort());
          let weatherRequests = 0;
          await page.route('https://api.met.no/**', route => {
            weatherRequests++;
            const url = new URL(route.request().url());
            assert.equal(url.searchParams.get('lat'), '25.1654');
            assert.equal(url.searchParams.get('lon'), '55.2851');
            return route.fulfill({ json: outlook, headers: { Expires: new Date(now + 90 * 60000).toUTCString() } });
          });
          await page.goto(`${server.origin}/${locale === 'en' ? 'en/' : ''}?theme=${spec.theme}${spec.text ? '&text=200' : ''}#dubai-light`);
          await page.evaluate(() => document.fonts.ready);
          const widget = page.locator('[data-dubai-controls]');
          await widget.waitFor({ state: 'visible' });
          const slider = page.locator('#dubai-time');
          await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'fresh');
          assert.equal(await page.locator('html').getAttribute('data-dubai-mode'), 'current', 'Current local conditions are the default');
          assert(await slider.isDisabled());
          assert.deepEqual(await page.locator('[data-outlook-time]').allTextContents(), ['15:00', '17:00', '19:00']);
          assert.deepEqual(await page.locator('[data-outlook-humidity]').allTextContents(), ['65%', '70%', '75%']);
          assert.equal(await page.locator('[data-outlook-list]').getAttribute('aria-hidden'), 'false');
          await page.locator('button[data-dubai-mode="preview"]').click();
          if (spec.text) await page.waitForFunction(() => document.documentElement.classList.contains('text-enlarged'));
          await widget.scrollIntoViewIfNeeded();
          await settleInitialLayout(page);
          const controlGeometry = await readControlGeometry(page);
          for (const [phase, minutes] of [['dawn', 420], ['day', 720], ['sunset', 1035], ['night', 1260]]) {
            await slider.evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, minutes);
            await settleLayout(page);
            assertStableControls(controlGeometry, await readControlGeometry(page), `${engineName}/${locale}/${spec.name}/${phase}`);
            assert.equal(await page.locator('html').getAttribute('data-dubai-light'), phase);
            assert.equal(await page.locator('html').getAttribute('data-dubai-mode'), 'preview');
            assert.equal(await widget.getAttribute('data-weather'), 'preview');
            assert.equal(await page.locator('html').evaluate(el => el.classList.contains('theme-dark')), spec.theme === 'dark');
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            assert(!overflow, `${engineName}/${locale}/${spec.name}/${phase} overflows`);
            if (phase === 'sunset' || (phase === 'night' && spec.name.startsWith('desktop'))) {
              await widget.scrollIntoViewIfNeeded();
              await page.screenshot({ path: `${out}/${engineName}-${locale}-${spec.name}-${phase}.png` });
              if (engineName === 'chromium') {
                const result = await new AxeBuilder({ page }).include('#dubai-light').analyze();
                assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
              }
            }
          }
          await slider.focus();
          await page.keyboard.press('Home');
          assert.equal(await slider.inputValue(), '0');
          await page.keyboard.press('ArrowRight');
          assert.equal(await slider.inputValue(), '1');
          assert.equal(weatherRequests, 1, 'Today’s forecast is fetched once and remains independent of the December light preview');
          await page.locator('button[data-dubai-mode="current"]').click();
          await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'fresh');
          await settleLayout(page);
          assertStableControls(controlGeometry, await readControlGeometry(page), `${engineName}/${locale}/${spec.name}/current`);
          assert(await slider.isDisabled());
          assert.equal(await page.locator('[data-dubai-clock]').textContent(), '13:00');
          const forecastSource = page.locator('[data-dubai-source-link]');
          assert.equal(await forecastSource.getAttribute('hidden'), null, `${engineName}/${locale}/${spec.name}: current forecast source stays hidden`);
          await forecastSource.waitFor({ state: 'visible', timeout: 1000 });
          const visibleCopy = (await widget.locator('.dubai-light__intro, .dubai-light__mode, .dubai-light__time, .dubai-light__sun-times, .dubai-light__source').allInnerTexts()).join(' ');
          assert.equal(visibleCopy.match(locale === 'ru' ? /Дуба/gu : /Dubai/gu)?.length, 1, 'The city is named only once in the visible widget');
          assert((await page.locator('[data-dubai-mode-label]').innerText()).includes('2026'));
          const source = await page.locator('[data-outlook-issued]').boundingBox();
          const link = await page.locator('[data-dubai-source-link]').boundingBox();
          assert(link.x >= source.x + source.width + 15 || link.y >= source.y + source.height + 3, 'Forecast and credit remain separate readable items');
          if (spec.name === 'mobile') await page.screenshot({ path: `${out}/${engineName}-${locale}-current-weather.png` });
          // Reuse the forecast across reloads and pick the right hour before Expires.
          if (locale === 'ru' && spec.name === 'desktop-light') {
            await page.reload();
            await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'fresh');
            assert.equal(weatherRequests, 1, 'Reload reuses the unexpired forecast');
            await page.clock.setFixedTime(new Date(now + 3600000));
            await page.locator('button[data-dubai-mode="preview"]').click();
            await page.locator('button[data-dubai-mode="current"]').click();
            assert.equal(await page.locator('[data-dubai-clock]').textContent(), '14:00');
            assert((await page.locator('[data-dubai-source]').innerText()).includes('14:00'));
            assert.equal(weatherRequests, 1, 'No request before the provider expiry');
            await page.clock.setFixedTime(new Date(now));
          }
          await page.locator('button[data-dubai-mode="preview"]').click();
          await settleLayout(page);
          assertStableControls(controlGeometry, await readControlGeometry(page), `${engineName}/${locale}/${spec.name}/return-preview`);
          assert(await slider.isEnabled());
          assert.equal(await widget.getAttribute('data-weather'), 'preview');
          assert(await forecastSource.isVisible(), 'The dated forecast and its attribution remain available while previewing December sunlight');
          assert.deepEqual(await page.locator('[data-outlook-air]').allTextContents(), ['+40°', '+39°', '+38°']);
          await page.locator('.menu-toggle').click();
          const menuWeather = page.locator('[data-menu-weather]');
          await menuWeather.waitFor({ state: 'visible' });
          assert.equal(await menuWeather.getAttribute('data-weather'), 'fresh');
          assert.equal(await page.locator('[data-menu-weather-air]').innerText(), '+42°');
          assert(await page.locator('[data-menu-weather-heat]').isVisible());
          assert.equal(await page.locator('[data-menu-weather-feels-value]').innerText(), '+46°');
          assert.equal(await page.locator('html').getAttribute('data-dubai-mode'), 'preview', 'Today’s menu forecast does not switch the December preview');
          await menuWeather.scrollIntoViewIfNeeded();
          assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
          if (spec.width <= 960) {
            const underlay = await page.evaluate(() => {
              const root = document.documentElement;
              const header = document.querySelector('.site-header');
              const phase = root.dataset.dubaiLight;
              const illuminated = getComputedStyle(header, '::before').backgroundColor;
              delete root.dataset.dubaiLight;
              const original = getComputedStyle(header, '::before').backgroundColor;
              root.dataset.dubaiLight = phase;
              return { illuminated, original };
            });
            assert.equal(underlay.illuminated, underlay.original, 'Sunlight must preserve the mobile menu base underlay');
          }
          await page.screenshot({ path: `${out}/${engineName}-${locale}-${spec.name}-menu-weather.png` });
          if (engineName === 'chromium') {
            const audit = new AxeBuilder({ page }).include('.menu-weather');
            if (spec.width <= 960) {
              // The mobile menu shares a fixed header pseudo-element. Axe can read
              // the inert page beneath it; audit contrast against rendered pixels.
              audit.disableRules(['color-contrast']);
              await checkRenderedTextContrast(page, '.menu-weather');
            }
            const result = await audit.analyze();
            assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
          }
          await page.locator('.menu-weather__forecast-link').click();
          await page.waitForFunction(() => !document.querySelector('.nav-shell').open && location.hash === '#dubai-forecast');
          assert(await page.locator('#dubai-forecast').isVisible());
          assert.deepEqual(errors, []);
          report.push({ engineName, locale, ...spec, result: 'PASS' });
          await context.close();
        }
      }
      for (const failure of ['network', 'stale', 'storage']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await page.clock.setFixedTime(new Date(now));
        if (failure === 'storage') await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage disabled'); } }));
        await page.route('https://api.met.no/**', route => failure === 'network' ? route.abort() : route.fulfill({ json: failure === 'storage' ? fresh : withSeries([forecastAt(now - 7200000)]) }));
        await page.goto(`${server.origin}/#dubai-light`);
        await page.locator('[data-dubai-controls]').waitFor({ state: 'visible' });
        await page.locator('button[data-dubai-mode="current"]').click();
        await page.waitForFunction(expected => document.querySelector('[data-dubai-controls]').dataset.weather === expected, failure === 'storage' ? 'fresh' : 'unavailable');
        assert.equal(await page.locator('[data-dubai-clock]').textContent(), '13:00');
        assert(await page.locator('h1').isVisible());
        assert.equal(await page.locator('[data-dubai-source-link]').isVisible(), failure === 'storage');
        assert.equal(await page.locator('[data-outlook-state]').isVisible(), true, 'A missing future series has an explicit state even when current weather exists');
        await page.locator('.menu-toggle').click();
        await page.locator('[data-menu-weather]').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-menu-weather-readings]').isVisible(), failure === 'storage');
        await page.close();
      }
      // Loading, missing fields and the date boundary must not move the footer.
      const delayed = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await delayed.clock.setFixedTime(new Date(midnight));
      let releaseForecast;
      const pending = new Promise(resolve => { releaseForecast = resolve; });
      const midnightForecast = { properties: {
        meta: { updated_at: new Date(midnight - 3600000).toISOString() },
        timeseries: [forecastAt(midnight - 45 * 60000), ...readOutlook(null, midnight).map(({ timestamp }, index) => forecastAt(timestamp, index === 1 ? { relative_humidity: null, apparent_air_temperature: null } : {}))],
      } };
      await delayed.route('https://api.met.no/**', async route => { await pending; return route.fulfill({ json: midnightForecast }); });
      await delayed.goto(`${server.origin}/#dubai-forecast`);
      await delayed.locator('[data-dubai-controls]').waitFor({ state: 'visible' });
      await settleInitialLayout(delayed);
      const loadingGeometry = await readControlGeometry(delayed);
      assert(await delayed.locator('[data-outlook-state]').isVisible());
      releaseForecast();
      await delayed.waitForFunction(() => document.querySelector('[data-outlook-list]').getAttribute('aria-hidden') === 'false');
      await settleLayout(delayed);
      assertStableControls(loadingGeometry, await readControlGeometry(delayed), `${engineName}/forecast-arrival`);
      assert.deepEqual(await delayed.locator('[data-outlook-time]').allTextContents(), ['01:00', '03:00', '05:00']);
      assert.deepEqual(await delayed.locator('[data-outlook-day]').allTextContents(), ['Завтра', 'Завтра', 'Завтра']);
      assert.equal(await delayed.locator('[data-outlook-humidity]').nth(1).innerText(), '—');
      assert.equal(await delayed.locator('[data-outlook-feels]').nth(1).innerText(), '—');
      await delayed.close();
      const noJs = await browser.newPage({ javaScriptEnabled: false });
      await noJs.goto(server.origin);
      assert(await noJs.locator('h1').isVisible());
      assert(await noJs.locator('[data-dubai-controls]').isHidden());
      assert(await noJs.locator('[data-menu-weather]').isHidden());
      await noJs.close();
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log('Dubai light: solar checkpoints, track coordinates, both locales/themes, keyboard, reflow, weather expiry/cache, fresh/stale/offline data, copy grouping, storage and no-JS PASS');
