import assert from 'node:assert/strict';
import { scrollReadingPosition } from './diary-widget-checks.mjs';

export async function checkDiaryTouch(browser, origin) {
  const context = await browser.newContext({ isMobile: true, hasTouch: true,
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin && !url.pathname.endsWith('.mp4') ? route.continue() : route.abort();
  });
  const readingPosition = async page => page.locator('.ride-film__notes')
    .evaluate(el => scrollY + el.getBoundingClientRect().top - innerHeight * 0.68);
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.return-calendar');
    const start = await readingPosition(page);
    await scrollReadingPosition(page, start);
    await card.waitFor({ state: 'visible' });
    const original = await card.boundingBox();
    await page.touchscreen.tap(10, 200);
    assert(await card.isVisible(), 'An outside tap never hides the diary card');
    for (let offset = 0; offset <= 400; offset += 40) {
      await scrollReadingPosition(page, start + offset);
      assert(await card.isVisible(), 'Touch reading keeps the card visible over ordinary content');
      assert.deepEqual(await card.boundingBox(), original);
    }
    const latest = await card.locator('a').getAttribute('href');
    await card.locator('a').tap();
    await page.waitForFunction(id => document.activeElement?.id === id, latest.slice(1));
    await scrollReadingPosition(page, start);
    await card.locator('[data-calendar-close]').tap();
    await card.waitFor({ state: 'hidden' });
    await scrollReadingPosition(page, start + 300);
    assert(await card.isHidden(), 'A touch dismissal stays closed while reading');
    await page.reload();
    await scrollReadingPosition(page, await readingPosition(page));
    assert(await card.isHidden(), 'A touch dismissal survives reload');
    const freshPage = await context.newPage();
    freshPage.on('pageerror', error => errors.push(error.message));
    await freshPage.goto(origin, { waitUntil: 'load' });
    await scrollReadingPosition(freshPage, await readingPosition(freshPage));
    await freshPage.locator('.return-calendar').waitFor({ state: 'visible' });
    await freshPage.close();
    // Optional storage must never prevent the close action from working.
    const blocked = await context.newPage();
    blocked.on('pageerror', error => errors.push(error.message));
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    await blocked.goto(origin, { waitUntil: 'load' });
    await scrollReadingPosition(blocked, await readingPosition(blocked));
    await blocked.locator('[data-calendar-close]').tap();
    await blocked.locator('.return-calendar').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(`PASS diary touch: ${browser.browserType().name()}, steady reading, direct link, close, reload, fresh tab and blocked storage`);
  } finally { await context.close(); }
}
