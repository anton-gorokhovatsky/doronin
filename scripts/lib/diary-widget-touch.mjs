import assert from 'node:assert/strict';
import { readWidgetObstruction } from './diary-widget-checks.mjs';

export async function checkDiaryTouch(browser, origin) {
  const context = await browser.newContext({ isMobile: true, hasTouch: true,
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin && !url.pathname.endsWith('.mp4') ? route.continue() : route.abort();
  });
  const scroll = async y => {
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  try {
    await page.goto(origin, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.return-calendar');
    await card.waitFor({ state: 'attached' });
    const start = await page.locator('.ride-film__notes').evaluate(el => scrollY + el.getBoundingClientRect().top - innerHeight * 0.68);
    for (let offset = 0; offset < 1600; offset += 40) {
      await scroll(start + offset);
      if (await card.isVisible()) break;
    }
    await card.waitFor({ state: 'visible' });
    await card.locator('button').tap();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await card.locator('button').getAttribute('aria-expanded'), 'true');
    assert(await card.isVisible(), 'Lifting a finger keeps the explicitly opened title available');
    const opened = await readWidgetObstruction(page);
    assert(opened.words.length || opened.actions.length, 'Exercise a larger footprint crossing actual content');
    await page.touchscreen.tap(10, 200);
    await card.waitFor({ state: 'hidden' });
    assert.equal(await card.locator('button').getAttribute('aria-expanded'), 'true', 'Yielding preserves the touch disclosure');
    const end = await page.locator('.site-footer').evaluate(el => scrollY + el.getBoundingClientRect().top - innerHeight - 32);
    for (let y = start; y < end; y += 844 * 0.8) {
      await scroll(y);
      if (await card.isVisible()) break;
    }
    await card.waitFor({ state: 'visible' });
    assert.equal(await card.locator('button').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(errors, []);
    console.log(`PASS diary touch: ${browser.browserType().name()}, disclosure, outside tap, reading and restoration`);
  } finally { await context.close(); }
}
