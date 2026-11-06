// Three photographs make one scene. Selection opens a window in place;
// the originals keep their order and are never duplicated into thumbnails.
export function createStageDeck({ strip, links, prev, next, count, reduced }) {
  const layoutMode = 'bands';
  const state = { strip, links, index: 0 };
  const field = document.createElement('div');
  field.className = 'stage-scene__field';
  field.append(...links);
  strip.append(field);
  const english = document.documentElement.lang === 'en';
  const tokens = getComputedStyle(document.documentElement);
  const token = tokens.getPropertyValue('--duration-feedback').trim();
  const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
  const wrap = n => (n % links.length + links.length) % links.length;
  const descriptions = links.map(link => link.querySelector('img').alt);
  let width = 0, gap = 0, main = 0, small = 0, vertical = false;
  let gesture, settleTimer = 0, suppressClickUntil = 0;

  function values(index) {
    return links.map((_, i) => i === index ? main : small);
  }
  function paint(sizes) {
    const property = vertical ? 'gridTemplateRows' : 'gridTemplateColumns';
    field.style[property] = sizes.map(n => `${n}px`).join(' ');
  }
  function choose(index) {
    state.index = wrap(index);
    strip.dataset.photoIndex = String(state.index);
    count.textContent = `${state.index + 1} / ${links.length}`;
    links.forEach((link, i) => {
      const current = i === state.index;
      link.inert = false;
      link.tabIndex = 0;
      link.setAttribute('aria-hidden', 'false');
      link.setAttribute('role', 'button');
      link.setAttribute('aria-pressed', String(current));
      if (current) link.setAttribute('aria-haspopup', 'dialog');
      else link.removeAttribute('aria-haspopup');
      link.dataset.current = String(current);
      const action = current
        ? (english ? 'Open full photograph' : 'Открыть полный снимок')
        : (english ? 'Expand photograph' : 'Развернуть снимок');
      link.setAttribute('aria-label', `${action}\u00a0${i + 1} ${english ? 'of' : 'из'}\u00a0${links.length}. ${descriptions[i]}`);
    });
  }
  function go(index, { instant = false } = {}) {
    clearTimeout(settleTimer);
    strip.classList.remove('is-dragging');
    strip.dataset.instant = String(instant || reduced());
    choose(index);
    paint(values(state.index));
    strip.dataset.turning = String(!instant && !reduced());
    if (!instant && !reduced()) settleTimer = setTimeout(() => { strip.dataset.turning = 'false'; }, duration);
  }
  function measure() {
    const nextWidth = strip.getBoundingClientRect().width;
    if (!nextWidth) return;
    width = nextWidth;
    gap = parseFloat(getComputedStyle(field).columnGap) || 0;
    vertical = layoutMode === 'bands' || width < 440;
    if (vertical) {
      main = width * 9 / 16;
      small = Math.max(44, Math.min(80, width * .14));
      strip.style.height = `${main + small * (links.length - 1) + gap * (links.length - 1)}px`;
      field.style.gridTemplateColumns = 'minmax(0, 1fr)';
    } else {
      small = Math.max(44, Math.min(80, (width - gap * (links.length - 1)) * .08));
      main = width - (small + gap) * (links.length - 1);
      strip.style.height = `${main * 9 / 16}px`;
      field.style.gridTemplateRows = 'minmax(0, 1fr)';
    }
    strip.dataset.sceneAxis = vertical ? 'vertical' : 'horizontal';
    go(state.index, { instant: true });
  }
  strip.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const link = event.target.closest('[data-start-photo]');
    const index = links.indexOf(link);
    if (index >= 0 && index !== state.index) {
      event.preventDefault(); event.stopImmediatePropagation();
      go(index, { instant: event.detail === 0 });
    }
  }, true);
  strip.addEventListener('keydown', event => {
    if (event.key === ' ' && links.includes(document.activeElement)) {
      event.preventDefault(); document.activeElement.click(); return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : state.index + (event.key === 'ArrowRight' ? 1 : -1);
    go(index, { instant: true }); state.focusCurrent();
  });
  prev.addEventListener('click', event => go(state.index - 1, { instant: event.detail === 0 }));
  next.addEventListener('click', event => go(state.index + 1, { instant: event.detail === 0 }));
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, dx: 0, velocity: 0,
      startIndex: state.index, dragging: false };
  });
  strip.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const property = vertical ? 'gridTemplateRows' : 'gridTemplateColumns';
      gesture.origin = (getComputedStyle(field)[property].match(/[\d.]+(?=px)/g) || []).map(Number);
      strip.dataset.instant = 'true';
      strip.classList.add('is-dragging');
      gesture.dragging = true; strip.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX; gesture.lastTime = event.timeStamp; gesture.dx = dx;
    if (!reduced()) {
      const destination = values(wrap(gesture.startIndex + Math.sign(-dx)));
      const progress = Math.min(1, Math.abs(dx) / (width * .5));
      paint(destination.map((n, i) => gesture.origin[i] + (n - gesture.origin[i]) * progress));
    }
  });
  function finish(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const drag = gesture; gesture = null;
    if (drag.dragging) {
      suppressClickUntil = performance.now() + 400;
      const flick = event.timeStamp - drag.lastTime < 90 && Math.abs(drag.dx) > 24 && Math.abs(drag.velocity) > .45;
      const advance = !cancelled && (Math.abs(drag.dx) > width * .18 || flick);
      go(drag.startIndex + (advance ? Math.sign(-drag.dx) : 0));
    }
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  }
  strip.addEventListener('pointerup', event => finish(event));
  strip.addEventListener('pointercancel', event => finish(event, true));
  strip.addEventListener('lostpointercapture', event => { if (event.target === strip && gesture) finish(event, true); });
  strip.addEventListener('dragstart', event => event.preventDefault());
  state.select = (index, options) => go(index, options);
  state.focusCurrent = () => {
    const photo = links[state.index];
    photo.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    photo.focus({ preventScroll: true });
  };
  state.restore = () => { gesture = null; measure(); };
  links.forEach(link => { link.draggable = false; link.querySelector('img').draggable = false; });
  prev.disabled = next.disabled = links.length < 2;
  strip.classList.add('stage-scene');
  choose(0); measure();
  new ResizeObserver(measure).observe(strip);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => go(state.index, { instant: true }));
  new MutationObserver(() => { if (reduced()) go(state.index, { instant: true }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  return state;
}
