import assert from 'node:assert/strict';

export async function checkFooterLinks(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const geometry = await page.locator('.site-footer__after-credits, .site-footer__credits a').evaluateAll(links => links.map(link => {
    const text = link.querySelector('strong') || link.querySelector('span');
    const icon = link.querySelector('.icon');
    const label = text.getBoundingClientRect(), arrow = icon.getBoundingClientRect();
    return { gap: arrow.left - label.right, center: (arrow.top + arrow.bottom - label.top - label.bottom) / 2,
      width: arrow.width, height: arrow.height, right: arrow.right, viewport: innerWidth };
  }));
  assert.equal(geometry.length, 2);
  for (const arrow of geometry) {
    assert(arrow.gap >= 4 && arrow.gap <= arrow.width * 1.5, 'Footer arrow stays beside its own label');
    assert(Math.abs(arrow.center) <= 1, 'Footer arrow aligns with the label vertically');
    assert(arrow.right <= arrow.viewport, 'Footer arrow is visible without horizontal scrolling');
  }
  assert.equal(geometry[0].width, geometry[1].width, 'Footer links use the same arrow size');
  assert.equal(geometry[0].height, geometry[1].height);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
