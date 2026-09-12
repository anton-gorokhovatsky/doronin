export function replayPoint(data, seconds) {
  let lo = 0, hi = data.points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (data.points[mid][0] <= seconds) lo = mid; else hi = mid - 1;
  }
  return { index: lo, point: data.points[lo] };
}
export function validReplay(data) {
  if (data?.version !== 1 || data.source !== 'https://www.strava.com/activities/13190277378' || !Array.isArray(data.points) || data.points.length < 2 || data.points.length > 20000) return false;
  const start = Date.parse(data.start), end = Date.parse(data.end);
  if (!['time', 'distance'].includes(data.mode)) return false;
  if (data.mode === 'time' && (!Number.isFinite(start) || !Number.isFinite(end) || !data.start.startsWith('2024-') || end <= start || end - start > 7 * 86400000)) return false;
  if (data.mode === 'distance' && (data.start !== null || data.end !== null)) return false;
  if (!Number.isFinite(data.distanceKm) || data.distanceKm <= 0) return false;
  if (data.timing && (data.mode !== 'time' || data.timing.kind !== 'strava-lap-reconstruction' || data.timing.source !== `${data.source}/laps` || data.timing.lapCount !== 203 || data.timing.startPrecision !== 'minute' || data.timing.elapsedSeconds !== (end-start)/1000)) return false;
  let previous = [-1, -1];
  for (const point of data.points) {
    if (!Array.isArray(point) || point.length !== 4 || point.some(value => !Number.isFinite(value))
      || point[0] <= previous[0] || point[1] < previous[1] || point[2] < 0 || point[2] > 600 || point[3] < 0 || point[3] > 410) return false;
    previous = point;
  }
  return data.points[0][0] === 0 && data.points[0][1] === 0 && (data.mode === 'distance' ? Math.abs(previous[0] - data.distanceKm) < 0.01 : Math.abs(previous[0] - (end-start)/1000) < 2) && Math.abs(previous[1] - data.distanceKm) < 0.01;
}

export function initRideReplay(lightPalette, dubaiClock) {
  const panel = document.querySelector('[data-ride-replay]');
  if (!panel) return;
  const ru = document.documentElement.lang === 'ru';
  const play = panel.querySelector('[data-replay-play]');
  const slider = panel.querySelector('[data-replay-time]');
  const output = panel.querySelector('[data-replay-status]');
  const diagram = panel.querySelector('[data-replay-diagram]');
  let data, loading = false, playing = false, seconds = 0, frame, lastFrame, paintedIndex = -1;
  const end = () => data.points.at(-1)[0];
  const clockFormat = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const number = value => new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1, useGrouping: Math.abs(value) >= 10000 }).format(value);
  function paint() {
    const { index, point } = replayPoint(data, seconds);
    const timed = data.mode === 'time';
    const approximate = data.timing?.kind === 'strava-lap-reconstruction';
    const stamp = timed ? new Date(Date.parse(data.start) + point[0] * 1000) : new Date();
    const local = dubaiClock(stamp);
    const light = lightPalette(local.date, local.minutes);
    if (timed) {
      panel.style.setProperty('--replay-dark', light.dark.join(' '));
      panel.style.setProperty('--replay-beam', light.beam.join(' '));
      panel.style.setProperty('--replay-strength', String(light.strength));
      panel.style.setProperty('--replay-x', `${light.x}%`);
    }
    if (index !== paintedIndex) {
      diagram.querySelector('[data-replay-trail]').setAttribute('points', data.points.slice(0, index + 1).map(p => `${p[2]},${p[3]}`).join(' '));
      paintedIndex = index;
    }
    const dot = diagram.querySelector('circle');
    dot.setAttribute('cx', point[2]); dot.setAttribute('cy', point[3]);
    const km = `${approximate && point[1] > 0 && point[1] < data.distanceKm ? '≈ ' : ''}${number(point[1])} ${ru ? 'км' : 'km'}`;
    panel.querySelector('[data-replay-distance]').textContent = km;
    panel.querySelector('[data-replay-clock]').textContent = timed ? `${approximate ? '≈ ' : ''}${clockFormat.format(stamp)}` : ru ? 'Заезд 2024 года' : 'The 2024 ride';
    panel.querySelector('[data-replay-phase]').textContent = !timed ? (ru ? 'По дистанции' : 'By distance') : (ru ? { night:'Ночь', dawn:'Утро', day:'День', sunset:'Закат' } : { night:'Night', dawn:'Morning', day:'Day', sunset:'Sunset' })[light.phase];
    const elapsed = `${Math.floor(point[0] / 3600)}:${String(Math.floor(point[0] / 60) % 60).padStart(2,'0')}`;
    panel.querySelector('[data-replay-meta]').textContent = timed ? `${ru ? 'С начала записи' : 'Elapsed'} ${elapsed}` : `${ru ? 'из' : 'of'} ${number(data.distanceKm)} ${ru ? 'км' : 'km'}`;
    slider.value = String(Math.round(seconds / end() * 1000));
    slider.setAttribute('aria-valuetext', timed ? `${clockFormat.format(stamp)} · ${km}` : km);
    play.textContent = playing ? ru ? 'Пауза' : 'Pause' : seconds >= end() ? ru ? 'Сначала' : 'Replay' : ru ? 'Воспроизвести' : 'Play';
  }
  const stop = () => { playing = false; cancelAnimationFrame(frame); if (data) paint(); };
  function tick(now) {
    if (!playing) return;
    seconds = Math.min(end(), seconds + (now - lastFrame) / 1000 * (data.mode === 'time' ? 1200 : data.distanceKm / 75));
    lastFrame = now;
    if (seconds >= end()) playing = false;
    paint();
    if (playing) frame = requestAnimationFrame(tick);
  }
  async function load() {
    if (data || loading || !panel.open) return;
    loading = true;
    output.textContent = ru ? 'Загружаем запись заезда…' : 'Loading the ride…';
    try {
      const response = await fetch(panel.dataset.replayUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Unavailable');
      const payload = await response.json();
      if (!validReplay(payload)) throw new Error('Invalid record');
      data = payload;
      slider.max = '1000';
      slider.step = '1';
      diagram.querySelector('[data-replay-route]').setAttribute('points', data.points.map(p => `${p[2]},${p[3]}`).join(' '));
      panel.querySelector('[data-replay-controls]').hidden = false;
      panel.querySelector('[data-replay-scene]').hidden = false;
      output.textContent = data.mode === 'distance'
        ? ru ? 'Воспроизведение по дистанции: в GPX нет временных отметок.' : 'Distance replay: this GPX has no timestamps.'
        : data.timing ? ru ? 'Время восстановлено по 203 отрезкам Strava. Положение внутри отрезка приблизительное. 1 секунда = 20 минут заезда.' : 'Time reconstructed from 203 Strava splits. Position within each split is approximate. 1 second = 20 minutes of the ride.'
        : ru ? '1 секунда = 20 минут заезда. Свет соответствует времени записи.' : '1 second = 20 minutes of the ride. The light follows the recorded time.';
      paint();
    } catch { output.textContent = ru ? 'Запись не загрузилась. Можно открыть оригинал в Strava.' : 'The replay could not load. Open the original on Strava.'; }
    finally { loading = false; }
  }
  play.addEventListener('click', () => {
    if (!data) return;
    if (playing) { stop(); return; }
    if (seconds >= end()) seconds = 0;
    playing = true; lastFrame = performance.now(); paint(); frame = requestAnimationFrame(tick);
  });
  slider.addEventListener('input', () => { const requested = Number(slider.value) / 1000 * end(); stop(); seconds = requested; paint(); });
  panel.addEventListener('toggle', () => { if (panel.open) void load(); else stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(panel);
  if (panel.open) void load();
}
