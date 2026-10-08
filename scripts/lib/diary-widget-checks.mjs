import assert from 'node:assert/strict';

export async function checkDiaryWidget(page) {
  const widget = page.locator('.return-calendar');
  const toggle = widget.locator('[data-calendar-toggle]');
  const scrollTo = async y => {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const bounds = selector => page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { top: box.top + scrollY, bottom: box.bottom + scrollY };
  });
  const height = await page.evaluate(() => innerHeight);
  const initialExpanded = 'false';
  await page.locator('.hero__actions [href="#diary"]').focus();
  await scrollTo(0);
  await widget.waitFor({ state: 'hidden' });
  const chapter = await bounds('#manifesto-title');
  const entrance = chapter.top - height;
  assert(await widget.isHidden(), 'The hero already provides the diary action');
  await scrollTo(entrance + 32);
  await widget.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), initialExpanded, 'The calendar appears compact to leave room for the chapter');
  await scrollTo(entrance + 4);
  assert(await widget.isVisible(), 'Small reverse scrolling does not dismiss the shortcut');
  await scrollTo(entrance - 1);
  await widget.waitFor({ state: 'hidden' });
  await scrollTo(entrance + 4);
  assert(await widget.isHidden(), 'The chapter entrance has a small buffer');
  await scrollTo(entrance + 32);
  await widget.waitFor({ state: 'visible' });

  // Reproduce the reported second-screen state, with the tail of the hero
  // still visible, rather than jumping straight to a later chapter.
  const secondScreen = Math.max(entrance + 32, (await bounds('#about')).top - height * 0.25);
  await scrollTo(secondScreen);
  assert(await widget.isVisible(), 'The shortcut is already present on the second screen');

  // Exercise ordinary continuous scrolling, with no pause to reveal the card.
  // The calendar, film and diary remain reading destinations; the footer has its own action.
  const footerStart = (await bounds('.site-footer')).top;
  const end = footerStart - height - 32;
  const stops = [];
  for (let y = entrance + 32; y < end; y += height * 0.8) stops.push(y);
  stops.push(end);
  for (const y of [...stops, ...stops.toReversed()]) {
    await scrollTo(y);
    assert(await widget.isVisible(), `The shortcut stays available while scrolling at ${Math.round(y)}`);
  }
  const fits = await widget.evaluate(el => {
    const box = el.getBoundingClientRect();
    const link = el.querySelector('a').getBoundingClientRect();
    const toggle = el.querySelector('button').getBoundingClientRect();
    const date = el.querySelector('.return-calendar__date').getBoundingClientRect();
    const text = el.querySelector(el.classList.contains('is-collapsed') ? '.return-calendar__compact' : '.return-calendar__copy').getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
      el.scrollWidth <= el.clientWidth + 1 && link.height >= 44 && toggle.width >= 44 &&
      toggle.height >= 44 && text.right <= box.right && (innerWidth > 960
        ? text.top >= date.bottom
        : box.top >= 0 && box.bottom <= document.querySelector('.site-header').getBoundingClientRect().bottom);
  });
  assert(fits, 'The original calendar stack and separate touch target fit without clipping');

  // Reproduce the ordinary reading state that the old corner card obscured.
  await page.locator('.ride-film__notes').evaluate(el => window.scrollTo({
    top: scrollY + el.getBoundingClientRect().top - innerHeight * 0.68, behavior: 'instant',
  }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await widget.isVisible(), 'The shortcut remains available while reading film context');
  if (await page.evaluate(() => innerWidth <= 960)) {
    const coveredWords = await widget.evaluate(card => {
      const box = card.getBoundingClientRect(), covered = [];
      for (const p of document.querySelectorAll('.ride-film__notes p')) {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of node.textContent.matchAll(/\S+/gu)) {
            const range = document.createRange();
            range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            for (const rect of range.getClientRects()) {
              if (rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top) covered.push(match[0]);
            }
          }
        }
      }
      return covered;
    });
    assert.deepEqual(coveredWords, [], 'The mobile diary shortcut covers no words in the reading paragraph');
    const separated = await widget.evaluate(el => {
      const card = el.getBoundingClientRect(), menu = document.querySelector('.menu-toggle').getBoundingClientRect();
      const link = el.querySelector('a').getBoundingClientRect(), toggle = el.querySelector('button').getBoundingClientRect();
      return card.right + 8 <= menu.left && toggle.left >= link.left && toggle.right <= card.right;
    });
    assert(separated, 'Diary and menu targets remain separate in the navigation strip');
  }

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
      w.backdropFilter === m.backdropFilter, w.boxShadow === m.boxShadow];
  });
  assert(material.every(Boolean), 'The shortcut shares the menu glass material');
  for (const selector of ['#distance', '.ride-film__screen', '#diary']) {
    await scrollTo((await bounds(selector)).top);
    assert(await widget.isVisible(), `The shortcut remains available in ${selector}`);
  }
  await scrollTo(footerStart - height - 24);
  assert(await widget.isVisible(), 'The shortcut is available just before the footer');
  await scrollTo(footerStart - height + 1);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut clears the footer as soon as it enters view');
  await scrollTo(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  assert(await widget.isHidden(), 'The footer logo, links and legal line remain unobstructed');
  await scrollTo(footerStart - height - 4);
  assert(await widget.isHidden(), 'Small reverse scrolling at the footer does not cause flicker');
  await scrollTo(footerStart - height - 24);
  await widget.waitFor({ state: 'visible' });
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
  await scrollTo(pageActionBounds.bottom - widgetTop + 32);
  await widget.waitFor({ state: 'visible' });

  const latest = await page.evaluate(() =>
    JSON.parse(document.querySelector('#project-updates-data').textContent)
      .filter(item => item.kind === 'diary').at(-1));
  assert.equal(await widget.locator('[data-calendar-link]').getAttribute('href'), latest.href);
  assert.equal(await widget.locator('[data-calendar-date]').getAttribute('datetime'), latest.date);
  await widget.locator('[data-calendar-link]').click();
  await page.waitForFunction(id => document.activeElement?.id === id, latest.href.slice(1));
  await widget.waitFor({ state: 'visible' });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await scrollTo((await bounds('#diary')).top);
  await widget.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), initialExpanded);
  assert(await page.locator('[data-return-update]').isHidden());
}
