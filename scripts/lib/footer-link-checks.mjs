import assert from 'node:assert/strict';

export async function checkFooterLinks(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const geometry = await page.locator('.site-footer__after-credits').evaluateAll(links => links.map(link => {
    const text = link.querySelector('strong') || link.querySelector('span');
    const icon = link.querySelector('.icon');
    const label = text.getBoundingClientRect(), arrow = icon.getBoundingClientRect();
    return { gap: arrow.left - label.right, center: (arrow.top + arrow.bottom - label.top - label.bottom) / 2,
      width: arrow.width, height: arrow.height, right: arrow.right, viewport: innerWidth };
  }));
  assert.equal(geometry.length, 1);
  for (const arrow of geometry) {
    assert(arrow.gap >= 4 && arrow.gap <= arrow.width * 1.5, 'Footer arrow stays beside its own label');
    assert(Math.abs(arrow.center) <= 1, 'Footer arrow aligns with the label vertically');
    assert(arrow.right <= arrow.viewport, 'Footer arrow is visible without horizontal scrolling');
  }
  // The shared signature owns its arrow; site-link geometry does not apply to it.
  const credit = await page.locator('.site-footer__credits ag-signature').evaluate(host => {
    const fallback = host.querySelector('a[rel="author"]');
    const link = host.shadowRoot?.querySelector('a') || fallback;
    const rect = link.getBoundingClientRect();
    return { href: link.href, fallbackHref: fallback.href, text: link.textContent,
      left: rect.left, right: rect.right, height: rect.height, viewport: innerWidth };
  });
  assert.equal(credit.href, 'https://gorokhovatsky.tech/');
  assert.equal(credit.fallbackHref, credit.href, 'The fallback preserves the author destination');
  assert(credit.text.includes('Антон'), 'The credit identifies the author');
  assert(credit.left >= 0 && credit.right <= credit.viewport, 'The author credit stays within the viewport');
  assert(credit.height > 0, 'The author link remains visible with or without the shared module');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
