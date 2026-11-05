// A photograph stays a whole frame. The next one waits under its right edge.
// The native links and scroll strip remain the fallback when enhancement fails.
export function createStageDeck({ strip, links, prev, next, count, reduced }) {
  const state = { strip, links, index: 0 };
  let gesture;
  let frame = 0;
  let suppressClickUntil = 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const motionOff = () => reduced() || strip.dataset.keyboardMotion === 'true';

  function restTransform(index) {
    const distance = index - state.index;
    if (distance < 0) return 'translate3d(-118%, -4%, 0) rotate(-7deg)';
    if (!distance) return 'translate3d(0, 0, 0) rotate(0deg) scale(1)';
    return `translate3d(${distance * 4.1}%, ${distance * 3.2}%, 0) rotate(${distance * 1.6}deg) scale(${1 - distance * .035})`;
  }
  function render() {
    count.textContent = `${state.index + 1} / ${links.length}`;
    prev.disabled = state.index === 0;
    next.disabled = state.index === links.length - 1;
    strip.dataset.photoIndex = String(state.index);
    strip.dataset.motion = motionOff() ? 'instant' : 'move';
    for (const [index, link] of links.entries()) {
      const current = index === state.index;
      link.style.transform = restTransform(index);
      link.style.zIndex = String(links.length - index);
      link.inert = !current;
      link.tabIndex = current ? 0 : -1;
      link.setAttribute('aria-hidden', String(!current));
      link.dataset.current = String(current);
      link.querySelector('img').style.transform = '';
    }
  }
  function go(index, { keyboard = false } = {}) {
    state.index = clamp(index, 0, links.length - 1);
    strip.dataset.keyboardMotion = String(keyboard);
    strip.classList.remove('is-dragging');
    // Commit the last gesture position before the transition is retargeted.
    if (gesture?.dragging) strip.getBoundingClientRect();
    render();
  }
  state.restore = () => {
    gesture = null;
    strip.classList.remove('is-dragging');
    go(state.index, { keyboard: true });
  };
  prev.addEventListener('click', event => go(state.index - 1, { keyboard: event.detail === 0 }));
  next.addEventListener('click', event => go(state.index + 1, { keyboard: event.detail === 0 }));
  strip.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : state.index + (event.key === 'ArrowRight' ? 1 : -1);
    const photoHadFocus = links.includes(document.activeElement);
    go(index, { keyboard: true });
    if (photoHadFocus) links[state.index].focus({ preventScroll: true });
  });

  function paintDrag() {
    frame = 0;
    if (!gesture?.dragging) return;
    const { dx, width, transforms } = gesture;
    const hasNeighbour = dx < 0 ? state.index < links.length - 1 : state.index > 0;
    const distance = hasNeighbour ? dx : dx * .18;
    const progress = Math.min(Math.abs(distance) / width, 1);
    for (const [index, link] of links.entries()) {
      const initial = transforms[index];
      if (motionOff()) {
        link.style.transform = initial;
      } else if (index === state.index) {
        link.style.transform = `translate3d(${distance}px, ${Math.abs(distance) * .035}px, 0) ${initial} rotate(${clamp(distance / width * 7, -7, 7)}deg)`;
      } else if (index === state.index - 1 && distance > 0) {
        link.style.transform = `translate3d(${distance * 1.12}px, 0, 0) ${initial} rotate(${progress * 5}deg)`;
      } else if (index === state.index + 1 && distance < 0) {
        link.style.transform = `translate3d(${-progress * width * .025}px, ${-progress * width * .016}px, 0) ${initial} rotate(${-progress * 1.6}deg) scale(${1 + progress * .035})`;
      }
    }
  }
  function finish(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    const drag = gesture;
    if (drag.dragging) {
      suppressClickUntil = performance.now() + 400;
      const quickFlick = event.timeStamp - drag.lastTime < 90 && Math.abs(drag.dx) > 24 && Math.abs(drag.velocity) > .45;
      const advance = !cancelled && (Math.abs(drag.dx) > drag.width * .18 || quickFlick);
      go(state.index + (advance ? (drag.dx < 0 ? 1 : -1) : 0));
    }
    gesture = null;
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  }
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, dx: 0, velocity: 0,
      width: strip.getBoundingClientRect().width, dragging: false };
    strip.dataset.keyboardMotion = 'false';
  });
  strip.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // Freeze the browser's actual current transforms, including an interrupted
      // transition. A second gesture starts here, never at an old endpoint.
      gesture.transforms = links.map(link => getComputedStyle(link).transform);
      strip.classList.add('is-dragging');
      for (const [index, link] of links.entries()) link.style.transform = gesture.transforms[index];
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
    // Touch first captures the anchor implicitly. Its bubbling release when
    // capture moves to the strip is not a cancellation of our new gesture.
    if (event.target === strip && gesture) finish(event, true);
  });
  strip.addEventListener('dragstart', event => event.preventDefault());
  strip.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    // The visible edge is a second, generous way to turn to the next frame.
    if (event.target === strip && state.index < links.length - 1) {
      event.preventDefault(); go(state.index + 1, { keyboard: event.detail === 0 });
    }
  }, true);
  for (const link of links) {
    link.draggable = false;
    const image = link.querySelector('img');
    image.draggable = false;
    image.loading = 'eager';
  }
  strip.classList.add('stage-deck');
  render();
  return state;
}
