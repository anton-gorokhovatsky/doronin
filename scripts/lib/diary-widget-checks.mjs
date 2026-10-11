import assert from 'node:assert/strict';

// Inspect the words a reader actually sees, independently of the widget's
// visibility attributes. Include the whole hit area of actual page actions.
export async function readWidgetObstruction(page, scope = 'main') {
  return page.evaluate(scope => {
    const widget = document.querySelector('.return-calendar');
    const box = widget.getBoundingClientRect();
    const overlaps = rect => rect.width > 0 && rect.height > 0 &&
      rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
    const words = [], actions = [];
    const root = document.querySelector(scope);
    for (const action of root.querySelectorAll('a, button, input, select, textarea, summary, [role="button"], [role="slider"]')) {
      if (overlaps(action.getBoundingClientRect()) && action.checkVisibility({ checkVisibilityCSS: true })) {
        actions.push(action.tagName);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (parent.closest('script, style, noscript, .sr-only') || !overlaps(parent.getBoundingClientRect()) ||
          !parent.checkVisibility({ checkVisibilityCSS: true })) continue;
      for (const match of node.textContent.matchAll(/\S+/gu)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        if ([...range.getClientRects()].some(overlaps)) words.push(match[0]);
      }
    }
    return { visible: !widget.hidden && getComputedStyle(widget).visibility === 'visible', words, actions };
  }, scope);
}

// Native scrolling reaches WebKit's rendering thread asynchronously. Wait for
// the scroll event before the next painted frames, not frames from the old position.
export async function scrollReadingPosition(page, y) {
  await page.evaluate(y => new Promise(resolve => {
    const afterScroll = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
    const target = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
    if (Math.abs(scrollY - target) < 1) {
      afterScroll();
      return;
    }
    window.addEventListener('scroll', afterScroll, { once: true });
    window.scrollTo({ top: target, behavior: 'instant' });
  }), y);
}

export async function checkDiaryWidget(page) {
  await page.mouse.move(0, 0);
  const widget = page.locator('.return-calendar');
  const close = widget.locator('[data-calendar-close]');
  const scrollTo = y => scrollReadingPosition(page, y);
  const bounds = selector => page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { top: box.top + scrollY, bottom: box.bottom + scrollY };
  });
  const height = await page.evaluate(() => innerHeight);
  const textScale = await page.locator('html').evaluate(el => el.style.fontSize);
  const reload = async () => {
    await page.reload();
    if (textScale) await page.evaluate(scale => {
      document.documentElement.style.fontSize = scale;
      window.dispatchEvent(new Event('resize'));
    }, textScale);
    await page.evaluate(() => document.fonts.ready);
  };
  await page.locator('.hero__actions [href="#diary"]').focus();
  await scrollTo(0);
  await widget.waitFor({ state: 'hidden' });
  const chapter = await bounds('#manifesto-title');
  const entrance = chapter.top - height;
  await scrollTo(entrance + 32);
  await widget.waitFor({ state: 'visible' });
  assert.equal(await widget.locator('button').count(), 1, 'The close button is the only separate control');
  assert.equal(await widget.locator('[data-calendar-toggle], .return-calendar__copy').count(), 0,
    'The chosen design has no title disclosure');
  await scrollTo(entrance + 4);
  assert(await widget.isVisible(), 'Small reverse scrolling preserves the shortcut');
  await scrollTo(entrance - 1);
  await widget.waitFor({ state: 'hidden' });
  await scrollTo(entrance + 4);
  assert(await widget.isHidden(), 'The chapter entrance keeps its 16px buffer');
  await scrollTo(entrance + 32);
  await widget.waitFor({ state: 'visible' });

  const secondScreen = Math.max(entrance + 32, (await bounds('#about')).top - height * 0.25);
  await scrollTo(secondScreen);
  assert(await widget.isVisible(), 'The shortcut is already visible on the second screen');
  const original = await widget.boundingBox();
  const footerStart = (await bounds('.site-footer')).top;
  const end = footerStart - height - 32;
  const stops = [];
  for (let y = entrance + 32; y < end; y += height * 0.8) stops.push(y);
  stops.push(end);
  await page.mouse.move(original.x + 2, original.y + 2);
  let coveredPositions = 0;
  let coveredPosition;
  for (const y of [...stops, ...stops.toReversed()]) {
    await scrollTo(y);
    const state = await readWidgetObstruction(page);
    assert(state.visible, `Ordinary scrolling never hides the card at ${Math.round(y)}`);
    if (state.words.length || state.actions.length) {
      coveredPositions++;
      coveredPosition ??= y;
    }
    const box = await widget.boundingBox();
    assert.deepEqual(box, original, 'Ordinary scrolling preserves the accepted size and corner');
  }
  assert(coveredPositions > 0, 'The regression scenario includes actual words or actions beneath the card');
  // Sample every painted frame while crossing a formerly obstructed position.
  // No pause, hover or pointer engagement is required to keep the card visible.
  await scrollTo(coveredPosition - 24);
  const frames = await page.evaluate(() => new Promise(resolve => {
    const samples = [];
    let step = 0;
    const next = () => requestAnimationFrame(() => {
      const card = document.querySelector('.return-calendar');
      samples.push(!card.hidden && getComputedStyle(card).visibility === 'visible');
      if (++step === 12) return resolve(samples);
      window.scrollBy({ top: 4, behavior: 'instant' });
      next();
    });
    next();
  }));
  assert(frames.every(Boolean), 'The card remains visible on every frame of ordinary scrolling');
  await page.mouse.move(0, 0);
  const positionInReading = async start => {
    await scrollTo(Math.max(entrance + 32, Math.min(start, end)));
    await widget.waitFor({ state: 'visible' });
  };
  await positionInReading((await bounds('.ride-film__screen')).top);
  assert(await widget.evaluate(el => {
    const box = el.getBoundingClientRect();
    const link = el.querySelector('a').getBoundingClientRect();
    const close = el.querySelector('button').getBoundingClientRect();
    const date = el.querySelector('.return-calendar__date').getBoundingClientRect();
    const text = el.querySelector('.return-calendar__compact').getBoundingClientRect();
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Math.abs(box.width - rootSize * 7) < 1 && box.left >= 0 && box.right <= innerWidth &&
      box.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1 && link.height >= 44 &&
      close.width >= 44 && close.height >= 44 && text.top >= date.bottom &&
      text.right <= box.right && box.top >= innerHeight / 2;
  }), 'The original compact calendar stack and close target fit without clipping');
  assert(await widget.evaluate(el => el.getAnimations({ subtree: true }).length === 0),
    'The compact card has no resize or visibility animation');
  const material = await page.evaluate(() => {
    const w = getComputedStyle(document.querySelector('.return-calendar'));
    const m = getComputedStyle(document.querySelector('.menu-toggle'));
    return [w.backgroundImage === m.backgroundImage, w.backdropFilter === m.backdropFilter,
      innerWidth <= 640 || w.boxShadow === m.boxShadow];
  });
  assert(material.every(Boolean), 'The accepted menu glass and shorter mobile shadow are preserved');
  const notes = await bounds('.ride-film__notes');
  await positionInReading(notes.top - height * 0.68);
  assert(await widget.isVisible(), 'Film paragraphs no longer make the shortcut disappear');
  for (const selector of ['#distance', '.ride-film__screen', '#diary']) {
    await positionInReading((await bounds(selector)).top);
    assert(await widget.isVisible(), `The shortcut stays available in ${selector}`);
  }
  await positionInReading(end);
  await scrollTo(footerStart - height + 1);
  await widget.waitFor({ state: 'hidden' });
  await scrollTo(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  assert(await widget.isHidden(), 'The footer logo, links and legal line remain unobstructed');
  await scrollTo(footerStart - height - 4);
  assert(await widget.isHidden(), 'Small reverse scrolling at the footer does not cause flicker');
  await positionInReading(end);
  assert.deepEqual(await widget.boundingBox(), original, 'Returning from the footer preserves the card');

  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'hidden' });
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.nav-shell').open &&
    !document.querySelector('.return-calendar').inert);
  // A focused page action remains operable for keyboard users. Pointer focus
  // must not reintroduce the reading-collision visibility toggle.
  const pageAction = page.locator('[data-calendar-details] > summary');
  const pageActionBounds = await bounds('[data-calendar-details] > summary');
  const widgetTop = await widget.evaluate(el => el.getBoundingClientRect().top);
  await page.keyboard.press('Tab');
  await scrollTo(pageActionBounds.top - widgetTop + 1);
  await pageAction.evaluate(el => el.focus({ preventScroll: true }));
  assert(await pageAction.evaluate(el => el.matches(':focus-visible')));
  await widget.waitFor({ state: 'hidden' });
  await pageAction.evaluate(el => el.blur());
  await widget.waitFor({ state: 'visible' });
  const point = await pageAction.boundingBox();
  await page.mouse.click(point.x + 3, point.y + 3);
  assert(await widget.isVisible(), 'Pointer focus does not make the diary shortcut disappear');
  await pageAction.evaluate(el => el.blur());

  const latest = await page.evaluate(() =>
    JSON.parse(document.querySelector('#project-updates-data').textContent)
      .filter(item => item.kind === 'diary').at(-1));
  await positionInReading((await bounds('#diary')).top);
  assert.equal(await widget.locator('[data-calendar-link]').getAttribute('href'), latest.href);
  assert.equal(await widget.locator('[data-calendar-date]').getAttribute('datetime'), latest.date);
  await widget.locator('[data-calendar-link]').click();
  await page.waitForFunction(id => document.activeElement?.id === id, latest.href.slice(1));
  await positionInReading((await bounds('#diary')).top);
  await reload();
  await positionInReading((await bounds('#diary')).top);
  assert(await page.locator('[data-return-update]').isHidden());

  await widget.locator('a').focus();
  await page.keyboard.press('Tab');
  assert(await close.evaluate(el => document.activeElement === el));
  const scrollBeforeClose = await page.evaluate(() => scrollY);
  await close.press('Enter');
  await widget.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'MAIN',
    'Keyboard dismissal returns focus to the reading content');
  assert.equal(await page.evaluate(() => scrollY), scrollBeforeClose, 'Dismissal never jumps the reading position');
  await scrollTo(notes.top);
  assert(await widget.isHidden(), 'Scrolling never restores a dismissed card');
  await reload();
  await scrollTo(notes.top);
  assert(await widget.isHidden(), 'A dismissed card stays hidden after reload in this tab');
  // Restore the test fixture for the caller's hover and footer checks.
  await page.evaluate(() => sessionStorage.removeItem('11111-diary-widget-dismissed'));
  await reload();
  await positionInReading((await bounds('#diary')).top);
  return { positionInReading };
}
