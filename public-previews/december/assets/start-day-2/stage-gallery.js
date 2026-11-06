// A native-aspect media window: portrait photos and videos, with landscape fallback.
export function createStageDeck({ strip, links, prev, next, count, reduced, onSelect = () => {} }) {
  const state = { strip, links, index: 0 };
  const field = document.createElement('div');
  field.className = 'stage-scene__field';
  field.append(...links); strip.append(field);
  const controls = next.closest('.start-photo-controls');
  if (controls) strip.before(controls);
  const media = links.map(link => link.querySelector('img, video'));
  const english = document.documentElement.lang === 'en';
  const tokens = getComputedStyle(document.documentElement);
  const token = tokens.getPropertyValue('--duration-feedback').trim();
  const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000) || 180;
  const wrap = n => (n % links.length + links.length) % links.length;
  let gesture, animation, animationRequest = 0, suppressClickUntil = 0, signature = '';

  function ratio(index) {
    const item = media[index], link = links[index];
    const width = Number(link.dataset.mediaWidth || item.getAttribute('width')) || item.naturalWidth || item.videoWidth;
    const height = Number(link.dataset.mediaHeight || item.getAttribute('height')) || item.naturalHeight || item.videoHeight;
    return width > 0 && height > 0 ? width / height : 1;
  }
  function measure() {
    const width = strip.getBoundingClientRect().width;
    if (!width) return;
    const gap = parseFloat(getComputedStyle(field).rowGap) || 0;
    const toolbar = controls?.getBoundingClientRect().height || 0;
    strip.closest('.stage-photos').style.setProperty('--stage-toolbar-block', `${toolbar}px`);
    const budget = Math.max(160, innerHeight * .82 - toolbar - gap);
    const current = links[state.index];
    const actions = current.querySelector('.start-media__actions');
    const error = current.querySelector('.start-media__error');
    const actionHeight = (actions?.getBoundingClientRect().height || 0) +
      (error && !error.hidden ? error.getBoundingClientRect().height + gap : 0);
    const defaultActions = Math.max(44, parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.75);
    const sizes = links.map((link, index) => {
      const extra = media[index].tagName === 'VIDEO' ? (actionHeight || defaultActions) + gap : 0;
      const aspect = ratio(index);
      const itemWidth = Math.min(width, budget * aspect);
      return { width: itemWidth, height: itemWidth / aspect, extra };
    });
    const nextSignature = JSON.stringify([state.index, width, budget, sizes]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    links.forEach((link, index) => {
      link.style.setProperty('--stage-media-inline', `${sizes[index].width}px`);
      link.style.setProperty('--stage-media-block', `${sizes[index].height}px`);
    });
    // Navigation stays above the frame; native media and its actions flow below.
    const activeSize = sizes[state.index];
    field.style.height = `${activeSize.height + activeSize.extra}px`;
  }
  function go(index, { instant = false } = {}) {
    const previous = state.index;
    state.index = wrap(index);
    animation?.cancel();
    const request = ++animationRequest;
    strip.dataset.photoIndex = String(state.index);
    count.textContent = `${state.index + 1} / ${links.length}`;
    links.forEach((link, i) => {
      const current = i === state.index;
      link.hidden = !current; link.inert = !current;
      link.dataset.current = String(current);
      link.setAttribute('aria-hidden', String(!current));
      const video = media[i].tagName === 'VIDEO';
      link.tabIndex = current && !video ? 0 : -1;
      link.removeAttribute('aria-pressed');
      if (video) {
        link.setAttribute('role', 'group');
        if (!current) media[i].pause();
      } else {
        link.removeAttribute('role');
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-label', `${english ? 'Open full photograph' : 'Открыть полный снимок'}\u00a0${i + 1} ${english ? 'of' : 'из'}\u00a0${links.length}. ${media[i].alt}`);
      }
    });
    if (previous !== state.index) onSelect(state.index);
    measure(); strip.dataset.turning = 'false';
    if (previous !== state.index && !instant && !reduced()) {
      strip.dataset.turning = 'true';
      animation = links[state.index].animate([{ opacity: 0 }, { opacity: 1 }], {
        duration, easing: tokens.getPropertyValue('--ease-enter').trim() || 'ease-out',
      });
      animation.finished.catch(() => {}).then(() => {
        if (request === animationRequest) strip.dataset.turning = 'false';
      });
    }
  }
  strip.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  strip.addEventListener('keydown', event => {
    if (event.target.closest('video')) return;
    if (event.key === ' ' && links.includes(document.activeElement) && document.activeElement.tagName === 'A') {
      event.preventDefault(); document.activeElement.click(); return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    go(event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : state.index + (event.key === 'ArrowRight' ? 1 : -1), { instant: true });
    state.focusCurrent();
  });
  prev.addEventListener('click', event => go(state.index - 1, { instant: event.detail === 0 }));
  next.addEventListener('click', event => go(state.index + 1, { instant: event.detail === 0 }));
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    // Native player controls own their pointer and seek gestures.
    if (event.target.closest('video, button, .start-media__actions')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, dx: 0, velocity: 0, dragging: false };
  });
  strip.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      gesture.dragging = true; strip.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX; gesture.lastTime = event.timeStamp; gesture.dx = dx;
  });
  function finish(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const drag = gesture; gesture = null;
    if (drag.dragging) {
      suppressClickUntil = performance.now() + 400;
      const flick = event.timeStamp - drag.lastTime < 90 && Math.abs(drag.dx) > 24 && Math.abs(drag.velocity) > .45;
      if (!cancelled && (Math.abs(drag.dx) > strip.clientWidth * .18 || flick)) go(state.index + Math.sign(-drag.dx));
    }
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  }
  strip.addEventListener('pointerup', event => finish(event));
  strip.addEventListener('pointercancel', event => finish(event, true));
  strip.addEventListener('lostpointercapture', event => { if (event.target === strip && gesture) finish(event, true); });
  strip.addEventListener('dragstart', event => { if (!event.target.closest('video')) event.preventDefault(); });
  state.select = go;
  state.focusCurrent = () => {
    const item = links[state.index];
    const target = media[state.index].tagName === 'VIDEO' ? media[state.index] : item;
    target.focus({ preventScroll: true });
    const reveal = () => {
      if (document.activeElement !== target) return;
      const row = controls?.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(field).rowGap) || 0;
      if (row) {
        const floating = [...document.querySelectorAll('.site-header .menu-toggle, .site-header .site-logo, .site-header .header-actions')]
          .filter(element => {
            const style = getComputedStyle(element), rect = element.getBoundingClientRect();
            return style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
              && rect.left < row.right && rect.right > row.left;
          }).map(element => element.getBoundingClientRect().bottom);
        const top = Math.max(0, ...floating) + gap;
        if (row.top < top) window.scrollBy({ top: row.top - top, behavior: 'instant' });
      }
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };
    reveal();
    requestAnimationFrame(reveal);
  };
  state.restore = () => { gesture = null; go(state.index, { instant: true }); };
  links.forEach((link, index) => {
    link.draggable = false; media[index].draggable = false;
    media[index].addEventListener(media[index].tagName === 'VIDEO' ? 'loadedmetadata' : 'load', measure);
  });
  prev.disabled = next.disabled = links.length < 2;
  strip.classList.add('stage-scene'); go(0, { instant: true });
  const observer = new ResizeObserver(measure);
  observer.observe(strip);
  if (controls) observer.observe(controls);
  for (const element of strip.querySelectorAll('.start-media__actions, .start-media__error')) observer.observe(element);
  window.addEventListener('resize', measure, { passive: true });
  return state;
}
