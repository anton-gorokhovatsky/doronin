import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { startSiteServer } from "./lib/site-server.mjs";
import { assertThreeVisible, checkCurrentMixedMedia, checkMixedMedia } from "./lib/december-mixed-media-checks.mjs";

function readOptions(args) {
  const failuresOnly = args.includes("--failures-only");
  args = args.filter(argument => argument !== "--failures-only");
  if (args[0] === "--url") {
    if (args.length !== 2) throw new Error("--url requires one explicit public base URL");
    const publicUrl = new URL(args[1]);
    if (!/^https?:$/.test(publicUrl.protocol)) {
      throw new Error("Public check requires an HTTP URL");
    }
    return { publicUrl: publicUrl.href, failuresOnly };
  }
  if (args.length > 1 || args[0]?.startsWith("--")) {
    throw new Error("Usage: node scripts/december-gallery-check.mjs [site-directory | --url public-base-url] [--failures-only]");
  }
  return { directory: path.resolve(args[0] || "site"), failuresOnly };
}

function pageUrl(base, route) {
  const url = new URL(base);
  const destination = new URL(route, "http://check.invalid");
  url.pathname = url.pathname.replace(/\/$/, "") + destination.pathname;
  url.searchParams.set("codexQa", "1");
  url.hash = destination.hash;
  return url.href;
}

function galleryFor(page, day) {
  const episode = page.locator(`[data-episode="${day}"]`);
  return {
    episode,
    deck: episode.locator(".stage-scene"),
    count: episode.locator("[data-start-strip-count]"),
    next: episode.locator("[data-start-strip-next]"),
    previous: episode.locator("[data-start-strip-prev]"),
  };
}

async function saveFrame(page, output, name) {
  await page.screenshot({ path: path.join(output, `${name}.jpg`) });
}

async function checkFullPhoto(page, deck) {
  const photo = deck.locator('a[data-current="true"]');
  await photo.click();
  const dialog = page.locator("[data-start-lightbox]");
  assert.equal(await dialog.evaluate(element => element.open), true);
  assert.equal(await dialog.locator("img").getAttribute("src"), await photo.evaluate(element => element.href));
  await page.keyboard.press("ArrowRight");
  assert.equal(await dialog.locator("[data-start-photo-position]").innerText(), "3 / 3");
  await page.keyboard.press("ArrowRight");
  assert.equal(await dialog.locator("[data-start-photo-position]").innerText(), "1 / 3", "The full viewer also cycles forward");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await dialog.locator("[data-start-photo-position]").innerText(), "3 / 3", "The full viewer also cycles backward");
  await page.keyboard.press("Escape");
  assert.equal(await dialog.evaluate(element => element.open), false);
  assert.equal(await deck.getAttribute('data-photo-index'), '2', 'Closing keeps the last photograph selected in the full viewer');
  const selectedPhoto = deck.locator('a[data-current="true"]');
  assert.equal(await selectedPhoto.evaluate(element => element === document.activeElement), true,
    'Focus returns to the currently expanded photograph');
  assert.equal(await selectedPhoto.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }), true, 'The returned keyboard focus is inside the viewport');
}

async function assertSelectedPhotograph(page, deck, output, name) {
  await page.waitForFunction(element => element.dataset.turning !== 'true', await deck.elementHandle());
  await page.waitForTimeout(40);
  const source = await deck.locator('a[data-current="true"] img').evaluate(image => image.currentSrc || image.src);
  const selected = deck.locator('a[data-current="true"]');
  const screenshot = await selected.screenshot();
  const box = await selected.boundingBox();
  // Render an independent flat image through the same browser rasterizer.
  // A direct 1600px ->32px canvas resize otherwise differs from WebKit's
  // 1600px ->CSS viewport ->32px resampling on detailed foliage/road frames.
  await page.evaluate(async ({ source, box }) => {
    const reference = document.createElement('img');
    reference.dataset.galleryReference = '';
    reference.alt = '';
    reference.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;object-fit:contain;z-index:2147483647;margin:0;padding:0;border:0;filter:none;opacity:1;transform:none;pointer-events:none`;
    reference.src = source;
    document.body.append(reference);
    await reference.decode();
  }, {source, box});
  let referenceScreenshot;
  try { referenceScreenshot = await selected.screenshot(); }
  finally { await page.locator('[data-gallery-reference]').evaluate(image => image.remove()); }
  const difference = await page.evaluate(async ({ referenceEncoded, encoded }) => {
    const expected = new Image(); expected.src = `data:image/png;base64,${referenceEncoded}`;
    const actual = new Image(); actual.src = `data:image/png;base64,${encoded}`;
    await Promise.all([expected.decode(), actual.decode()]);
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 18;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.drawImage(expected, 0, 0, 32, 18);
    const reference = context.getImageData(0, 0, 32, 18).data;
    context.clearRect(0, 0, 32, 18);
    context.drawImage(actual, 0, 0, 32, 18);
    const rendered = context.getImageData(0, 0, 32, 18).data;
    let total = 0, samples = 0;
    // Ignore the one-pixel edge rounding of a fractional CSS viewport.
    for (let y = 1; y < 17; y++) for (let x = 1; x < 31; x++) {
      const offset = (y * 32 + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        total += Math.abs(reference[offset + channel] - rendered[offset + channel]);
        samples++;
      }
    }
    return total / samples;
  }, {referenceEncoded: referenceScreenshot.toString('base64'), encoded: screenshot.toString('base64')});
  await writeFile(path.join(output, `${name}.png`), screenshot);
  assert.ok(difference < 8, `The rendered full frame matches the selected photograph (${name}, RGB error ${difference})`);
  return difference;
}

async function checkMixedInput(page, gallery, engine, output) {
  const { deck, next, count } = gallery;
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('End');
  await assertSelectedPhotograph(page, deck, output, `${engine}-keyboard-last-photo`);
  await next.click();
  assert.equal(await count.innerText(), '1 / 3');
  await assertSelectedPhotograph(page, deck, output, `${engine}-mouse-wrap-photo`);
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 7; step++) await page.keyboard.press('ArrowRight');
  assert.equal(await count.innerText(), '2 / 3');
  await assertSelectedPhotograph(page, deck, output, `${engine}-keyboard-many-photo`);
  await next.click();
  assert.equal(await count.innerText(), '3 / 3');
  await assertSelectedPhotograph(page, deck, output, `${engine}-mouse-next-photo`);
  // A resize preserves the selected photograph, then accepts mouse navigation.
  await page.setViewportSize({width: 1360, height: 1000});
  await next.click();
  assert.equal(await count.innerText(), '1 / 3');
  await assertSelectedPhotograph(page, deck, output, `${engine}-resized-wrap-photo`);
  await page.setViewportSize({width: 1440, height: 1000});
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('Home');
}

async function checkPointerField(page, gallery, engine, output) {
  const { deck, count } = gallery;
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('Home');
  const box = await deck.boundingBox();
  const y = box.y + box.height * .45;
  const original = await deck.locator('.stage-scene__field').getAttribute('style');
  await page.mouse.move(box.x - 10, y);
  await page.mouse.move(box.x + box.width * .8, y, {steps: 8});
  await page.mouse.move(box.x - 10, y);
  assert.equal(await deck.locator('.stage-scene__field').getAttribute('style'), original,
    'Pointer movement alone leaves the scene and its selection still');
  assert.equal(await count.innerText(), '1 / 3');
  const photos = deck.locator('[data-start-photo]');
  assert.equal(await photos.count(), 3);
  await assertThreeVisible(deck, 0);
  assert.equal(await deck.locator('img').count(), 3, 'Each original exists once in the photographic scene');
  assert.equal(await deck.locator('..').locator('.stage-deck__series').count(), 0, 'There is no duplicated thumbnail row');
  const targets = await photos.evaluateAll(links => links.map(link => ({
    inert: link.inert, hidden: link.hidden, tab: link.tabIndex,
    current: link.dataset.current === 'true', following: link.dataset.following === 'true', later: link.dataset.later === 'true',
  })));
  const current = targets.filter(target => target.current);
  assert.equal(current.length, 1, 'The series has one current photograph');
  assert.ok(!current[0].inert && !current[0].hidden && current[0].tab === 0,
    'The current photograph remains available to the keyboard');
  assert.ok(targets.filter(target => !target.current && !target.inert && !target.hidden && target.tab >= 0)
    .every(target => target.following || target.later), 'The two following previews may be separate selection commands');
  await gallery.next.click();
  assert.equal(await count.innerText(), '2 / 3');
  await page.waitForFunction(element => element.dataset.turning !== 'true', await deck.elementHandle());
  await assertThreeVisible(deck, 1);
  assert.equal(await page.locator('[data-start-lightbox]').evaluate(element => element.open), false,
    'Changing media leaves full view under explicit control');
  await assertSelectedPhotograph(page, deck, output, `${engine}-native-window-photo`);
  const native = await photos.nth(1).evaluate(link => {
    const r = link.getBoundingClientRect();
    const img = link.querySelector('img');
    return {ratio:r.width/r.height, native:img.naturalWidth/img.naturalHeight};
  });
  assert.ok(Math.abs(native.ratio - native.native) < .01, 'The frame keeps its original aspect ratio');
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('Home');
  assert.equal(await count.innerText(), '1 / 3');
  assert.equal(await deck.getAttribute('data-turning'), 'false', 'Keyboard selection is immediate');
  const beforeScroll = await count.innerText();
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(100);
  assert.equal(await count.innerText(), beforeScroll, 'Reading vertically does not browse photographs');
  await deck.scrollIntoViewIfNeeded();
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press('Home');
}

async function checkMouseGestures(page, gallery, engine, output) {
  const { deck, count, next, previous } = gallery;
  await deck.locator('[data-current="true"]').focus();
  await page.keyboard.press("Home");
  const box = await deck.boundingBox();
  assert.ok(box, "The gallery has a visible drag surface");
  const x = box.x + box.width * 0.65;
  const y = box.y + box.height * 0.45;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.38, y + 8, { steps: 7 });
  await saveFrame(page, output, `${engine}-gallery-drag`);
  await page.mouse.up();
  assert.equal(await count.innerText(), "2 / 3");
  assert.equal(await page.locator("[data-start-lightbox]").evaluate(element => element.open), false);

  await page.waitForTimeout(300);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 18, y + 1, { steps: 5 });
  await page.waitForTimeout(130);
  await page.mouse.up();
  assert.equal(await count.innerText(), "2 / 3");

  await previous.click();
  await next.click({ delay: 10 });
  await previous.click({ delay: 10 });
  assert.equal(await count.innerText(), "1 / 3");
  await page.waitForTimeout(300);
  await saveFrame(page, output, `${engine}-gallery-rest`);
}

async function checkDesktop(browser, engine, base, output) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(pageUrl(base, "/december/#race-day-04"));
    const gallery = galleryFor(page, "04");
    await gallery.deck.waitFor();
    await page.evaluate(() => document.fonts.ready);

    assert.equal(await page.locator("[data-episode]").count(), 5);
    for (let day = 1; day <= 5; day += 1) {
      const { deck } = galleryFor(page, String(day).padStart(2, "0"));
      assert.equal(await deck.locator("[data-start-photo]").count(), 3);
    }

    const { episode, deck, count, next } = gallery;
    await deck.scrollIntoViewIfNeeded();
    await checkMixedInput(page, gallery, engine, output);
    await checkPointerField(page, gallery, engine, output);
    await next.click();
    assert.equal(await count.innerText(), "2 / 3");
    await next.click();
    assert.equal(await count.innerText(), "3 / 3");
    assert.equal(await next.isDisabled(), false);
    await next.click();
    assert.equal(await count.innerText(), "1 / 3", "The last photograph advances to the first");
    await gallery.previous.click();
    assert.equal(await count.innerText(), "3 / 3", "The first photograph returns to the last");
    await deck.locator('[data-current="true"]').focus();
    await page.keyboard.press("Home");

    // Commands cycle the native media window without resetting the selected source.
    await episode.evaluate(element => {
      const previous = element.querySelector("[data-start-strip-prev]");
      const next = element.querySelector("[data-start-strip-next]");
      previous.click();
      previous.click();
      next.click();
      previous.click();
    });
    assert.equal(await count.innerText(), "2 / 3");

    await deck.locator('[data-current="true"]').focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await count.innerText(), "2 / 3");
    assert.equal(await deck.locator('a[data-current="true"]:not([inert])').count(), 1);
    await checkFullPhoto(page, deck);
    await checkMouseGestures(page, gallery, engine, output);

    await next.click();
    await episode.locator('a[href="#race-day-03"]').click();
    assert.equal(await galleryFor(page, "03").episode.isVisible(), true);
    await galleryFor(page, "03").episode.locator('a[href="#race-day-04"]').click();
    assert.equal(await count.innerText(), "2 / 3");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // The rehearsal interaction must not replace the real pre-start homepage.
    await page.goto(pageUrl(base, "/"));
    assert.equal(await page.locator(".stage-scene").count(), 0);
    assert.equal(await page.locator("[data-five-days]").count(), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
  } finally {
    await page.close();
  }
}

async function touchDrag(page, client, box, dx, dy) {
  assert.ok(box, "The gallery has a visible touch surface");
  const x = box.x + box.width * 0.6;
  const y = box.y + box.height * 0.45;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  try {
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }],
      });
      await page.waitForTimeout(16);
    }
  } finally {
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
}

async function checkTrustedTouch(page, gallery) {
  const { deck, count } = gallery;
  const client = await page.context().newCDPSession(page);
  try {
    await page.keyboard.press("Home");
    await touchDrag(page, client, await deck.boundingBox(), -180, 3);
    assert.equal(await count.innerText(), "2 / 3", "Trusted touch swipe advances");
    assert.equal(await page.locator("[data-start-lightbox]").evaluate(element => element.open), false, "A swipe never opens the full photo");

    await touchDrag(page, client, await deck.boundingBox(), 160, 2);
    assert.equal(await count.innerText(), "1 / 3", "Touch reversal returns");

    await touchDrag(page, client, await deck.boundingBox(), 160, 2);
    assert.equal(await count.innerText(), "3 / 3", "Touch cycles backward from first to last");
    await touchDrag(page, client, await deck.boundingBox(), -180, 2);
    assert.equal(await count.innerText(), "1 / 3", "Touch cycles forward from last to first");

    // The click generated by the completed swipe is suppressed, but a new
    // pointerdown is a new intention even within the old ghost-click guard.
    const selected = deck.locator('a[data-current="true"]');
    await selected.dispatchEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    const dialog = page.locator("[data-start-lightbox]");
    assert.equal(await dialog.evaluate(element => element.open), false, "The completed swipe cannot ghost-open the full photograph");
    await page.waitForTimeout(300);
    const photoBox = await selected.boundingBox();
    await page.touchscreen.tap(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2);
    assert.equal(await dialog.evaluate(element => element.open), true, "A fresh quick tap opens the selected photograph");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    assert.equal(await count.innerText(), "2 / 3", "Closing preserves the last photograph selected in the full viewer");
    const returned = deck.locator('a[data-current="true"]');
    assert.equal(await returned.evaluate(element => element === document.activeElement), true, "Touch/full-view return focuses the current photograph");
    await page.keyboard.press("Home");
    await deck.scrollIntoViewIfNeeded();

    const before = await page.evaluate(() => scrollY);
    await touchDrag(page, client, await deck.boundingBox(), 2, -120);
    assert.ok(await page.evaluate(() => scrollY) > before + 25, "Vertical page scrolling remains native");
    assert.equal(await count.innerText(), "1 / 3");
    await deck.scrollIntoViewIfNeeded();
  } finally {
    await client.detach();
  }
}

async function checkCurrentTrustedTouch(browser, base, output) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let client;
  try {
    await page.goto(pageUrl(base, '/december/en/#race-day-05'));
    const { deck, count } = galleryFor(page, '05');
    await deck.waitFor(); await deck.scrollIntoViewIfNeeded();
    assert.equal(await count.innerText(), '1 / 3');
    const first = deck.locator('[data-start-photo="0"] img');
    await page.waitForFunction(image => image.complete && image.naturalWidth > 0, await first.elementHandle());
    await first.evaluate(image => image.decode());
    client = await page.context().newCDPSession(page);
    const photo = await first.boundingBox();
    assert.ok(photo, 'The real first portrait supplies the touch surface');
    await touchDrag(page, client, photo, -photo.width * .65, 2);
    await page.waitForFunction(element => element.dataset.photoIndex === '1' && element.dataset.turning !== 'true', await deck.elementHandle());
    assert.equal(await count.innerText(), '2 / 3');
    const video = deck.locator('[data-start-photo="1"] video');
    assert.equal(await video.evaluate(video => video.controls), true);
    // Include the compatibility-click window, rather than sampling only the
    // touchend callback before a generated click could reach the new player.
    await page.waitForTimeout(350);
    const dialog = page.locator('[data-start-lightbox]');
    assert.equal(await dialog.evaluate(element => element.open), false, 'A trusted photo-to-video swipe never ghost-opens the viewer');
    assert.equal(await video.evaluate(video => video.paused), true, 'A series swipe never autoplays the next video');
    await video.scrollIntoViewIfNeeded();
    await video.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(video => !video.paused && video.currentTime > .15, await video.elementHandle());
    await page.keyboard.press('Space');
    assert.equal(await video.evaluate(video => video.paused), true);
    const native = await video.boundingBox();
    assert.ok(native, 'The loaded native player supplies its own control surface');
    await touchDrag(page, client, { ...native, y: native.y + native.height - 28, height: 20 },
      -Math.min(100, native.width * .3), 1);
    assert.equal(await count.innerText(), '2 / 3', 'A native video gesture stays with the player');
    assert.equal(await dialog.evaluate(element => element.open), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await saveFrame(page, output, 'chromium-current-mixed-trusted-touch');
  } finally {
    await client?.detach();
    await page.close();
  }
}

async function checkPhone(browser, engine, base, output) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    await page.goto(pageUrl(base, "/december/en/#race-day-04"));
    const gallery = galleryFor(page, "04");
    const { episode, deck, count } = gallery;
    await deck.waitFor();
    assert.equal(await episode.isVisible(), true);
    await deck.scrollIntoViewIfNeeded();
    await deck.locator('[data-current="true"]').focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await count.innerText(), "2 / 3");

    // CDP dispatches trusted touch input; synthetic DOM events cannot prove scrolling.
    if (engine === "chromium") await checkTrustedTouch(page, gallery);
    await saveFrame(page, output, `${engine}-gallery-en-phone`);
    const spacing = await episode.evaluate(element => {
      const media = element.querySelector('.stage-episode__media');
      const controls = media.querySelector('.start-photo-controls');
      const scene = media.querySelector('.stage-scene');
      const story = element.querySelector('.stage-story');
      return {
        inner: scene.getBoundingClientRect().top - controls.getBoundingClientRect().bottom,
        outer: story.getBoundingClientRect().top - scene.getBoundingClientRect().bottom,
      };
    });
    assert.ok(spacing.outer > spacing.inner * 2, "The photo controls are closer to the photographs than to the following story");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally {
    await page.close();
  }
}


async function checkFullPhotoFailures(browser, base, output) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let heldSecond;
  try {
    await page.goto(pageUrl(base, "/december/en/#race-day-01"));
    const { deck } = galleryFor(page, "01");
    await deck.waitFor();
    const photos = await deck.locator("[data-start-photo]").evaluateAll(links => links.map(link => ({
      full: link.href,
      preview: link.querySelector("img").currentSrc || link.querySelector("img").src,
      alt: link.querySelector("img").alt,
    })));
    const second = photos[1];
    const third = photos[2];
    assert.notEqual(second.full, second.preview, "Day one exercises a separate full-size source");
    assert.notEqual(third.full, third.preview, "The retry also exercises a separate full-size source");

    await page.route(second.full, route => { heldSecond = route; });
    const awaitingSecond = page.waitForRequest(second.full);
    let failThird = true;
    await page.route(third.full, route => failThird ? route.abort() : route.continue());

    await deck.scrollIntoViewIfNeeded();
    await deck.locator('[data-current="true"]').focus();
    await page.keyboard.press("ArrowRight");
    await deck.locator('a[data-current="true"]').click();
    await awaitingSecond;
    const dialog = page.locator("[data-start-lightbox]");
    const image = dialog.locator("[data-start-photo-full]");
    const position = dialog.locator("[data-start-photo-position]");
    const feedback = dialog.locator(".start-lightbox__feedback");
    const status = feedback.getByRole("status");
    const retry = feedback.getByRole("button", { name: "Retry loading" });

    assert.equal(await position.innerText(), "2 / 3");
    assert.equal(await image.evaluate(element => element.src), second.preview);
    assert.equal(await image.getAttribute("alt"), second.alt);
    assert.equal(await image.getAttribute("aria-busy"), "true");
    assert.equal(await status.innerText(), "Loading the full photograph…");
    assert.equal(await feedback.isVisible(), true);
    assert.equal(await retry.isHidden(), true);
    await image.evaluate(element => element.decode());
    await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-start-photo-full]")).visibility === "visible");
    await saveFrame(page, output, "chromium-full-photo-loading-second");

    await dialog.locator("[data-start-photo-next]").click();
    await retry.waitFor({ state: "visible" });
    assert.equal(await position.innerText(), "3 / 3");
    assert.equal(await image.evaluate(element => element.src), third.preview);
    assert.equal(await image.getAttribute("alt"), third.alt);
    assert.equal(await image.getAttribute("aria-busy"), "false");
    assert.equal(await status.innerText(), "The full photograph could not load");
    await image.evaluate(element => element.decode());
    await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-start-photo-full]")).visibility === "visible");
    await saveFrame(page, output, "chromium-full-photo-error-third");

    const lateResponse = page.waitForResponse(response => response.url() === second.full);
    await heldSecond.continue();
    heldSecond = null;
    const response = await lateResponse;
    assert.equal(response.ok(), true, "The stale full-size request really succeeds");
    assert.equal(await response.finished(), null);
    // Let the original load/decode callback settle before checking its stale token.
    await page.waitForTimeout(200);
    assert.equal(await position.innerText(), "3 / 3");
    assert.equal(await image.evaluate(element => element.src), third.preview);
    assert.equal(await status.innerText(), "The full photograph could not load");
    assert.equal(await retry.isVisible(), true);
    await saveFrame(page, output, "chromium-full-photo-late-second");

    failThird = false;
    await retry.click();
    await feedback.waitFor({ state: "hidden" });
    assert.equal(await position.innerText(), "3 / 3");
    assert.equal(await image.evaluate(element => element.src), third.full);
    assert.equal(await image.getAttribute("aria-busy"), "false");
    await image.evaluate(element => element.decode());
    await saveFrame(page, output, "chromium-full-photo-retry-third");
    assert.deepEqual(errors, []);
    return { second, third };
  } finally {
    if (heldSecond) await heldSecond.abort().catch(() => {});
    await page.close();
  }
}

async function checkModuleFallback(browser, base, output) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let abortedModule = false;
  try {
    await page.route("**/stage-gallery.js*", route => {
      abortedModule = true;
      return route.abort();
    });
    await page.goto(pageUrl(base, "/december/en/#race-day-03"));
    const { episode } = galleryFor(page, "03");
    await episode.waitFor();
    const strip = episode.locator("[data-start-photo-strip]");
    const count = episode.locator("[data-start-strip-count]");
    await count.waitFor();
    assert.equal(abortedModule, true, "The gallery module really failed to load");
    assert.equal(await page.locator(".stage-scene").count(), 0);
    assert.equal(await strip.locator("[data-start-photo]").count(), 3);
    assert.equal(await strip.locator("a:not([inert])").count(), 3);
    assert.equal(await strip.evaluate(element => element.scrollWidth > element.clientWidth), true, "The ordinary photo strip still scrolls");

    await strip.scrollIntoViewIfNeeded();
    await episode.locator("[data-start-strip-next]").click();
    await page.waitForFunction(() => document.querySelector('[data-episode="03"] [data-start-strip-count]').textContent === "2 / 3");
    assert.ok(await strip.evaluate(element => element.scrollLeft) > 0);
    await episode.locator('a[href="#race-day-02"]').click();
    assert.equal(await galleryFor(page, "02").episode.isVisible(), true);
    await galleryFor(page, "02").episode.locator('a[href="#race-day-03"]').click();
    assert.equal(await episode.isVisible(), true);
    await strip.scrollIntoViewIfNeeded();
    await saveFrame(page, output, "chromium-gallery-module-fallback");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function checkNoJavaScript(browser, base, output) {
  const context = await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
  const page = await context.newPage();
  try {
    await page.goto(pageUrl(base, '/december/'));
    const episode = page.locator('[data-episode="05"]');
    assert.equal(await episode.isVisible(), true, 'The authored current story remains visible without JavaScript');
    const strip = episode.locator('[data-start-photo-strip]');
    assert.equal(await strip.locator('[data-start-photo]').count(), 3);
    const photos = strip.locator('a[data-start-photo]');
    assert.equal(await photos.count(), 2, 'The actual current series contains two native photo links');
    assert.deepEqual(await photos.evaluateAll(links => links.map(link => new URL(link.href).pathname.split('/').pop())),
      ['diary-2026-07-06-02-poster.jpg', 'diary-2026-07-06-08.jpg']);
    const video = strip.locator('video');
    assert.equal(await video.count(), 1);
    assert.ok(await video.evaluate(video => video.controls && video.playsInline && !video.autoplay && video.preload === 'none'));
    assert.equal(await video.getAttribute('width'), '720');
    assert.equal(await video.getAttribute('height'), '1280');
    assert.ok((await video.evaluate(video => video.poster)).endsWith('/diary-2026-07-06-03-poster.jpg'));
    assert.ok(await video.getAttribute('aria-label'));
    const file = strip.locator('[data-start-media-file]');
    assert.equal(await file.count(), 1);
    assert.equal(await file.evaluate(link => link.href), await video.evaluate(video => video.src));
    await file.scrollIntoViewIfNeeded();
    assert.equal(await file.isVisible(), true, 'The video file remains a visible native fallback without scripts');
    assert.ok((await page.request.head(await file.evaluate(link => link.href))).ok());
    const source = episode.locator('[data-stage-media-source]');
    assert.equal((await source.innerText()).replace(/\s+/g, ' '), 'Материалы дневника, 6 июля 2026');
    assert.equal(await strip.getAttribute('aria-describedby'), await source.getAttribute('id'));
    await source.scrollIntoViewIfNeeded();
    await saveFrame(page, output, 'chromium-gallery-no-javascript-media');
    assert.equal(await page.locator('.stage-scene').count(), 0);
    const href = await photos.first().evaluate(link => link.href);
    await photos.first().click();
    assert.equal(page.url(), href, 'The native photo URL remains usable without JavaScript');
    await saveFrame(page, output, 'chromium-gallery-no-javascript');
  } finally { await context.close(); }
}

const options = readOptions(process.argv.slice(2));
const output = path.resolve(process.env.DECEMBER_CHECK_OUTPUT || "artifacts/december-gallery");
await mkdir(output, { recursive: true });
const server = options.publicUrl ? null : await startSiteServer(options.directory);
const base = options.publicUrl || server.origin;
const results = [];
try {
  const engines = options.failuresOnly ? { chromium } : { chromium, webkit };
  for (const [engine, type] of Object.entries(engines)) {
    const browser = await type.launch();
    try {
      if (!options.failuresOnly) {
        console.log(`[december-gallery] ${engine} desktop`);
        await checkDesktop(browser, engine, base, output);
        results.push({ engine, kind: "desktop", passed: true });

        console.log(`[december-gallery] ${engine} phone / reduced motion`);
        await checkPhone(browser, engine, base, output);
        results.push({ engine, kind: "phone/reduced", passed: true });
        console.log(`[december-gallery] ${engine} actual current mixed-media series`);
        const currentMixed = await checkCurrentMixedMedia(browser, engine, base, output);
        results.push(...currentMixed.map(result => ({ engine, kind: "current-mixed-media", ...result })));
        if (engine === 'chromium') {
          await checkCurrentTrustedTouch(browser, base, output);
          results.push({ engine, kind: 'current-mixed-media/trusted-touch', passed: true });
        }
        console.log(`[december-gallery] ${engine} native portrait photographs and video`);
        const mixed = await checkMixedMedia(browser, engine, base, output);
        if (Array.isArray(mixed)) results.push(...mixed.map(result => ({ engine, kind: "mixed-media", ...result })));
        else results.push({ engine, kind: "mixed-media", ...mixed });
      }
      if (engine === "chromium") {
        console.log("[december-gallery] chromium full photograph / failure and retry");
        const sources = await checkFullPhotoFailures(browser, base, output);
        results.push({ engine, kind: "full-photo/failure-retry", passed: true, sources });

        console.log("[december-gallery] chromium gallery module / native fallback");
        await checkModuleFallback(browser, base, output);
        results.push({ engine, kind: "module-fallback", passed: true });
        await checkNoJavaScript(browser, base, output);
        results.push({ engine, kind: "no-javascript", passed: true });
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server?.close();
}
const report = { root: base.replace(/\/$/, ""), results };
await writeFile(path.join(output, "gallery-checks.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
