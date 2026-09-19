import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';
import { checkRenderedTextContrast } from './lib/rendered-contrast.mjs';
const server = await startSiteServer(process.argv[2] || 'preview');
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      for (const [clock, expected, device] of [
        ['2026-09-19T08:00:00Z', 'light', 'dark'],
        ['2026-09-19T19:00:00Z', 'dark', 'light'],
      ]) {
        const page = await browser.newPage({ colorScheme: device, reducedMotion: 'reduce' });
        await page.clock.setFixedTime(new Date(clock));
        await page.route('https://api.met.no/**', r => r.abort());
        await page.route('https://mc.yandex.ru/**', r => r.abort());
        await page.goto(server.origin);
        await page.waitForFunction(() => document.documentElement.dataset.dubaiMode === 'current');
        const resolved = () => page.locator('html').evaluate(el => el.classList.contains('theme-dark') ? 'dark' : 'light');
        assert.equal(await resolved(), expected, `${name}: automatic appearance must follow Dubai, regardless of device or weather`);
        await page.emulateMedia({colorScheme: expected});
        assert.equal(await resolved(), expected);
        assert.equal(await page.locator('.site-nav__settings [data-theme-option="auto"]').getAttribute('aria-pressed'), 'true');
        await page.locator('button[data-dubai-mode="preview"]').click();
        const time = page.locator('#dubai-time');
        const preview = async minutes => {
          await time.evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input', {bubbles:true})); }, String(minutes));
        };
        await preview(1260); assert.equal(await resolved(), 'dark');
        await preview(720); assert.equal(await resolved(), 'light');
        await page.locator('.site-footer [data-theme-option="dark"]').click();
        await preview(720); assert.equal(await resolved(), 'dark', 'Manual dark survives a daytime preview');
        await page.reload(); assert.equal(await resolved(), 'dark', 'Manual dark persists');
        await page.locator('.site-footer [data-theme-option="light"]').click();
        await preview(1260); assert.equal(await resolved(), 'light', 'Manual light survives a night preview');
        await page.locator('.site-footer [data-theme-option="auto"]').click();
        assert.equal(await resolved(), 'dark', 'Auto resumes the selected solar time');
        await page.reload(); assert.equal(await resolved(), 'dark', 'Preview and appearance agree after reload');
        await page.locator('button[data-dubai-mode="current"]').click();
        assert.equal(await resolved(), expected);
        assert(await page.locator('[data-favicon]').getAttribute('href').then(href => href.includes(expected)));
        assert.equal(await page.locator('#ride-2024 #presence').count(), 1);
        assert.equal(await page.locator('#presence').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert(await page.locator('[data-presence-audio]').evaluate(el => el.paused), 'Sound starts only with a user gesture');
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#presence').scrollIntoViewIfNeeded();
        await checkRenderedTextContrast(page, '#presence');
        await page.setViewportSize({width:390,height:900});
        await page.locator('.menu-toggle').click();
        const options = page.locator('.site-nav__setting-options--theme');
        await options.scrollIntoViewIfNeeded();
        const rows = await options.locator('button').evaluateAll(buttons => buttons.map(button => {
          const range = document.createRange();
          range.selectNodeContents(button);
          return range.getBoundingClientRect().top;
        }));
        assert(rows.every(top => Math.abs(top - rows[0]) < 1), 'Mobile appearance labels share one text line');
        assert(await page.locator('#menu-theme-auto-hint').evaluate(el => el.getBoundingClientRect().top >= el.previousElementSibling.getBoundingClientRect().bottom), 'The explanation belongs below the whole row');
        await page.close();
      }
      // First paint must not need the deferred app, forecast, or browser storage.
      const page = await browser.newPage({colorScheme:'light'});
      await page.clock.setFixedTime(new Date('2026-09-19T19:00:00Z'));
      await page.addInitScript(() => {
        for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window, key, {get() {throw new Error('Storage unavailable');}});
      });
      await page.route('**/app.js*', r => r.abort());
      await page.route('**/dubai-light.js*', r => r.abort());
      await page.goto(server.origin);
      assert(await page.locator('html').evaluate(el => el.classList.contains('theme-dark')), 'First paint resolves Dubai night without deferred scripts or storage');
      await page.close();
    } finally { await browser.close(); }
    console.log(`${name}: Dubai auto, preview, manual overrides, persistence, no weather/storage and merged audio PASS`);
  }
} finally { await server.close(); }
