import { replayPoint, validReplay } from './ride-replay.js';
import { dubaiClock, solarPosition } from './solar-clock.js';

const panel = document.querySelector('[data-ride-film]');
if (panel) {
const ru = document.documentElement.lang === 'ru';
const text = ru ? {
  totalDuration: 'Полное время · ч:мин', elapsed: 'С начала заезда · ч:мин',
  play: 'Смотреть заезд', pause: 'Пауза', replay: 'Смотреть снова', loading: 'Загрузка сцены…',
  retry: 'Повторить загрузку', failed: 'Не удалось загрузить сцену. Можно повторить или открыть фильм целиком.',
  soundOn: 'Выключить звук', soundOff: 'Включить звук', day: 'День', night: 'Ночь',
} : {
  totalDuration: 'Total duration · hr:min', elapsed: 'Elapsed time · hr:min',
  play: 'Watch the ride', pause: 'Pause', replay: 'Watch again', loading: 'Loading the scene…',
  retry: 'Try loading again', failed: 'The scene could not load. Try again or watch the full film.',
  soundOn: 'Mute', soundOff: 'Turn sound on', day: 'Day', night: 'Night',
};
const video = panel.querySelector('[data-film-video]');
const play = panel.querySelector('[data-film-play]');
const playLabel = play.querySelector('[data-film-play-label]');
const sound = panel.querySelector('[data-film-sound]');
const slider = panel.querySelector('[data-film-range]');
const status = panel.querySelector('[data-film-status]');
const diagram = panel.querySelector('[data-film-map]');
const distanceValue = panel.querySelector('[data-film-distance-value]');
const distanceApprox = panel.querySelector('[data-film-distance-approx]');
const clock = panel.querySelector('[data-film-clock]');
const timer = panel.querySelector('[data-film-total]');
const timerCaption = panel.querySelector('[data-film-duration-label]');
const chapters = [...panel.querySelectorAll('[data-film-chapter]')];
const clockFormat = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
  timeZone: 'Asia/Dubai', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const number = new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const axisFormat = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
  timeZone: 'Asia/Dubai', day: '2-digit', month: ru ? '2-digit' : 'short', hour: '2-digit', minute: '2-digit',
});
let data, montage, mediaReady, filmCuts, total = 0, seconds = 0, thresholds = [0], phase = 0;
let playing = false, soundWanted = false, loading = false, failed = false;
let frame = 0, lastPaint = 0, lastReadings = 0, loadId = 0;
const timeText = sec => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}`;
// Preserve the visible left edge as the timer changes its leading digit.
const timerOpticalStarts = { '0': '-0.071em', '1': 'var(--micra-leading-one-shift)', '2': '-0.086em', '3': '-0.094em' };
function axisText(stamp) {
  const parts = axisFormat.formatToParts(stamp);
  const part = type => parts.find(piece => piece.type === type)?.value ?? '';
  return `${part('day')}${ru ? '.' : '\u00a0'}${part('month')} · ${part('hour')}:${part('minute')}`;
}
function desiredPhase(at = seconds) {
  let found = 0;
  for (let i = 1; i < thresholds.length; i++) if (at >= thresholds[i]) found = i;
  return Math.min(3, found);
}
// Match the four recorded periods to complete film chapters. Frame rounding is
// accounted for here, so seeking and playback use the same mapping.
function mediaTime(at) {
  const i = desiredPhase(at);
  const chapter = montage.chapters[i];
  const end = thresholds[i + 1] ?? total;
  const fraction = (at - thresholds[i]) / (end - thresholds[i]);
  return (chapter.startFrame + fraction * (chapter.endFrame - chapter.startFrame)) / montage.frameRate;
}
function rideTime(at) {
  const frameNumber = at * montage.frameRate;
  const i = Math.max(0, montage.chapters.findLastIndex(chapter => frameNumber >= chapter.startFrame));
  const chapter = montage.chapters[i];
  const fraction = Math.max(0, Math.min(1, (frameNumber - chapter.startFrame) / (chapter.endFrame - chapter.startFrame)));
  return thresholds[i] + fraction * ((thresholds[i + 1] ?? total) - thresholds[i]);
}
function syncControls() {
  playLabel.textContent = loading ? text.loading : failed ? text.retry : playing ? text.pause : seconds >= total && total ? text.replay : text.play;
  play.dataset.playing = String(playing);
  play.setAttribute('aria-pressed', String(playing));
  panel.classList.toggle('is-playing', playing);
  sound.textContent = soundWanted ? text.soundOn : text.soundOff;
  sound.setAttribute('aria-pressed', String(soundWanted));
}
function paint(forceReadings = true) {
  if (!data) return;
  // The film includes stops, so the counter follows the full recording time.
  // Before the first action the poster shows the complete duration.
  const started = panel.classList.contains('has-started');
  const timerText = timeText(started ? seconds : total);
  if (timer.textContent !== timerText) timer.textContent = timerText;
  const timerLabel = started ? text.elapsed : text.totalDuration;
  if (timerCaption.textContent !== timerLabel) timerCaption.textContent = timerLabel;
  const leading = timerText[0];
  if (timer.dataset.opticalLeading !== leading) {
    timer.dataset.opticalLeading = leading;
    timer.style.setProperty('--optical-start-shift', timerOpticalStarts[leading]);
  }
  const { index, point } = replayPoint(data, seconds);
  const stamp = new Date(Date.parse(data.start) + seconds * 1000);
  const nextPhase = desiredPhase();
  phase = nextPhase;
  panel.dataset.filmPhase = String(phase);
  const mediaFrame = mediaTime(seconds) * montage.frameRate;
  const cut = filmCuts.find(piece => mediaFrame < piece.endFrame) ?? filmCuts.at(-1);
  panel.style.setProperty('--film-focal', `${cut.focal ?? 50}%`);
  panel.style.setProperty('--film-mobile-focal', `${cut.mobileFocal ?? 50}%`);
  const now = performance.now();
  if (forceReadings || now - lastReadings >= 500) {
    distanceValue.textContent = number.format(point[1]);
    distanceApprox.style.visibility = seconds > 0 && seconds < total ? 'visible' : 'hidden';
    const parts = clockFormat.formatToParts(stamp);
    const part = type => parts.find(piece => piece.type === type)?.value ?? '';
    clock.textContent = `${part('day')}\u00a0${part('month')} · ${part('hour')}:${part('minute')}`;
    clock.setAttribute('datetime', stamp.toISOString());
    lastReadings = now;
  }
  slider.value = String(Math.round(seconds));
  slider.setAttribute('aria-valuetext', `${clockFormat.format(stamp)} · ${number.format(point[1])} ${ru ? 'км' : 'km'}`);
  panel.style.setProperty('--film-progress', `${seconds / total * 100}%`);
  const dot = diagram.querySelector('circle');
  dot.setAttribute('cx', point[2]);
  dot.setAttribute('cy', point[3]);
  diagram.querySelector('[data-film-trail]').setAttribute('points', data.points.slice(0, index + 1).map(p => `${p[2]},${p[3]}`).join(' '));
  chapters.forEach((button, i) => button.setAttribute('aria-pressed', String(i === phase)));
}
function stop() {
  if (playing && !loading && video.readyState >= 2) {
    seconds = video.ended ? total : rideTime(video.currentTime);
    paint();
  }
  ++loadId;
  playing = false;
  loading = false;
  cancelAnimationFrame(frame);
  video.pause();
  syncControls();
}
function readyVideo() {
  if (mediaReady) return mediaReady;
  video.hidden = true;
  mediaReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('timeout')), 12000);
    const good = () => done();
    const bad = () => done(new Error('media'));
    function done(error) {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', good);
      video.removeEventListener('error', bad);
      error ? reject(error) : resolve();
    }
    video.addEventListener('loadeddata', good, { once: true });
    video.addEventListener('error', bad, { once: true });
  }).catch(error => { mediaReady = undefined; throw error; });
  video.src = panel.dataset.montageUrl;
  video.load();
  return mediaReady;
}
async function setMedia(resume) {
  const id = ++loadId;
  loading = true;
  failed = false;
  video.pause();
  syncControls();
  try {
    await readyVideo();
    if (id !== loadId) return false;
    // At the end, show the last actual frame. The replay action starts from zero.
    const target = Math.min(mediaTime(seconds), video.duration - 1 / montage.frameRate);
    if (Math.abs(video.currentTime - target) > 1 / (montage.frameRate * 2)) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => done(new Error('seek timeout')), 12000);
        const good = () => done();
        const bad = () => done(new Error('seek media'));
        function done(error) {
          clearTimeout(timer);
          video.removeEventListener('seeked', good);
          video.removeEventListener('error', bad);
          error ? reject(error) : resolve();
        }
        video.addEventListener('seeked', good, { once: true });
        video.addEventListener('error', bad, { once: true });
        video.currentTime = target;
      });
    }
    if (id !== loadId) return false;
    video.hidden = false;
    video.muted = !soundWanted;
    if (resume) {
      await video.play();
      if (id !== loadId || !playing) { video.pause(); return false; }
    }
  } catch {
    if (id !== loadId) return false;
    failed = true;
    stop();
    status.textContent = text.failed;
    return false;
  }
  loading = false;
  syncControls();
  return true;
}
function tick(now) {
  if (!playing) return;
  if (!loading && video.readyState >= 2) seconds = rideTime(video.currentTime);
  if (now - lastPaint > 140) { paint(false); lastPaint = now; }
  frame = requestAnimationFrame(tick);
}
async function start() {
  if (!data) return;
  if (playing || loading) { stop(); return; }
  if (seconds >= total) { seconds = 0; phase = 0; }
  playing = true;
  failed = false;
  status.textContent = '';
  panel.classList.add('has-started');
  paint();
  if (!await setMedia(true) || !playing) return;
  frame = requestAnimationFrame(tick);
  syncControls();
}
function seek(value) {
  stop();
  seconds = Math.max(0, Math.min(total, value));
  phase = desiredPhase();
  panel.classList.add('has-started');
  status.textContent = '';
  paint();
  void setMedia(false);
}
play.addEventListener('click', start);
slider.addEventListener('input', () => seek(Number(slider.value)));
chapters.forEach((button, i) => button.addEventListener('click', () => seek(thresholds[i] ?? 0)));
sound.addEventListener('click', async () => {
  soundWanted = !soundWanted;
  video.muted = !soundWanted;
  if (soundWanted && !playing) await start();
  syncControls();
});
video.addEventListener('ended', () => {
  if (!playing) return;
  seconds = total;
  paint();
  stop();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', stop);
new IntersectionObserver(entries => {
  const visible = entries[0].isIntersecting;
  if (!visible) stop();
}, { threshold: 0 }).observe(panel.querySelector('.ride-film__screen'));
const menu = document.querySelector('.menu-toggle');
if (menu) new MutationObserver(() => {
  if (menu.getAttribute('aria-expanded') === 'true') stop();
}).observe(menu, { attributes: true, attributeFilter: ['aria-expanded'] });

try {
  const [response, sources] = await Promise.all([fetch(panel.dataset.recordUrl), fetch(panel.dataset.sourcesUrl)]);
  if (!response.ok || !sources.ok) throw new Error('data');
  data = await response.json();
  montage = (await sources.json()).montage;
  if (!validReplay(data)) throw new Error('record');
  if (!montage?.file || montage.chapters?.length !== 4 || !(montage.frameRate > 0)) throw new Error('montage');
  let cutEnd = 0;
  filmCuts = montage.clips.map(cut => ({ ...cut, endFrame: cutEnd += cut.frames }));
  total = data.points.at(-1)[0];
  slider.max = String(total);
  diagram.querySelector('[data-film-route]').setAttribute('points', data.points.map(p => `${p[2]},${p[3]}`).join(' '));
  const moving = Number(panel.dataset.movingSeconds);
  if (!(moving > 0 && moving <= total)) throw new Error('moving time');
  panel.querySelector('[data-film-start]').textContent = axisText(new Date(data.start));
  panel.querySelector('[data-film-end]').textContent = axisText(new Date(data.end));
  let previousNight = false;
  for (const point of data.points) {
    const local = dubaiClock(new Date(Date.parse(data.start) + point[0] * 1000));
    const night = solarPosition(local.date, local.minutes).altitude < -6;
    if (night !== previousNight) thresholds.push(point[0]);
    previousNight = night;
  }
  paint();
  play.disabled = false;
  slider.disabled = false;
  sound.disabled = false;
  chapters.forEach(button => button.disabled = false);
} catch {
  status.textContent = ru ? 'Запись заезда недоступна. Можно открыть оригинал в Strava или посмотреть фильм.' : 'The ride record is unavailable. Open the original on Strava or watch the film.';
}

}
