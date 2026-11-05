// A flat, continuous photograph field. One phase owns pointer, drag, buttons
// and keyboard; an off-screen original is recycled at the end of each lap.
export function createStageDeck({ strip, links, prev, next, count, reduced }) {
  const state = { strip, links, index: 0 };
  const field = document.createElement('div');
  field.className = 'stage-deck__field';
  field.append(...links);
  strip.append(field);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const tokens = getComputedStyle(document.documentElement);
  const feedback = tokens.getPropertyValue('--duration-feedback').trim();
  const duration = Number.parseFloat(feedback) * (feedback.endsWith('ms') ? 1 : 1000);
  const curve = (tokens.getPropertyValue('--ease-move').match(/-?[\d.]+/g) || []).map(Number);
  const wrap = value => ((value % links.length) + links.length) % links.length;
  let phase = 0;
  let targetPhase = 0;
  let photoWidth = 0;
  let stride = 0;
  let bounds;
  let gesture;
  let pointer;
  let pointerFrame = 0;
  let turnFrame = 0;
  let settleTimer = 0;
  let suppressClickUntil = 0;
  let selected = -1;

  function ease(progress) {
    if (curve.length !== 4) return progress;
    const sample = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    let low = 0, high = 1;
    for (let iteration = 0; iteration < 14; iteration++) {
      const t = (low + high) / 2;
      if (sample(curve[0], curve[2], t) < progress) low = t;
      else high = t;
    }
    return sample(curve[1], curve[3], (low + high) / 2);
  }
  function select(value) {
    const index = wrap(Math.round(value));
    if (selected === index) return;
    selected = state.index = index;
    count.textContent = `${index + 1} / ${links.length}`;
    strip.dataset.photoIndex = String(index);
    for (const [i, link] of links.entries()) {
      const current = i === index;
      link.inert = !current;
      link.tabIndex = current ? 0 : -1;
      link.setAttribute('aria-hidden', String(!current));
      link.dataset.current = String(current);
    }
  }
  function paint(value) {
    for (const [index, link] of links.entries()) {
      // Reposition only beyond the clipped field. The visible lap never resets.
      const distance = wrap(index - value + links.length / 2) - links.length / 2;
      link.style.transform = `translate3d(${distance * stride - photoWidth / 2}px,0,0)`;
    }
  }
  function cancelTurn() {
    cancelAnimationFrame(turnFrame);
    turnFrame = 0;
    strip.dataset.turning = 'false';
  }
  function clearPointer() {
    clearTimeout(settleTimer);
    cancelAnimationFrame(pointerFrame);
    settleTimer = pointerFrame = 0;
    pointer = null;
  }
  function measure() {
    const rect = strip.getBoundingClientRect();
    if (!rect.width) return;
    bounds = rect;
    photoWidth = links[0].getBoundingClientRect().width;
    stride = photoWidth + (Number.parseFloat(getComputedStyle(strip).columnGap) || 0);
  }
  function go(destination, { instant = false, keepPointer = false } = {}) {
    if (!keepPointer) clearPointer();
    cancelTurn();
    targetPhase = destination;
    strip.classList.remove('is-dragging');
    select(destination);
    if (instant || reduced() || Math.abs(destination - phase) < .00001) {
      phase = destination;
      paint(phase);
      return;
    }
    const origin = phase;
    const started = performance.now();
    strip.dataset.turning = 'true';
    function tick(now) {
      const progress = reduced() ? 1 : Math.min(1, (now - started) / duration);
      phase = progress === 1 ? destination : origin + (destination - origin) * ease(progress);
      paint(phase);
      if (progress < 1) turnFrame = requestAnimationFrame(tick);
      else { turnFrame = 0; strip.dataset.turning = 'false'; }
    }
    turnFrame = requestAnimationFrame(tick);
  }
  function phaseForIndex(index) {
    let difference = index - wrap(Math.round(targetPhase));
    if (difference > links.length / 2) difference -= links.length;
    if (difference < -links.length / 2) difference += links.length;
    return Math.round(targetPhase) + difference;
  }
  function settle() {
    const destination = Math.round(phase);
    if (pointer) pointer = { x: pointer.lastX, lastX: pointer.lastX, phase: destination };
    go(destination, { keepPointer: true });
  }
  function paintPointer() {
    pointerFrame = 0;
    if (!pointer || gesture || reduced()) return;
    phase = pointer.phase + (pointer.lastX - pointer.x) / bounds.width * links.length;
    targetPhase = phase;
    select(phase);
    paint(phase);
  }
  strip.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !fine.matches || reduced()) return;
    measure();
    pointer = { x: event.clientX, lastX: event.clientX, phase };
  });
  strip.addEventListener('pointermove', event => {
    if (gesture || event.buttons || event.pointerType !== 'mouse' || !fine.matches || reduced()) return;
    if (!pointer) {
      measure();
      pointer = { x: event.clientX, lastX: event.clientX, phase };
      return;
    }
    // Native vertical scrolling does not issue a new browsing command.
    if (event.clientX === pointer.lastX) return;
    if (turnFrame) pointer = { x: pointer.lastX, lastX: pointer.lastX, phase };
    cancelTurn();
    pointer.browsing = true;
    pointer.lastX = event.clientX;
    clearTimeout(settleTimer);
    if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    settleTimer = setTimeout(settle, duration);
  });
  strip.addEventListener('pointerleave', () => {
    if (gesture || !pointer) return;
    if (!pointer.browsing) { clearPointer(); return; }
    if (pointerFrame) { cancelAnimationFrame(pointerFrame); paintPointer(); }
    clearPointer();
    go(Math.round(phase));
  });

  prev.addEventListener('click', event => go(Math.round(targetPhase) - 1, { instant: event.detail === 0 }));
  next.addEventListener('click', event => go(Math.round(targetPhase) + 1, { instant: event.detail === 0 }));
  strip.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === 'Home' ? phaseForIndex(0) : event.key === 'End' ? phaseForIndex(links.length - 1)
      : Math.round(targetPhase) + (event.key === 'ArrowRight' ? 1 : -1);
    const photoHadFocus = links.includes(document.activeElement);
    go(destination, { instant: true });
    if (photoHadFocus) links[state.index].focus({ preventScroll: true });
  });
  function paintDrag() {
    pointerFrame = 0;
    if (!gesture?.dragging || reduced()) return;
    phase = gesture.startPhase - gesture.dx / stride;
    targetPhase = phase;
    select(phase);
    paint(phase);
  }
  function finish(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    const drag = gesture;
    gesture = null;
    if (drag.dragging) {
      suppressClickUntil = performance.now() + 400;
      const value = drag.startPhase - drag.dx / stride;
      const flick = event.timeStamp - drag.lastTime < 90 && Math.abs(drag.dx) > 24 && Math.abs(drag.velocity) > .45;
      const advance = !cancelled && (Math.abs(drag.dx) > stride * .18 || flick);
      const intent = advance ? Math.sign(-drag.dx) * .34 : 0;
      go(Math.round(cancelled ? drag.startPhase : value + intent));
    } else go(Math.round(phase), { instant: true });
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  }
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    clearPointer();
    measure();
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, dx: 0, velocity: 0, dragging: false };
  });
  strip.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      gesture.startPhase = phase;
      cancelTurn();
      strip.classList.add('is-dragging');
      gesture.dragging = true;
      strip.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;
    gesture.dx = dx;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(paintDrag);
  });
  strip.addEventListener('pointerup', event => finish(event));
  strip.addEventListener('pointercancel', event => finish(event, true));
  strip.addEventListener('lostpointercapture', event => {
    if (event.target === strip && gesture) finish(event, true);
  });
  strip.addEventListener('dragstart', event => event.preventDefault());
  strip.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  strip.addEventListener('focusin', () => {
    if (!gesture) go(Math.round(targetPhase), { instant: true });
  });
  const stopBrowsing = () => {
    if (gesture || !pointer) return;
    if (!pointer.browsing) { clearPointer(); return; }
    clearPointer();
    go(Math.round(phase), { instant: true });
  };
  window.addEventListener('scroll', stopBrowsing, { passive: true });
  window.addEventListener('blur', stopBrowsing);
  state.restore = () => { gesture = null; measure(); go(Math.round(targetPhase), { instant: true }); };
  for (const link of links) {
    link.draggable = false;
    const image = link.querySelector('img');
    image.draggable = false;
    image.loading = 'eager';
  }
  prev.disabled = next.disabled = links.length < 2;
  strip.classList.add('stage-deck');
  measure();
  select(phase);
  paint(phase);
  new ResizeObserver(() => {
    measure();
    if (!gesture) go(Math.round(targetPhase), { instant: true });
  }).observe(strip);
  fine.addEventListener('change', stopBrowsing);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => go(Math.round(targetPhase), { instant: true }));
  new MutationObserver(() => {
    if (reduced()) go(Math.round(targetPhase), { instant: true });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  return state;
}
