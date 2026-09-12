import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { dubaiClock, solarPosition, lightPalette, readWeather } from '../src/assets/dubai-light.js';
import { startSiteServer } from './lib/site-server.mjs';

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
const fresh = { current: { time: now / 1000, cloud_cover: 80, visibility: 8000, wind_speed_10m: 4, wind_direction_10m: 270 } };
assert(readWeather(fresh, now));
assert.equal(readWeather(fresh, now + 91 * 60000), null);
assert.equal(readWeather({ current: { ...fresh.current, cloud_cover: null } }, now), null);
assert.equal(readWeather({ current: { ...fresh.current, time: now / 1000 + 3600 } }, now), null);
const weather = readWeather(fresh, now);
assert(lightPalette('2026-12-01', 720, weather).strength < lightPalette('2026-12-01', 720).strength);

const out = 'tmp/dubai-light-check';
await mkdir(out, { recursive: true });
const server = await startSiteServer(process.argv[2] || 'preview');
const report = [];
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
          await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: fresh }));
          await page.goto(`${server.origin}/${locale === 'en' ? 'en/' : ''}?theme=${spec.theme}${spec.text ? '&text=200' : ''}#dubai-light`);
          await page.evaluate(() => document.fonts.ready);
          const widget = page.locator('[data-dubai-controls]');
          await widget.waitFor({ state: 'visible' });
          const slider = page.locator('#dubai-time');
          for (const [phase, minutes] of [['dawn', 420], ['day', 720], ['sunset', 1035], ['night', 1260]]) {
            await slider.evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, minutes);
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
          await page.locator('[data-dubai-mode="current"]').click();
          await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'fresh');
          assert(await slider.isDisabled());
          assert.equal(await page.locator('[data-dubai-clock]').textContent(), '13:00');
          assert(await page.locator('[data-dubai-source-link]').isVisible());
          await page.locator('[data-dubai-mode="preview"]').click();
          assert(await slider.isEnabled());
          assert.equal(await widget.getAttribute('data-weather'), 'preview');
          assert(await page.locator('[data-dubai-source-link]').isHidden());
          assert.deepEqual(errors, []);
          report.push({ engineName, locale, ...spec, result: 'PASS' });
          await context.close();
        }
      }
      for (const failure of ['network', 'stale', 'storage']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await page.clock.setFixedTime(new Date(now));
        if (failure === 'storage') await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage disabled'); } }));
        await page.route('https://api.open-meteo.com/**', route => failure === 'network' ? route.abort() : route.fulfill({ json: { current: { ...fresh.current, time: now / 1000 - 7200 } } }));
        await page.goto(`${server.origin}/#dubai-light`);
        await page.locator('[data-dubai-controls]').waitFor({ state: 'visible' });
        await page.locator('[data-dubai-mode="current"]').click();
        await page.waitForFunction(() => document.querySelector('[data-dubai-controls]').dataset.weather === 'unavailable');
        assert.equal(await page.locator('[data-dubai-clock]').textContent(), '13:00');
        assert(await page.locator('h1').isVisible());
        assert(await page.locator('[data-dubai-source-link]').isHidden());
        await page.close();
      }
      const noJs = await browser.newPage({ javaScriptEnabled: false });
      await noJs.goto(server.origin);
      assert(await noJs.locator('h1').isVisible());
      assert(await noJs.locator('[data-dubai-controls]').isHidden());
      await noJs.close();
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log('Dubai light: solar checkpoints, both locales/themes, keyboard, reflow, fresh/stale/offline weather, storage and no-JS PASS');
