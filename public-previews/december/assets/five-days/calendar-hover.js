// Calendar rows and stage navigation share one photograph for a published day.
// Their real links remain the keyboard/touch route to its photographs and story.
const calendar = document.querySelector('[data-five-days] .december-calendar');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (calendar) {
  const owners = [calendar, ...document.querySelectorAll('[data-five-days] .episode-pager')];
  const rows = owners.flatMap(owner => [...owner.querySelectorAll('[data-calendar-preview]')]);
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
      if (active && preview.firstElementChild === image) move();
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
    let y = Math.max(inset, Math.min(lastY - rect.height * .54, innerHeight - rect.height - inset));
    if (active.closest('.episode-pager')) {
      const target = active.closest('.episode-pager').getBoundingClientRect();
      // Keep one clear band for the whole pager. Moving between neighbouring
      // stories must not drag the photograph across the next destination.
      if (target.top - gap - rect.height >= inset) y = target.top - gap - rect.height;
      else if (target.bottom + gap + rect.height <= innerHeight - inset) y = target.bottom + gap;
      else if (target.right + gap + rect.width <= innerWidth - inset) x = target.right + gap;
      else if (target.left - gap - rect.width >= inset) x = target.left - gap - rect.width;
      else { preview.dataset.visible = 'false'; return; }
    }
    const delta = lastPointerX === undefined ? 0 : lastX - lastPointerX;
    const reduced = motion.matches || document.documentElement.dataset.reduceMotion === 'true';
    const angle = reduced ? 0 : Math.max(-3, Math.min(3, delta * .06));
    preview.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
    lastPointerX = lastX;
    const image = preview.firstElementChild;
    preview.dataset.visible = String(Boolean(image?.complete && image.naturalWidth > 0));
  }

  function hide() {
    active = null;
    lastPointerX = undefined;
    preview.dataset.visible = 'false';
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = 0;
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !pointer.matches) return;
    const owner = event.target.closest('.december-calendar, .episode-pager');
    const row = owners.includes(owner) ? event.target.closest('[data-calendar-preview]') : null;
    if (!row || !owner.contains(row)) { hide(); return; }
    lastX = event.clientX;
    lastY = event.clientY;
    if (active !== row) {
      const newlyOpened = !active || active.closest('.december-calendar, .episode-pager') !== owner;
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
  document.addEventListener('pointerleave', hide);
  document.addEventListener('pointercancel', hide);
  document.addEventListener('focusin', hide);
  window.addEventListener('scroll', hide, {passive: true});
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide, {passive: true});
  document.addEventListener('keydown', hide);
  pointer.addEventListener('change', hide);
  document.addEventListener('visibilitychange', hide);

  const past = calendar.querySelector('[data-calendar-past]');
  if (past) {
    const summary = past.querySelector('summary');
    const hashTarget = hash => document.getElementById(hash.slice(1));
    const isPreviousTarget = target => target && past.contains(target) && target !== past;
    function syncPastLanguageLinks() {
      for (const link of document.querySelectorAll('[data-language-switch]')) {
        const url = new URL(link.href);
        if (past.open) url.searchParams.set('past', '1');
        else url.searchParams.delete('past');
        link.href = url.href;
      }
    }
    function writePastState() {
      const url = new URL(location.href);
      if (past.open) url.searchParams.set('past', '1');
      else {
        if (past.contains(document.activeElement) && document.activeElement !== summary) summary.focus({preventScroll: true});
        url.searchParams.delete('past');
        if (isPreviousTarget(hashTarget(url.hash))) url.hash = '#calendar-past';
      }
      if (url.href !== location.href) history.replaceState(history.state, '', url);
      syncPastLanguageLinks();
      hide();
    }
    function restorePastState({scroll = false} = {}) {
      const target = hashTarget(location.hash);
      const previousTarget = isPreviousTarget(target);
      past.open = new URLSearchParams(location.search).get('past') === '1' || previousTarget;
      if (!past.open && past.contains(document.activeElement)) summary.focus({preventScroll: true});
      syncPastLanguageLinks();
      if (scroll && previousTarget) requestAnimationFrame(() => target.scrollIntoView({block: 'start', behavior: 'instant'}));
    }
    past.addEventListener('toggle', writePastState);
    // Expand before the browser resolves a real fragment link into the archive.
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target.closest('a[href]');
      if (!link) return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname === location.pathname && isPreviousTarget(hashTarget(url.hash))) {
        past.open = true;
        writePastState();
      }
    }, {capture: true});
    window.addEventListener('hashchange', () => restorePastState({scroll: true}));
    window.addEventListener('popstate', () => restorePastState({scroll: true}));
    restorePastState({scroll: true});
  }

  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (!pointer.matches || !entries.some(entry => entry.isIntersecting)) return;
      rows.forEach(frameFor);
      near.disconnect();
    }, {rootMargin: '200px'});
    owners.forEach(owner => near.observe(owner));
  }
}
