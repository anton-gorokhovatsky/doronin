import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { dubaiClock, solarPosition, lightPalette, readWeather } from '../src/assets/dubai-light.js';
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
const now = Date.parse('2026-09-12T09:00:00Z');
const forecastAt = (time, details = {}) => ({
  time: new Date(time).toISOString(),
  data: { instant: { details: { cloud_area_fraction: 80, wind_speed: 4, wind_from_direction: 270, air_temperature: 42, ultraviolet_index_clear_sky: 6.3, ...details } } },
});
const fresh = { properties: {
  meta: { updated_at: new Date(now - 3600000).toISOString() },
  timeseries: [forecastAt(now), forecastAt(now + 3600000, { cloud_area_fraction: 10 })],
} };
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
            return route.fulfill({ json: fresh, headers: { Expires: new Date(now + 90 * 60000).toUTCString() } });
          });
          await page.goto(`${server.origin}/${locale === 'en' ? 'en/' : ''}?theme=${spec.theme}${spec.text ? '&text=200' : ''}#dubai-light`);
          await page.evaluate(() => document.fonts.ready);
          const widget = page.locator('[data-dubai-controls]');
          await widget.waitFor({ state: 'visible' });
          const slider = page.locator('#dubai-time');
          await settleLayout(page);
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
          assert.equal(weatherRequests, 0, 'Future sunlight does not request a weather forecast');
          await page.locator('[data-dubai-mode="current"]').click();
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
          const source = await page.locator('[data-dubai-source]').boundingBox();
          const link = await page.locator('[data-dubai-source-link]').boundingBox();
          assert(link.x >= source.x + source.width + 15 || link.y >= source.y + source.height + 3, 'Forecast and credit remain separate readable items');
          if (spec.name === 'mobile') await page.screenshot({ path: `${out}/${engineName}-${locale}-current-weather.png` });
          // Reuse the forecast across reloads and pick the right hour before Expires.
          if (locale === 'ru' && spec.name === 'desktop-light') {
            await page.reload();
            await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'fresh');
            assert.equal(weatherRequests, 1, 'Reload reuses the unexpired forecast');
            await page.clock.setFixedTime(new Date(now + 3600000));
            await page.locator('[data-dubai-mode="preview"]').click();
            await page.locator('[data-dubai-mode="current"]').click();
            assert.equal(await page.locator('[data-dubai-clock]').textContent(), '14:00');
            assert((await page.locator('[data-dubai-source]').innerText()).includes('14:00'));
            assert.equal(weatherRequests, 1, 'No request before the provider expiry');
          }
          await page.locator('[data-dubai-mode="preview"]').click();
          await settleLayout(page);
          assertStableControls(controlGeometry, await readControlGeometry(page), `${engineName}/${locale}/${spec.name}/return-preview`);
          assert(await slider.isEnabled());
          assert.equal(await widget.getAttribute('data-weather'), 'preview');
          assert.equal(await forecastSource.getAttribute('hidden'), '', `${engineName}/${locale}/${spec.name}: preview keeps the forecast source enabled`);
          await forecastSource.waitFor({ state: 'hidden', timeout: 1000 });
          await page.locator('.menu-toggle').click();
          const menuWeather = page.locator('[data-menu-weather]');
          await menuWeather.waitFor({ state: 'visible' });
          assert.equal(await menuWeather.getAttribute('data-weather'), 'fresh');
          assert.equal(await page.locator('[data-menu-weather-air]').innerText(), '+42°');
          assert(await page.locator('[data-menu-weather-heat]').isVisible());
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
          await page.locator('.menu-toggle').click();
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
        await page.locator('[data-dubai-mode="current"]').click();
        await page.waitForFunction(expected => document.querySelector('[data-dubai-controls]').dataset.weather === expected, failure === 'storage' ? 'fresh' : 'unavailable');
        assert.equal(await page.locator('[data-dubai-clock]').textContent(), '13:00');
        assert(await page.locator('h1').isVisible());
        assert.equal(await page.locator('[data-dubai-source-link]').isVisible(), failure === 'storage');
        await page.locator('.menu-toggle').click();
        await page.locator('[data-menu-weather]').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-menu-weather-readings]').isVisible(), failure === 'storage');
        await page.close();
      }
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
