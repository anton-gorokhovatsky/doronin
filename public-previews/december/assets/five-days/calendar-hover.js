// A photograph belongs to a published day. The row's real link remains the
// keyboard/touch route to the same photographs and story.
const calendar = document.querySelector('[data-five-days] .december-calendar');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (calendar) {
  const rows = [...calendar.querySelectorAll('[data-calendar-preview]')];
  const preview = document.createElement('figure');
  preview.className = 'calendar-preview';
  preview.setAttribute('aria-hidden', 'true');
  document.body.append(preview);
  const frames = new Map();
  let active = null;
  let lastX = 0;
  let lastY = 0;
  let lastPointerX;
  let scheduled = 0;

  function frameFor(row) {
    const source = row.dataset.calendarPreview;
    const cached = frames.get(source);
    if (cached && !(cached.complete && !cached.naturalWidth)) return cached;
    const image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.style.objectPosition = row.dataset.calendarPreviewPosition || '50% 50%';
    image.addEventListener('load', () => {
      if (active === row && preview.firstElementChild === image) preview.dataset.visible = 'true';
    }, {once: true});
    image.addEventListener('error', () => {
      if (preview.firstElementChild === image) preview.dataset.visible = 'false';
    }, {once: true});
    image.src = source;
    frames.set(source, image);
    return image;
  }

  function move() {
    scheduled = 0;
    if (!active) return;
    const rect = preview.getBoundingClientRect();
    // The image can overlap the table; keep it inside the viewport, beside the
    // pointer, so a nearby link never becomes difficult to reach.
    const gap = 24;
    const inset = 20;
    let x = lastX + gap;
    if (x + rect.width > innerWidth - inset) x = lastX - rect.width - gap;
    x = Math.max(inset, Math.min(x, innerWidth - rect.width - inset));
    const y = Math.max(inset, Math.min(lastY - rect.height * .54, innerHeight - rect.height - inset));
    const delta = lastPointerX === undefined ? 0 : lastX - lastPointerX;
    const reduced = motion.matches || document.documentElement.dataset.reduceMotion === 'true';
    const angle = reduced ? 0 : Math.max(-3, Math.min(3, delta * .06));
    preview.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
    lastPointerX = lastX;
  }

  function hide() {
    active = null;
    lastPointerX = undefined;
    preview.dataset.visible = 'false';
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = 0;
  }

  calendar.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !pointer.matches) return;
    const row = event.target.closest('[data-calendar-preview]');
    if (!row) { hide(); return; }
    lastX = event.clientX;
    lastY = event.clientY;
    if (active !== row) {
      const newlyOpened = !active;
      active = row;
      const image = frameFor(row);
      preview.replaceChildren(image);
      preview.dataset.day = row.dataset.calendarStart;
      preview.dataset.visible = String(image.complete && image.naturalWidth > 0);
      // Place a newly opened photograph at the pointer immediately. Adjacent
      // rows then keep the same surface instead of replaying an entrance.
      if (newlyOpened) preview.style.transition = 'none';
      move();
      if (newlyOpened) preview.getBoundingClientRect();
      preview.style.removeProperty('transition');
    }
    if (!scheduled) scheduled = requestAnimationFrame(move);
  });
  calendar.addEventListener('pointerleave', hide);
  calendar.addEventListener('pointercancel', hide);
  calendar.addEventListener('focusin', hide);
  window.addEventListener('scroll', hide, {passive: true});
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide, {passive: true});
  document.addEventListener('keydown', hide);
  pointer.addEventListener('change', hide);
  document.addEventListener('visibilitychange', hide);

  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (!pointer.matches || !entries.some(entry => entry.isIntersecting)) return;
      rows.forEach(frameFor);
      near.disconnect();
    }, {rootMargin: '200px'});
    near.observe(calendar);
  }
}
