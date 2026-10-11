import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';
import { checkDiaryWidget } from './lib/diary-widget-checks.mjs';
import { checkFooterLinks } from './lib/footer-link-checks.mjs';
import { checkDiaryTouch } from './lib/diary-widget-touch.mjs';

const server = await startSiteServer(process.argv[2] || 'site');
const browser = await chromium.launch();
const output = 'artifacts/gate/automated/diary-widget';
await mkdir(output, { recursive: true });
try {
  for (const { locale, width, enlarged } of [
    { locale: 'ru', width: 1440 }, { locale: 'en', width: 1440 },
    { locale: 'ru', width: 390 }, { locale: 'en', width: 390 },
    { locale: 'ru', width: 320 }, { locale: 'ru', width: 320, enlarged: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === server.origin && !url.pathname.endsWith('.mp4') ? route.continue() : route.abort();
    });
    await page.goto(`${server.origin}/${locale === 'en' ? 'en/' : ''}${enlarged ? '?text=200' : ''}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const { positionInReading } = await checkDiaryWidget(page);
    const widget = page.locator('.return-calendar');
    const close = widget.locator('[data-calendar-close]');
    assert.equal(await close.getAttribute('title'), null, 'No native tooltip covers the widget');
    assert.equal(await close.getAttribute('aria-label'),
      locale === 'ru' ? 'Скрыть виджет дневника' : 'Hide diary widget');
    const capture = state => widget.screenshot({ path: `${output}/${locale}-${width}${enlarged ? '-enlarged' : ''}-${state}.png` });
    await close.hover();
    await page.waitForFunction(() => {
      const widget = document.querySelector('.return-calendar');
      return getComputedStyle(widget.querySelector('button')).color !== getComputedStyle(widget).color;
    });
    assert.equal(await close.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await close.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await capture('close-hover');
    await page.mouse.move(20, 100);
    await widget.locator('a').focus();
    await page.keyboard.press('Tab');
    assert(await close.evaluate(el => document.activeElement === el));
    assert.notEqual(await close.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await capture('keyboard');
    await close.click();
    await widget.waitFor({ state: 'hidden' });
    await page.keyboard.press('Shift');
    assert.equal(await close.evaluate(el => getComputedStyle(el).outlineStyle), 'none',
      'A modifier key never restores a pointer focus ring');
    await page.reload();
    await scrollIntoReading(page);
    assert(await widget.isHidden(), 'Pointer dismissal survives reload');
    await page.evaluate(() => sessionStorage.removeItem('11111-diary-widget-dismissed'));
    await page.reload();
    if (enlarged) await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      window.dispatchEvent(new Event('resize'));
    });
    await page.evaluate(() => document.fonts.ready);
    await positionInReading(await page.locator('#diary').evaluate(el => scrollY + el.getBoundingClientRect().top));
    await checkFooterLinks(page);
    await page.locator('.site-footer__legal').screenshot({
      path: `${output}/${locale}-${width}${enlarged ? '-enlarged' : ''}-footer.png`,
    });
    assert.deepEqual(errors, []);
    console.log(`PASS diary widget: ${locale} ${width}px${enlarged ? ' 200% text' : ''}, steady scrolling, footer, direct link, close, reload, hover and keyboard`);
    await page.close();
  }
  await checkDiaryTouch(browser, server.origin);
  const safari = await webkit.launch();
  try { await checkDiaryTouch(safari, server.origin); }
  finally { await safari.close(); }
} finally {
  await browser.close();
  await server.close();
}

async function scrollIntoReading(page) {
  await page.locator('#diary').scrollIntoViewIfNeeded();
}
