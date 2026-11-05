// One continuous turn joins the last photograph to the first. The same three
// original links form the faces; no duplicated photographs or reset frame.
export function createStageDeck({ strip, links, prev, next, count, reduced }) {
  const state = { strip, links, index: 0 };
  const step = 360 / links.length;
  const rotor = document.createElement('div');
  rotor.className = 'stage-deck__rotor';
  rotor.append(...links);
  strip.append(rotor);
  let targetPhase = 0;
  let phase = 0;
  let radius = 0;
  let perspective = 0;
  let gesture;
  let frame = 0;
  let turnFrame = 0;
  let suppressClickUntil = 0;
  let selectionReady = false;
  const wrap = value => ((value % links.length) + links.length) % links.length;
  const motionOff = () => reduced() || strip.dataset.keyboardMotion === 'true';
  const tokens = getComputedStyle(document.documentElement);
  const feedback = tokens.getPropertyValue('--duration-feedback').trim();
  const duration = Number.parseFloat(feedback) * (feedback.endsWith('ms') ? 1 : 1000) * 1.5;
  const curve = (tokens.getPropertyValue('--ease-move').match(/-?[\d.]+/g) || []).map(Number);
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


  function select(phase) {
    const index = wrap(Math.round(phase));
    if (selectionReady && index === state.index) return;
    selectionReady = true;
    state.index = index;
    count.textContent = `${state.index + 1} / ${links.length}`;
    prev.disabled = next.disabled = links.length < 2;
    strip.dataset.photoIndex = String(state.index);
    for (const [index, link] of links.entries()) {
      const current = index === state.index;
      link.inert = !current;
      link.tabIndex = current ? 0 : -1;
      link.setAttribute('aria-hidden', String(!current));
      link.dataset.current = String(current);
    }
  }
  function paint(value) {
    strip.dataset.motion = motionOff() ? 'instant' : 'move';
    // One projected world matrix per face avoids WebKit's incorrect nested
    // 3D composition. Camera, rotation and depth share the same phase.
    for (const [index, link] of links.entries()) {
      link.style.transform = `perspective(${perspective}px) translateZ(${-radius}px) rotateY(${(index - value) * step}deg) translateZ(${radius}px)`;
    }
    orderFaces(value);
  }

  function orderFaces(phase) {
    const faces = links.map((link, index) => ({
      link, facing: Math.cos((index - phase) * step * Math.PI / 180),
    })).sort((a, b) => a.facing - b.facing);
    for (const [rank, { link, facing }] of faces.entries()) {
      // WebKit can composite rear over front despite a correct 3D matrix.
      // Only change layer order/culling when the physical order changes.
      const layer = String(rank);
      const visibility = facing > 0 ? 'visible' : 'hidden';
      if (link.style.zIndex !== layer) link.style.zIndex = layer;
      if (link.style.visibility !== visibility) link.style.visibility = visibility;
    }
  }

  function cancelTurn() {
    if (turnFrame) cancelAnimationFrame(turnFrame);
    turnFrame = 0;
    strip.dataset.turning = 'false';
  }

  function measure() {
    const width = strip.clientWidth;
    if (!width) return;
    radius = width / (2 * Math.tan(Math.PI / links.length));
    perspective = width * 2.4;
  }
  function go(destination, { keyboard = false } = {}) {
    cancelTurn();
    targetPhase = destination;
    strip.dataset.keyboardMotion = String(keyboard);
    strip.classList.remove('is-dragging');
    select(targetPhase);
    if (motionOff() || Math.abs(targetPhase - phase) < .00001) {
      phase = targetPhase;
      paint(phase);
      return;
    }
    const origin = phase;
    const target = targetPhase;
    const started = performance.now();
    strip.dataset.turning = 'true';
    function tick(now) {
      const progress = motionOff() ? 1 : Math.min(1, (now - started) / duration);
      phase = progress === 1 ? target : origin + (target - origin) * ease(progress);
      paint(phase);
      if (progress < 1) turnFrame = requestAnimationFrame(tick);
      else { turnFrame = 0; strip.dataset.turning = 'false'; }
    }
    turnFrame = requestAnimationFrame(tick);
  }
  function phaseNow() { return phase; }

  function phaseForIndex(index) {
    let difference = index - wrap(Math.round(targetPhase));
    if (difference > links.length / 2) difference -= links.length;
    if (difference < -links.length / 2) difference += links.length;
    return Math.round(targetPhase) + difference;
  }
  state.restore = () => {
    gesture = null;
    measure();
    go(targetPhase, { keyboard: true });
  };
  prev.addEventListener('click', event => go(targetPhase - 1, { keyboard: event.detail === 0 }));
  next.addEventListener('click', event => go(targetPhase + 1, { keyboard: event.detail === 0 }));
  strip.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const phase = event.key === 'Home' ? phaseForIndex(0) : event.key === 'End' ? phaseForIndex(links.length - 1)
      : targetPhase + (event.key === 'ArrowRight' ? 1 : -1);
    const photoHadFocus = links.includes(document.activeElement);
    go(phase, { keyboard: true });
    if (photoHadFocus) links[state.index].focus({ preventScroll: true });
  });

  function paintDrag() {
    frame = 0;
    if (!gesture?.dragging || motionOff()) return;
    phase = gesture.startPhase - gesture.dx / gesture.width;
    select(phase);
    paint(phase);
  }
  function finish(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    const drag = gesture;
    if (drag.dragging) {
      suppressClickUntil = performance.now() + 400;
      const phase = drag.startPhase - drag.dx / drag.width;
      const quickFlick = event.timeStamp - drag.lastTime < 90 && Math.abs(drag.dx) > 24 && Math.abs(drag.velocity) > .45;
      const advance = !cancelled && (Math.abs(drag.dx) > drag.width * .18 || quickFlick);
      const intent = advance ? Math.sign(-drag.dx) * .34 : 0;
      go(Math.round(cancelled ? drag.startPhase : phase + intent));
    }
    gesture = null;
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  }
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, dx: 0, velocity: 0,
      width: strip.getBoundingClientRect().width, dragging: false };
  });
  strip.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      gesture.startPhase = phaseNow();
      cancelTurn();
      strip.classList.add('is-dragging');
      strip.dataset.keyboardMotion = 'false';
      paint(gesture.startPhase);
      gesture.dragging = true;
      strip.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;
    gesture.dx = dx;
    if (!frame) frame = requestAnimationFrame(paintDrag);
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
  for (const link of links) {
    link.draggable = false;
    const image = link.querySelector('img');
    image.draggable = false;
    image.loading = 'eager';
  }
  strip.classList.add('stage-deck');
  measure();
  select(targetPhase);
  paint(targetPhase);
  new ResizeObserver(() => {
    measure();
    if (!gesture) go(targetPhase, { keyboard: true });
  }).observe(strip);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => go(targetPhase, { keyboard: true }));
  return state;
}
