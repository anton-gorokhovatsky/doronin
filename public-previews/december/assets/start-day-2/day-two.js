const lightModule = new URL('../../december-1-saved/assets/dubai-light.js', import.meta.url);
lightModule.search = new URL(import.meta.url).search;
const { lightPalette } = await import(lightModule.href);
import { solarTheme } from '../../december-1-saved/assets/solar-clock.js';

let useStageDeck = document.body.hasAttribute('data-five-days');
let createStageDeck;
if (useStageDeck) {
  try { ({ createStageDeck } = await import('./stage-gallery.js' + new URL(import.meta.url).search)); }
  catch { useStageDeck = false; }
}

// Keep the rehearsal sunlight fixed; the current forecast initializes separately.
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


// The scenario date is fixed on the page. Reading an archived stage never changes it.
const episodePanels = [...document.querySelectorAll('[data-episode]')];
const galleryStates = new Map();
const currentEpisode = sceneDate.slice(-2);
let selectedEpisode = currentEpisode;
function linkedEpisode(hash) {
  const id = /^#(?:race-day|life-story)-(\d{2})$/.exec(hash)?.[1];
  return id && galleryStates.has(id) ? id : null;
}
const reduced = () => document.documentElement.dataset.reduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const lightbox = document.querySelector('[data-start-lightbox]');
let modalGallery;
let modalIndex = 0;
let modalOpener;
const mediaVideos = new WeakMap();
const videoStates = new WeakMap();
let modalVideo;
let modalVideoHome;
function currentPhotoIndex() {
  return useStageDeck && modalGallery ? modalGallery.index : modalIndex;
}
function pauseGalleryVideos(state, except) {
  state?.pause?.(except);
  for (const link of state.links) {
    const video = mediaVideos.get(link);
    if (video && video !== except) video.pause();
  }
}
function pauseStageVideos(except) {
  for (const state of galleryStates.values()) pauseGalleryVideos(state, except);
}
function restoreModalVideo() {
  if (!modalVideo) return;
  modalVideo.pause();
  modalVideo.classList.remove('start-lightbox__video');
  modalVideo.removeAttribute('data-start-media-full');
  modalVideoHome.replaceWith(modalVideo);
  modalVideo = modalVideoHome = null;
}

let photoRequest = 0;
const photoFeedback = useStageDeck ? document.createElement('div') : null;
let photoStatus;
let photoRetry;
let videoFileLink;
function reloadVideo(video) {
  const state = videoStates.get(video);
  if (!state || state.pending) return;
  state.pending = true;
  state.resumeTime ??= video.currentTime;
  if (state.onMetadata) video.removeEventListener('loadedmetadata', state.onMetadata);
  state.onMetadata = () => {
    state.onMetadata = null;
    if (Number.isFinite(state.resumeTime) && state.resumeTime > 0 && state.resumeTime <= video.duration) video.currentTime = state.resumeTime;
  };
  video.addEventListener('loadedmetadata', state.onMetadata, { once: true });
  const message = document.documentElement.lang === 'en' ? 'Loading the video…' : 'Загружаем видео…';
  state.status.textContent = message;
  state.status.hidden = false;
  if (state.retry) state.retry.disabled = true;
  if (modalVideo === video && photoFeedback) {
    photoFeedback.hidden = false;
    photoStatus.textContent = message;
    photoRetry.disabled = true;
  }
  video.setAttribute('aria-busy', 'true');
  video.pause();
  video.preload = 'metadata';
  video.load();
}
if (photoFeedback) {
  photoFeedback.className = 'start-lightbox__feedback';
  photoFeedback.hidden = true;
  photoStatus = document.createElement('p');
  photoStatus.setAttribute('role', 'status');
  photoRetry = document.createElement('button');
  photoRetry.type = 'button';
  photoRetry.textContent = document.documentElement.lang === 'en' ? 'Retry loading' : 'Повторить загрузку';
  photoRetry.addEventListener('click', event => {
    if (!modalVideo) { showPhoto(currentPhotoIndex()); return; }
    if (event.detail === 0 || document.activeElement === photoRetry) modalVideo.focus({ preventScroll: true });
    reloadVideo(modalVideo);
  });
  videoFileLink = document.createElement('a');
  videoFileLink.textContent = document.documentElement.lang === 'en' ? 'Open video file' : 'Открыть файл видео';
  videoFileLink.hidden = true;
  photoFeedback.append(photoStatus, photoRetry, videoFileLink);
  lightbox.append(photoFeedback);
}
function showPhoto(index) {
  if (!modalGallery) return;
  restoreModalVideo();
  if (useStageDeck) {
    const selected = ((index % modalGallery.links.length) + modalGallery.links.length) % modalGallery.links.length;
    modalGallery.select(selected, { instant: true });
  } else {
    modalIndex = Math.max(0, Math.min(modalGallery.links.length - 1, index));
  }
  const selected = currentPhotoIndex();
  const link = modalGallery.links[selected];
  const image = lightbox.querySelector('[data-start-photo-full]');
  const video = mediaVideos.get(link);
  const mixed = modalGallery.links.some(item => mediaVideos.has(item));
  const en = document.documentElement.lang === 'en';
  if (mixed) {
    lightbox.setAttribute('aria-label', en ? 'Stage photographs and videos' : 'Фото и видео этапа');
    lightbox.querySelector('[data-start-photo-close]').setAttribute('aria-label', en ? 'Close viewer' : 'Закрыть просмотр');
    lightbox.querySelector('[data-start-photo-prev]').setAttribute('aria-label', en ? 'Previous item' : 'Предыдущий материал');
    lightbox.querySelector('[data-start-photo-next]').setAttribute('aria-label', en ? 'Next item' : 'Следующий материал');
  }
  lightbox.querySelector('[data-start-photo-position]').textContent = `${selected + 1} / ${modalGallery.links.length}`;
  lightbox.querySelector('[data-start-photo-prev]').disabled = !useStageDeck && selected === 0;
  lightbox.querySelector('[data-start-photo-next]').disabled = !useStageDeck && selected === modalGallery.links.length - 1;
  if (video) {
    photoRequest += 1;
    pauseStageVideos();
    image.hidden = true;
    image.removeAttribute('src');
    image.setAttribute('aria-busy', 'false');
    modalVideoHome = document.createComment('Inline video returns here after the viewer closes.');
    video.before(modalVideoHome);
    modalVideo = video;
    video.classList.add('start-lightbox__video');
    video.setAttribute('data-start-media-full', '');
    lightbox.insertBefore(video, image);
    if (photoFeedback) {
      const pending = videoStates.get(video)?.pending;
      photoFeedback.hidden = !video.error && !pending;
      photoStatus.textContent = pending ? (en ? 'Loading the video…' : 'Загружаем видео…')
        : (en ? 'The video could not load' : 'Не удалось загрузить видео');
      photoRetry.hidden = false;
      photoRetry.disabled = Boolean(pending);
      videoFileLink.href = video.currentSrc || video.src;
      videoFileLink.hidden = false;
    }
    return;
  }
  pauseStageVideos();
  image.hidden = false;
  image.alt = link.querySelector('img').alt;
  image.width = Number(link.dataset.mediaWidth) || link.querySelector('img').width;
  image.height = Number(link.dataset.mediaHeight) || link.querySelector('img').height;
  if (!useStageDeck) { image.src = link.href; return; }

  const request = ++photoRequest;
  let fullReady = false;
  // Clear the old pixels before assigning a new source. Some browsers keep
  // painting the old decoded frame while currentSrc is already empty.
  image.style.visibility = 'hidden';
  image.removeAttribute('src');
  image.setAttribute('aria-busy', 'true');
  photoStatus.textContent = en ? 'Loading the full photograph…' : 'Загружаем полный снимок…';
  photoRetry.disabled = false;
  photoRetry.hidden = true;
  videoFileLink.hidden = true;
  photoFeedback.hidden = false;

  const thumbnail = link.querySelector('img');
  const previewSource = thumbnail.currentSrc || thumbnail.src;
  image.src = previewSource;
  image.decode().then(() => {
    if (request === photoRequest && !fullReady && image.src === previewSource) {
      image.style.visibility = 'visible';
    }
  }).catch(() => {});
  const full = new Image();
  full.decoding = 'async';
  full.addEventListener('load', async () => {
    try { await full.decode(); } catch { /* A loaded image can still be shown. */ }
    if (request !== photoRequest) return;
    fullReady = true;
    image.src = full.src;
    image.style.visibility = 'visible';
    image.setAttribute('aria-busy', 'false');
    photoFeedback.hidden = true;
  }, { once: true });
  full.addEventListener('error', () => {
    if (request !== photoRequest) return;
    image.setAttribute('aria-busy', 'false');
    photoStatus.textContent = en ? 'The full photograph could not load' : 'Не удалось загрузить полный снимок';
    photoRetry.hidden = false;
  }, { once: true });
  full.src = link.href;
}

const videoVisibility = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting && !(lightbox.open && entry.target === modalVideo)) entry.target.pause();
  }
}) : null;
for (const panel of episodePanels) {
  const strip = panel.querySelector('[data-start-photo-strip]');
  if (!strip && panel.hasAttribute('data-current-day')) {
    galleryStates.set(panel.dataset.episode, {
      panel, links: [],
      restore() { panel.dispatchEvent(new Event('current-day:restore')); },
      pause() { panel.dispatchEvent(new Event('current-day:pause')); },
    });
    continue;
  }
  const links = [...strip.querySelectorAll('[data-start-photo]')];
  const prev = panel.querySelector('[data-start-strip-prev]');
  const next = panel.querySelector('[data-start-strip-next]');
  const count = panel.querySelector('[data-start-strip-count]');
  for (const link of links) {
    const video = link.querySelector('video');
    if (video) mediaVideos.set(link, video);
  }
  const state = useStageDeck
    ? createStageDeck({ strip, links, prev, next, count, reduced,
      onSelect: index => {
        for (const [i, link] of links.entries()) {
          if (i !== index) mediaVideos.get(link)?.pause();
        }
      } })
    : { strip, links, index: 0 };
  state.panel = panel;
  galleryStates.set(panel.dataset.episode, state);
  const position = index => links[index].offsetLeft - links[0].offsetLeft;
  function update() {
    if (panel.hidden) return;
    state.index = links.reduce((best, link, i) => Math.abs(position(i) - strip.scrollLeft) < Math.abs(position(best) - strip.scrollLeft) ? i : best, 0);
    if (count.classList.contains('diary-media__position')) count.innerHTML = `<strong>${String(state.index + 1).padStart(2, '0')}</strong><span> / </span><span>${String(links.length).padStart(2, '0')}</span>`;
    else count.textContent = `${state.index + 1} / ${links.length}`;
    prev.disabled = state.index === 0;
    next.disabled = state.index === links.length - 1;
  }
  function go(index) {
    const target = Math.max(0, Math.min(links.length - 1, index));
    state.index = target;
    pauseGalleryVideos(state, mediaVideos.get(links[target]));
    strip.scrollTo({ left: position(target), behavior: reduced() ? 'instant' : 'smooth' });
  }
  if (!useStageDeck) {
    state.restore = () => { strip.scrollTo({left: position(state.index), behavior:'instant'}); update(); };
    prev.addEventListener('click', () => go(state.index - 1));
    next.addEventListener('click', () => go(state.index + 1));
    strip.addEventListener('scroll', update, {passive:true});
    strip.addEventListener('keydown', event => {
      if (event.target.closest('video')) return;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); go(state.index + (event.key === 'ArrowRight' ? 1 : -1));
    });
  }
  for (const [index, link] of links.entries()) {
    const video = mediaVideos.get(link);
    if (video) {
      const status = link.querySelector('.start-media__error');
      const retry = link.querySelector('[data-start-media-retry]');
      const loading = { status, retry, pending: false, resumeTime: undefined, onMetadata: null };
      videoStates.set(video, loading);
      retry?.addEventListener('click', event => {
        if (state.index !== index) return;
        if (event.detail === 0 || document.activeElement === retry) {
          if (useStageDeck) state.focusCurrent();
          else video.focus({ preventScroll: true });
        }
        reloadVideo(video);
      });
      videoVisibility?.observe(video);
      video.addEventListener('play', () => {
        const visible = video.getBoundingClientRect();
        if (panel.hidden || document.hidden || index !== state.index ||
            document.querySelector('.nav-shell[open]') ||
            (lightbox.open && modalVideo !== video) ||
            (!lightbox.open && (visible.bottom <= 0 || visible.top >= innerHeight))) {
          video.pause();
          return;
        }
        pauseStageVideos(video);
      });
      video.addEventListener('error', () => {
        video.pause();
        loading.pending = false;
        if (loading.onMetadata) video.removeEventListener('loadedmetadata', loading.onMetadata);
        loading.onMetadata = null;
        video.setAttribute('aria-busy', 'false');
        status.textContent = document.documentElement.lang === 'en' ? 'The video could not load' : 'Не удалось загрузить видео';
        status.hidden = false;
        if (retry) { retry.hidden = false; retry.disabled = false; }
        if (modalVideo === video && photoFeedback) {
          photoStatus.textContent = document.documentElement.lang === 'en' ? 'The video could not load' : 'Не удалось загрузить видео';
          photoRetry.hidden = false;
          photoRetry.disabled = false;
          videoFileLink.hidden = false;
          photoFeedback.hidden = false;
        }
      });
      const loaded = () => {
        if (video.error || video.readyState < 2 || video.seeking) return;
        loading.pending = false;
        loading.resumeTime = undefined;
        video.setAttribute('aria-busy', 'false');
        status.hidden = true;
        if (retry) { retry.hidden = true; retry.disabled = false; }
        if (modalVideo === video && photoFeedback) { photoFeedback.hidden = true; photoRetry.disabled = false; }
      };
      video.addEventListener('loadeddata', loaded);
      video.addEventListener('seeked', loaded);
    }
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (video) return;
      event.preventDefault(); modalGallery = state; modalOpener = link; showPhoto(index);
      lightbox.showModal(); document.documentElement.classList.add('stage-photo-open');
      lightbox.querySelector('[data-start-photo-close]').focus();
    });
  }
  if (!useStageDeck) update();
}
lightbox.querySelector('[data-start-photo-prev]').addEventListener('click', () => showPhoto(currentPhotoIndex() - 1));
lightbox.querySelector('[data-start-photo-next]').addEventListener('click', () => showPhoto(currentPhotoIndex() + 1));
lightbox.querySelector('[data-start-photo-close]').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close', () => {
  photoRequest += 1;
  restoreModalVideo();
  pauseStageVideos();
  if (photoFeedback) photoFeedback.hidden = true;
  document.documentElement.classList.remove('stage-photo-open');
  if (modalGallery?.panel.hidden) return;
  if (useStageDeck) modalGallery?.focusCurrent();
  else modalOpener?.focus({preventScroll:true});
});
lightbox.addEventListener('keydown', event => {
  if (event.target.closest('video')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); showPhoto(currentPhotoIndex() + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
let touchStart;
lightbox.addEventListener('touchstart', event => {
  if (event.target.closest('video')) { touchStart = null; return; }
  const p = event.touches[0]; touchStart = {x:p.clientX, y:p.clientY};
}, {passive:true});
lightbox.addEventListener('touchend', event => {
  if (!touchStart) return;
  const p = event.changedTouches[0], dx = p.clientX - touchStart.x, dy = p.clientY - touchStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(currentPhotoIndex() + (dx < 0 ? 1 : -1));
  touchStart = null;
}, {passive:true});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseStageVideos(); });
window.addEventListener('pagehide', () => pauseStageVideos());
document.querySelector('.nav-shell')?.addEventListener('toggle', event => {
  if (event.currentTarget.open) pauseStageVideos();
});

function updateLanguageLinks() {
  for (const link of document.querySelectorAll('[data-language-switch]')) {
    const url = new URL(link.href);
    url.hash = location.hash;
    for (const name of ['theme','text']) {
      const value = new URLSearchParams(location.search).get(name);
      if (value) url.searchParams.set(name, value);
    }
    link.href = url.href;
  }
}
function selectFromHash({scroll = false, focus = false} = {}) {
  const match = linkedEpisode(location.hash);
  if (match) selectedEpisode = match;
  else if (!location.hash) selectedEpisode = currentEpisode;
  for (const panel of episodePanels) {
    panel.hidden = panel.dataset.episode !== selectedEpisode;
    if (panel.hidden) pauseGalleryVideos(galleryStates.get(panel.dataset.episode));
  }
  if (modalGallery?.panel.hidden && lightbox.open) lightbox.close();
  galleryStates.get(selectedEpisode)?.restore();
  updateLanguageLinks();
  if (match && (scroll || focus)) {
    const target = document.getElementById(location.hash.slice(1));
    if (focus) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
    }
    if (scroll) {
      target.scrollIntoView({block:'start', behavior:reduced() ? 'instant' : 'smooth'});
    }
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || !linkedEpisode(url.hash)) return;
  event.preventDefault();
  if (location.hash !== url.hash) history.pushState(null, '', url.hash);
  selectFromHash({scroll:true, focus:true});
});
window.addEventListener('hashchange', () => selectFromHash({scroll:true}));
selectFromHash();
if (linkedEpisode(location.hash)) requestAnimationFrame(() => selectFromHash({scroll:true}));
