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
  // This is a reading scenario; prior page actions must not leave the pointer on the card.
  await page.mouse.move(0, 0);
  const widget = page.locator('.return-calendar');
  const toggle = widget.locator('[data-calendar-toggle]');
  const scrollTo = y => scrollReadingPosition(page, y);
  const bounds = selector => page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { top: box.top + scrollY, bottom: box.bottom + scrollY };
  });
  const height = await page.evaluate(() => innerHeight);
  const textScale = await page.locator('html').evaluate(el => el.style.fontSize);
  const initialExpanded = 'false';
  await page.locator('.hero__actions [href="#diary"]').focus();
  await scrollTo(0);
  await widget.waitFor({ state: 'hidden' });
  const chapter = await bounds('#manifesto-title');
  const entrance = chapter.top - height;
  assert(await widget.isHidden(), 'The hero already provides the diary action');
  await scrollTo(entrance + 32);
  await page.waitForFunction(() => !document.querySelector('.return-calendar').hidden);
  assert.equal(await toggle.getAttribute('aria-expanded'), initialExpanded, 'The calendar appears compact to leave room for the chapter');
  await scrollTo(entrance + 4);
  assert(!await widget.evaluate(el => el.hidden), 'Small reverse scrolling does not dismiss the shortcut');
  await scrollTo(entrance - 1);
  await widget.waitFor({ state: 'hidden' });
  await scrollTo(entrance + 4);
  assert(await widget.isHidden(), 'The chapter entrance has a small buffer');
  await scrollTo(entrance + 32);
  await page.waitForFunction(() => !document.querySelector('.return-calendar').hidden);

  // Reproduce the reported second-screen state, with the tail of the hero
  // still visible, rather than jumping straight to a later chapter.
  const secondScreen = Math.max(entrance + 32, (await bounds('#about')).top - height * 0.25);
  await scrollTo(secondScreen);
  assert(!await widget.evaluate(el => el.hidden), 'The shortcut is already active on the second screen');
  const secondState = await readWidgetObstruction(page);
  assert(secondState.visible || secondState.words.length || secondState.actions.length, 'The second screen yields only to content actually under the card');

  // Exercise ordinary continuous scrolling, with no pause to reveal the card.
  // The calendar, film and diary remain reading destinations; the footer has its own action.
  const footerStart = (await bounds('.site-footer')).top;
  const end = footerStart - height - 32;
  const stops = [];
  for (let y = entrance + 32; y < end; y += height * 0.8) stops.push(y);
  stops.push(end);
  // Scrolling may reveal the card under a stationary mouse. This must not
  // count as opening it or exempt the next paragraph from collision checks.
  const corner = await widget.evaluate(el => ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top }));
  await page.mouse.move(corner.left + 2, corner.top + 2);
  const freePositions = new Set();
  for (const y of [...stops, ...stops.toReversed()]) {
    await scrollTo(y);
    const state = await readWidgetObstruction(page);
    const blocked = state.words.length > 0 || state.actions.length > 0;
    assert(!state.visible || !blocked, `Reading and page actions remain uncovered at ${Math.round(y)}: ${state.words.join(' ')}`);
    assert(state.visible || blocked, `The shortcut returns immediately when its corner is free at ${Math.round(y)}`);
    if (state.visible) freePositions.add(y);
  }
  assert(freePositions.size > 0, 'The shortcut remains available throughout free reading positions');
  const findFreePosition = async start => {
    const limit = (await bounds('.site-footer')).top - height - 32;
    const nearby = [...freePositions].sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
    const candidates = [start, ...nearby];
    // Expanding upwards needs more clearance than the sampled compact card.
    // Search beside those real free positions instead of assuming identical footprints.
    for (let offset = 20; offset <= height; offset += 20) {
      for (const y of nearby) candidates.push(y + offset, y - offset);
    }
    const visited = new Set();
    for (const y of candidates) {
      const target = Math.max(entrance + 32, Math.min(y, limit));
      if (visited.has(target)) continue;
      visited.add(target);
      await scrollTo(target);
      if (await widget.isVisible()) return;
    }
    assert.fail('The card must return in an observed free reading position');
  };
  await findFreePosition((await bounds('.ride-film__screen')).top);
  const fits = await widget.evaluate(el => {
    const box = el.getBoundingClientRect();
    const link = el.querySelector('a').getBoundingClientRect();
    const toggle = el.querySelector('button').getBoundingClientRect();
    const date = el.querySelector('.return-calendar__date').getBoundingClientRect();
    const text = el.querySelector(el.classList.contains('is-collapsed') ? '.return-calendar__compact' : '.return-calendar__copy').getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
      el.scrollWidth <= el.clientWidth + 1 && link.height >= 44 && toggle.width >= 44 &&
      toggle.height >= 44 && text.top >= date.bottom && text.right <= box.right &&
      box.top >= innerHeight / 2;
  });
  assert(fits, 'The original calendar stack and separate touch target fit without clipping');

  await toggle.focus();
  assert(await toggle.evaluate(el => document.activeElement === el), 'The restored shortcut is immediately focusable');
  await toggle.press('Enter');
  const chosenExpanded = String(initialExpanded !== 'true');
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenExpanded);
  const motion = await widget.evaluate(el => ({
    morphing: el.classList.contains('is-morphing'),
    ghost: Boolean(el.querySelector('.return-calendar__ghost')),
    durations: el.getAnimations({ subtree: true }).map(animation => {
      const timing = animation.effect.getComputedTiming();
      return timing.activeDuration + Math.max(0, timing.delay);
    }),
  }));
  assert(!motion.morphing && !motion.ghost && motion.durations.every(duration => duration <= 1),
    'Reduced motion keeps the disclosure instant');
  const material = await page.evaluate(() => {
    const w = getComputedStyle(document.querySelector('.return-calendar'));
    const m = getComputedStyle(document.querySelector('.menu-toggle'));
    return [w.backgroundImage === m.backgroundImage,
      w.backdropFilter === m.backdropFilter,
      // The bottom mobile card uses a shorter shadow at the Safari viewport edge.
      innerWidth <= 640 || w.boxShadow === m.boxShadow];
  });
  assert(material.every(Boolean), 'The shortcut shares the menu glass material');
  // Reproduce the two reported paragraphs under the mobile card. Its footprint
  // remains unchanged while hidden, and reversing the scroll restores it.
  await widget.locator('button').evaluate(el => el.blur());
  await page.mouse.move(0, 0);
  const notes = await bounds('.ride-film__notes');
  await scrollTo(notes.top - height * 0.68);
  const reading = await readWidgetObstruction(page, '.ride-film__notes');
  if (reading.words.length) assert(await widget.isHidden(), 'Actual film words cannot be covered by the shortcut');
  else {
    const entirePage = await readWidgetObstruction(page);
    assert(entirePage.visible || entirePage.words.length || entirePage.actions.length, 'Only real content can temporarily hide the shortcut');
  }
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenExpanded, 'Yielding to reading preserves disclosure');
  await findFreePosition((await bounds('.ride-film__screen')).top);
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenExpanded, 'The same disclosure returns after reading clears');
  for (const selector of ['#distance', '.ride-film__screen', '#diary']) {
    await scrollTo((await bounds(selector)).top);
    const state = await readWidgetObstruction(page);
    assert(state.visible || state.words.length || state.actions.length, `Only actual content can hide the shortcut in ${selector}`);
  }
  await findFreePosition(footerStart - height - 24);
  assert(await widget.isVisible(), 'The shortcut is available before the footer');
  await scrollTo(footerStart - height + 1);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut clears the footer as soon as it enters view');
  await scrollTo(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  assert(await widget.isHidden(), 'The footer logo, links and legal line remain unobstructed');
  await scrollTo(footerStart - height - 4);
  assert(await widget.evaluate(el => el.hidden), 'Small reverse scrolling at the footer does not cause flicker');
  await scrollTo(footerStart - height - 24);
  await page.waitForFunction(() => !document.querySelector('.return-calendar').hidden);
  await findFreePosition(footerStart - height - 24);
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenExpanded,
    'Returning from the footer preserves the chosen disclosure state');

  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'hidden' });
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.nav-shell').open &&
    !document.querySelector('.return-calendar').inert);
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenExpanded,
    'Temporary hiding preserves the chosen disclosure state');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), initialExpanded);

  // Put an actual page action under the floating control and focus it without
  // scrolling: keyboard access takes precedence over the shortcut.
  const pageAction = page.locator('[data-calendar-details] > summary');
  const pageActionBounds = await bounds('[data-calendar-details] > summary');
  const widgetTop = await widget.evaluate(el => el.getBoundingClientRect().top);
  await scrollTo(pageActionBounds.top - widgetTop + 1);
  await pageAction.evaluate(el => el.focus({ preventScroll: true }));
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut never obscures a focused page control');
  await pageAction.evaluate(el => el.blur());
  await findFreePosition(pageActionBounds.bottom - widgetTop + 32);

  const latest = await page.evaluate(() =>
    JSON.parse(document.querySelector('#project-updates-data').textContent)
      .filter(item => item.kind === 'diary').at(-1));
  assert.equal(await widget.locator('[data-calendar-link]').getAttribute('href'), latest.href);
  assert.equal(await widget.locator('[data-calendar-date]').getAttribute('datetime'), latest.date);
  await widget.locator('[data-calendar-link]').click();
  await page.waitForFunction(id => document.activeElement?.id === id, latest.href.slice(1));
  await findFreePosition((await bounds('#diary')).top);
  await page.reload();
  // A manually applied text fixture must persist across reload like a real
  // browser text preference; otherwise its recorded geometry belongs to 200%.
  if (textScale) await page.evaluate(scale => {
    document.documentElement.style.fontSize = scale;
    window.dispatchEvent(new Event('resize'));
  }, textScale);
  await page.evaluate(() => document.fonts.ready);
  await findFreePosition((await bounds('#diary')).top);
  assert.equal(await toggle.getAttribute('aria-expanded'), initialExpanded);
  assert(await page.locator('[data-return-update]').isHidden());
  return { findFreePosition };
}
