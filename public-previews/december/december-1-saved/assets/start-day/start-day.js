import { lightPalette } from '../dubai-light.js';
import { solarTheme } from '../solar-clock.js';

// Reuse the accepted solar palette, with a declared scenario date and no weather.
const root = document.documentElement;
const sceneDate = root.dataset.startPreviewDate;
const sceneMinutes = Number(root.dataset.startPreviewMinutes);
const light = lightPalette(sceneDate, sceneMinutes);
for (const key of ['paper', 'dark', 'beam']) root.style.setProperty(`--dubai-${key}`, light[key].join(' '));
for (const [key, value] of Object.entries({strength:light.strength, x:`${light.x}%`, y:`${light.y}%`, 'shadow-x':`${light.shadowX}px`, 'shadow-y':`${light.shadowY}px`, diffusion:`${light.diffusion}px`, 'wind-angle':`${light.windAngle}deg`, 'air-opacity':light.airOpacity, 'air-duration':`${light.airDuration}s`, 'air-x':`${light.airX}px`, 'air-y':`${light.airY}px`, 'media-saturation':light.mediaSaturation, 'media-contrast':light.mediaContrast})) root.style.setProperty(`--dubai-${key}`, String(value));
root.dataset.dubaiLight = light.phase;
root.dataset.dubaiMode = 'preview';
root.dataset.solarTheme = solarTheme(sceneDate, sceneMinutes);
document.dispatchEvent(new Event('dubai-light-change'));

function initOpticalLines() {
  const headings = [...document.querySelectorAll('[data-optical-lines]')]
    .filter(element => !element.children.length)
    .map(element => ({ element, text: element.textContent, signature: '' }));
  if (!headings.length || !document.fonts) return;

  const ink = document.createElement('canvas').getContext('2d');
  let frame = 0;
  function schedule(force = false) {
    if (force) for (const heading of headings) heading.signature = '';
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const heading of headings) {
        const { element, text } = heading;
        if (!element.isConnected || !element.getBoundingClientRect().width) continue;
        const style = getComputedStyle(element);
        // Keep the unmodified, readable fallback if the local Micra face failed.
        if (style.fontFamily.includes("Micra") && !document.fonts.check(`${style.fontWeight} ${style.fontSize} "Micra"`, text)) continue;
        const signature = [element.getBoundingClientRect().width, style.fontFamily,
          style.fontSize, style.fontWeight, style.fontStyle, style.lineHeight,
          style.letterSpacing, style.wordSpacing, style.textTransform,
          style.textWrap, style.fontFeatureSettings, style.fontVariationSettings].join('|');
        if (signature === heading.signature) continue;

        // Measure the browser's own wrapping, including text-wrap: balance.
        // The original stays visible; no duplicate or hidden measuring copy is used.
        const textNode = document.createTextNode(text);
        element.replaceChildren(textNode);
        const range = document.createRange();
        const starts = [0];
        let offset = 0;
        let lineTop;
        for (const character of text) {
          const next = offset + character.length;
          if (!/\s/u.test(character)) {
            range.setStart(textNode, offset);
            range.setEnd(textNode, next);
            const rect = range.getBoundingClientRect();
            if (rect.height && lineTop !== undefined && Math.abs(rect.top - lineTop) > 1) {
              starts.push(offset);
            }
            if (rect.height) lineTop = rect.top;
          }
          offset = next;
        }
        starts.push(text.length);
        const fragment = document.createDocumentFragment();
        if (ink) ink.font = `${style.fontWeight} 1000px ${style.fontFamily}`;
        for (let index = 0; index < starts.length - 1; index += 1) {
          const line = document.createElement('span');
          line.textContent = text.slice(starts[index], starts[index + 1]);
          line.dataset.opticalLine = '';
          line.dataset.opticalStart = '';
          line.dataset.opticalInk = '';
          const leading = [...line.textContent.trimStart()][0] || '';
          line.dataset.opticalLeading = style.textTransform === 'uppercase'
            ? leading.toLocaleUpperCase(document.documentElement.lang || undefined) : leading;
          const inkLeft = ink?.measureText(line.dataset.opticalLeading).actualBoundingBoxLeft;
          if (Number.isFinite(inkLeft)) line.style.setProperty('--optical-start-shift', `${inkLeft / 1000}em`);
          fragment.append(line);
        }
        element.replaceChildren(fragment);
        heading.signature = signature;
      }
    });
  }

  document.fonts.ready.then(() => {
    schedule();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => schedule());
      for (const { element } of headings) observer.observe(element);
    }
    window.addEventListener('resize', () => schedule(), { passive: true });
    document.fonts.addEventListener('loadingdone', () => schedule(true));
  });
}
initOpticalLines();

function initStagePhotos() {
const lightbox = document.querySelector('[data-start-lightbox]');
const photographs = [...document.querySelectorAll('[data-start-photo]')];
let photoIndex = 0;
let photoOpener;

function showPhotograph(index) {
  photoIndex = Math.max(0, Math.min(photographs.length - 1, index));
  const link = photographs[photoIndex];
  const full = lightbox.querySelector('[data-start-photo-full]');
  full.src = link.href;
  full.alt = link.querySelector('img').alt;
  lightbox.querySelector('[data-start-photo-position]').textContent = `${photoIndex + 1} / ${photographs.length}`;
  lightbox.querySelector('[data-start-photo-prev]').disabled = photoIndex === 0;
  lightbox.querySelector('[data-start-photo-next]').disabled = photoIndex === photographs.length - 1;
}

for (const [index, link] of photographs.entries()) {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    photoOpener = link;
    showPhotograph(index);
    lightbox.showModal();
    document.body.style.overflow = 'hidden';
  });
}
lightbox.querySelector('[data-start-photo-close]').addEventListener('click', () => lightbox.close());
lightbox.querySelector('[data-start-photo-prev]').addEventListener('click', () => showPhotograph(photoIndex - 1));
lightbox.querySelector('[data-start-photo-next]').addEventListener('click', () => showPhotograph(photoIndex + 1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); showPhotograph(photoIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); showPhotograph(photoIndex - 1); }
});
lightbox.addEventListener('close', () => {
  document.body.style.overflow = '';
  photoOpener?.focus({ preventScroll: true });
});

const strip = document.querySelector('[data-start-photo-strip]');
const stripPrevious = document.querySelector('[data-start-strip-prev]');
const stripNext = document.querySelector('[data-start-strip-next]');
const stripCount = document.querySelector('[data-start-strip-count]');
let stripIndex = 0;
function updateStrip() {
  stripIndex = photographs.reduce((nearest, photo, i) => Math.abs(photo.offsetLeft - photographs[0].offsetLeft - strip.scrollLeft) < Math.abs(photographs[nearest].offsetLeft - photographs[0].offsetLeft - strip.scrollLeft) ? i : nearest, 0);
  stripCount.textContent = `${stripIndex + 1} / ${photographs.length}`;
  stripPrevious.disabled = stripIndex === 0;
  stripNext.disabled = stripIndex === photographs.length - 1;
}
function moveStrip(amount) {
  const next = Math.max(0, Math.min(photographs.length - 1, stripIndex + amount));
  stripIndex = next;
  strip.scrollTo({left:photographs[next].offsetLeft - photographs[0].offsetLeft, behavior:'instant'});
  updateStrip();
}
stripPrevious.addEventListener('click', () => moveStrip(-1));
stripNext.addEventListener('click', () => moveStrip(1));
strip.addEventListener('scroll', updateStrip, {passive:true});
strip.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    moveStrip(event.key === 'ArrowRight' ? 1 : -1);
  }
});
let gestureStart;
lightbox.addEventListener('touchstart', event => {
  const touch = event.touches[0];
  gestureStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
lightbox.addEventListener('touchend', event => {
  if (!gestureStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - gestureStart.x, dy = touch.clientY - gestureStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhotograph(photoIndex + (dx < 0 ? 1 : -1));
  gestureStart = null;
}, { passive: true });
updateStrip();


}
if (document.querySelector("[data-start-lightbox]") && document.querySelector("[data-start-photo-strip]")) initStagePhotos();
