// Dubai's light is computed for the city, never presented as the rider's location.
// Solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
const DUBAI = { latitude: 25.2048, longitude: 55.2708, offset: 4 };
const RAD = Math.PI / 180;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;

export function dubaiClock(now = new Date()) {
  const local = new Date(now.getTime() + DUBAI.offset * 3600000);
  return { date: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function solarPosition(date, minutes) {
  const day = new Date(`${date}T12:00:00Z`);
  const year = day.getUTCFullYear();
  const ordinal = Math.floor((day - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  // Daily solar terms use noon, keeping that day's sunrise/sunset stable as time moves.
  const gamma = 2 * Math.PI / days * (ordinal - 1);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latitude = DUBAI.latitude * RAD;
  const noon = 720 - 4 * DUBAI.longitude - equation + DUBAI.offset * 60;
  const halfDay = Math.acos(clamp((Math.cos(90.833 * RAD) / Math.cos(latitude) / Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination), -1, 1)) / RAD * 4;
  const hourAngle = (minutes - noon) / 4 * RAD;
  const altitude = Math.asin(clamp(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle), -1, 1)) / RAD;
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)) / RAD + 180 + 360) % 360;
  const phase = altitude < -6 ? 'night' : altitude < 12 ? (minutes < noon ? 'dawn' : 'sunset') : 'day';
  return { altitude, azimuth, phase, sunrise: noon - halfDay, sunset: noon + halfDay, noon };
}

// Palette is art direction. Astronomy positions it; a forecast is never invented.
const PALETTES = {
  night: { paper: [229, 234, 233], dark: [5, 21, 29], beam: [140, 180, 202], strength: 0.045 },
  dawn: { paper: [240, 234, 223], dark: [13, 29, 30], beam: [240, 193, 147], strength: 0.17 },
  day: { paper: [243, 239, 228], dark: [9, 29, 25], beam: [245, 225, 185], strength: 0.12 },
  sunset: { paper: [239, 228, 213], dark: [27, 28, 24], beam: [237, 154, 101], strength: 0.24 },
};

export function lightPalette(date, minutes, weather = null) {
  const sun = solarPosition(date, minutes);
  const anchors = [
    [0, 'night'], [sun.sunrise - 45, 'night'], [sun.sunrise + 25, 'dawn'],
    [sun.sunrise + 145, 'day'], [sun.sunset - 120, 'day'],
    [sun.sunset - 15, 'sunset'], [sun.sunset + 55, 'night'], [1440, 'night'],
  ];
  const index = Math.max(1, anchors.findIndex(([minute]) => minute >= minutes));
  const [fromTime, fromKey] = anchors[index - 1];
  const [toTime, toKey] = anchors[index];
  const fraction = clamp((minutes - fromTime) / Math.max(1, toTime - fromTime));
  const amount = fraction * fraction * (3 - 2 * fraction);
  const from = PALETTES[fromKey];
  const to = PALETTES[toKey];
  const colors = Object.fromEntries(['paper', 'dark', 'beam'].map(key => [key, from[key].map((value, i) => Math.round(mix(value, to[key][i], amount)))]));
  const clouds = weather ? weather.cloudCover / 100 : 0;
  const haze = weather ? 1 - clamp(weather.visibility / 20000) : 0;
  const strength = mix(from.strength, to.strength, amount) * (1 - clouds * 0.62) * (1 - haze * 0.25);
  const daylight = clamp((sun.altitude + 6) / 18);
  const shadowLength = daylight * clamp(12 / Math.tan(Math.max(8, sun.altitude) * RAD), 8, 72);
  return {
    ...sun, ...colors, strength,
    x: mix(18, 88, clamp((sun.azimuth - 90) / 180)),
    y: mix(75, 15, clamp(sun.altitude / 60)),
    shadowX: -Math.sin(sun.azimuth * RAD) * shadowLength,
    shadowY: Math.max(5, Math.abs(Math.cos(sun.azimuth * RAD) * shadowLength)),
    diffusion: 12 + clouds * 22 + haze * 14,
    windAngle: weather?.windDirection ?? 120,
    airOpacity: weather ? Math.min(0.06, weather.windSpeed / 160) * daylight : 0,
  };
}

const WEATHER_AGE = 90 * 60000;
export function readWeather(payload, now = Date.now()) {
  const current = payload?.current;
  if (!current || !Number.isFinite(current.time)) return null;
  const timestamp = current.time * 1000;
  if (now - timestamp > WEATHER_AGE || timestamp - now > 20 * 60000) return null;
  const valid = (key, minimum, maximum) => Number.isFinite(current[key]) && current[key] >= minimum && current[key] <= maximum;
  if (!valid('cloud_cover', 0, 100) || !valid('visibility', 0, 200000) || !valid('wind_speed_10m', 0, 100) || !valid('wind_direction_10m', 0, 360)) return null;
  return { timestamp, cloudCover: current.cloud_cover, visibility: current.visibility, windSpeed: current.wind_speed_10m, windDirection: current.wind_direction_10m };
}

function initDubaiLight() {
  const widget = document.querySelector('[data-dubai-controls]');
  if (!widget) return;
  const root = document.documentElement;
  const lang = root.lang === 'en' ? 'en' : 'ru';
  const words = lang === 'ru' ? {
    dawn: 'Утро', day: 'День', sunset: 'Закат', night: 'Ночь', city: 'Дубай',
    preview: 'Свет дня старта · 1 декабря 2026', current: 'Дубай сейчас',
    hint: 'Сдвиньте время — свет на странице пройдёт путь от рассвета к ночи.',
    liveHint: 'Страница следует местному времени в Дубае.',
    previewData: 'Положение солнца рассчитано для 1 декабря. Погода станет известна ближе к старту.',
    loading: 'Солнечный свет · уточняем погоду', fallback: 'Солнечный свет · погода недоступна',
    weather: 'Погода по модели Open-Meteo ·', sunrise: 'Восход', sunsetLabel: 'Закат',
  } : {
    dawn: 'Morning', day: 'Day', sunset: 'Sunset', night: 'Night', city: 'Dubai',
    preview: 'Start-day light · December 1, 2026', current: 'Dubai now',
    hint: 'Move through the day to see the light on this page change from dawn to night.',
    liveHint: 'The page follows the local time in Dubai.',
    previewData: 'Sunlight is calculated for December 1. Weather will be known closer to the start.',
    loading: 'Sunlight · checking the weather', fallback: 'Sunlight · weather unavailable',
    weather: 'Open-Meteo weather model ·', sunrise: 'Sunrise', sunsetLabel: 'Sunset',
  };
  const startDate = widget.dataset.startDate;
  const slider = widget.querySelector('input[type="range"]');
  const clockOutput = widget.querySelector('[data-dubai-clock]');
  const phaseOutput = widget.querySelector('[data-dubai-phase]');
  const modeOutput = widget.querySelector('[data-dubai-mode-label]');
  const hintOutput = widget.querySelector('[data-dubai-hint]');
  const sourceOutput = widget.querySelector('[data-dubai-source]');
  const sourceLink = widget.querySelector('[data-dubai-source-link]');
  const heroOutput = document.querySelector('[data-dubai-caption]');
  const buttons = [...widget.querySelectorAll('[data-dubai-mode]')];
  const clockFormat = value => `${String(Math.floor(clamp(Math.round(value), 0, 1439) / 60)).padStart(2, '0')}:${String(clamp(Math.round(value), 0, 1439) % 60).padStart(2, '0')}`;
  let mode = dubaiClock().date < startDate ? 'preview' : 'current';
  let previewMinutes = dubaiClock().minutes;
  let weather = null;
  let lastRequest = 0;
  let requestInFlight = false;
  let timer;
  let disposed = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem('11111-dubai-light'));
    if (['preview', 'current'].includes(saved?.mode) && Number.isFinite(saved?.minutes)) {
      mode = saved.mode; previewMinutes = clamp(saved.minutes, 0, 1439);
    }
  } catch { /* The experience works without storage. */ }
  const save = () => {
    try { sessionStorage.setItem('11111-dubai-light', JSON.stringify({ mode, minutes: previewMinutes })); } catch { /* Optional. */ }
  };

  function paint() {
    if (disposed) return;
    const current = dubaiClock();
    const minutes = mode === 'preview' ? previewMinutes : current.minutes;
    const date = mode === 'preview' ? startDate : current.date;
    if (weather && Date.now() - weather.timestamp > WEATHER_AGE) weather = null;
    const light = lightPalette(date, minutes, mode === 'current' ? weather : null);
    for (const key of ['paper', 'dark', 'beam']) root.style.setProperty(`--dubai-${key}`, light[key].join(' '));
    for (const [key, value] of Object.entries({ strength: light.strength, x: `${light.x}%`, y: `${light.y}%`, 'shadow-x': `${light.shadowX}px`, 'shadow-y': `${light.shadowY}px`, diffusion: `${light.diffusion}px`, 'wind-angle': `${light.windAngle}deg`, 'air-opacity': light.airOpacity })) {
      root.style.setProperty(`--dubai-${key}`, String(value));
    }
    root.dataset.dubaiLight = light.phase;
    root.dataset.dubaiMode = mode;
    widget.dataset.weather = mode === 'preview' ? 'preview' : weather ? 'fresh' : requestInFlight ? 'loading' : 'unavailable';
    slider.value = String(minutes);
    slider.disabled = mode === 'current';
    slider.setAttribute('aria-valuetext', `${clockFormat(minutes)} · ${words[light.phase]} · ${words.city}`);
    clockOutput.textContent = clockFormat(minutes);
    clockOutput.dateTime = `${date}T${clockFormat(minutes)}:00+04:00`;
    phaseOutput.textContent = words[light.phase];
    modeOutput.textContent = mode === 'preview' ? words.preview : words.current;
    hintOutput.textContent = mode === 'preview' ? words.hint : words.liveHint;
    widget.querySelector('[data-dubai-sunrise]').textContent = `${words.sunrise} ${clockFormat(light.sunrise)}`;
    widget.querySelector('[data-dubai-sunset]').textContent = `${words.sunsetLabel} ${clockFormat(light.sunset)}`;
    slider.style.setProperty('--day-start', `${light.sunrise / 1440 * 100}%`);
    slider.style.setProperty('--day-end', `${light.sunset / 1440 * 100}%`);
    sourceOutput.textContent = mode === 'preview' ? words.previewData : weather ? `${words.weather} ${clockFormat(dubaiClock(new Date(weather.timestamp)).minutes)}` : requestInFlight ? words.loading : words.fallback;
    sourceLink.hidden = mode === 'preview' || !weather;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dubaiMode === mode)));
    if (heroOutput) {
      heroOutput.hidden = false;
      heroOutput.textContent = mode === 'preview'
        ? `${words.city} · ${lang === 'ru' ? 'свет 1 декабря' : 'December 1 light'} · ${clockFormat(minutes)}`
        : `${words.city} · ${clockFormat(minutes)}`;
    }
    widget.hidden = false;
  }

  async function updateWeather() {
    if (mode !== 'current' || document.hidden || disposed || requestInFlight || Date.now() - lastRequest < 30 * 60000) return;
    // The free endpoint is for local evaluation. Public use needs an approved endpoint.
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const endpoint = widget.dataset.weatherEndpoint || (local ? 'https://api.open-meteo.com/v1/forecast?latitude=25.2048&longitude=55.2708&current=cloud_cover,visibility,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timeformat=unixtime&timezone=Asia%2FDubai&forecast_days=1' : '');
    if (!endpoint) return;
    requestInFlight = true;
    lastRequest = Date.now();
    paint();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Weather unavailable');
      weather = readWeather(await response.json());
    } catch { weather = null; }
    finally { clearTimeout(timeout); requestInFlight = false; paint(); }
  }

  function tick() { paint(); void updateWeather(); }
  buttons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.dubaiMode;
    save(); tick();
  }));
  slider.addEventListener('input', () => {
    previewMinutes = Number(slider.value); save(); paint();
  });
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (!document.hidden) { tick(); timer = setInterval(tick, 60000); }
  });
  window.addEventListener('pagehide', () => { disposed = true; clearInterval(timer); });
  window.addEventListener('pageshow', () => {
    if (disposed) { disposed = false; tick(); clearInterval(timer); timer = setInterval(tick, 60000); }
  });
  tick();
  if (!document.hidden) timer = setInterval(tick, 60000);
}

if (typeof document !== 'undefined') initDubaiLight();
