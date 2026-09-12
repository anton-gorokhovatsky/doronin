// Centre of the supplied Challenge_1111KM.gpx bounds, rounded to four decimals.
// The user confirmed this venue for December 2026 on September 12; see docs/dubai-light.md.
// This fixed light/weather anchor is never presented as the rider's live location.
// Solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
const DUBAI = { latitude: 25.1654, longitude: 55.2851, offset: 4 };
const WEATHER_CACHE_KEY = `11111-weather-complete-${DUBAI.latitude}-${DUBAI.longitude}`;
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
  night: { paper: [215, 228, 235], dark: [4, 17, 32], beam: [112, 163, 209], strength: 0.17 },
  dawn: { paper: [242, 230, 211], dark: [13, 28, 30], beam: [255, 213, 164], strength: 0.48 },
  day: { paper: [247, 243, 233], dark: [12, 28, 27], beam: [255, 244, 216], strength: 0.46 },
  sunset: { paper: [239, 221, 191], dark: [12, 26, 29], beam: [255, 190, 103], strength: 0.65 },
};

export function lightPalette(date, minutes, weather = null, dust = null) {
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
  const uv = clamp((weather?.uvClearSky ?? 0) / 11) * (1 - clouds * 0.8);
  const heat = weather?.temperature == null ? 0 : clamp((weather.temperature - 35) / 10);
  const haze = dust ? clamp((dust.opticalDepth - 0.05) / 0.75) : 0;
  colors.beam = colors.beam.map(value => Math.round(mix(value, 255, uv * 0.25 + heat * 0.12)));
  const strength = mix(from.strength, to.strength, amount) * (1 - clouds * 0.62) * (1 + uv * 0.14);
  const daylight = clamp((sun.altitude + 6) / 18);
  const shadowLength = daylight * clamp(24 / Math.tan(Math.max(8, sun.altitude) * RAD), 14, 160);
  return {
    ...sun, ...colors, strength,
    x: mix(8, 94, clamp((sun.azimuth - 90) / 180)),
    y: mix(78, 10, clamp(sun.altitude / 60)),
    shadowX: -Math.sin(sun.azimuth * RAD) * shadowLength,
    shadowY: daylight * Math.max(5, Math.abs(Math.cos(sun.azimuth * RAD) * shadowLength)),
    diffusion: 3 + clouds * 24,
    windAngle: weather?.windDirection ?? 120,
    airOpacity: weather ? Math.min(0.06, weather.windSpeed / 160) * daylight : 0,
    airDuration: mix(36, 10, clamp((weather?.windSpeed ?? 0) / 12)),
    airX: weather ? -Math.sin(weather.windDirection * RAD) * 32 : 0,
    airY: weather ? Math.cos(weather.windDirection * RAD) * 32 : 0,
    mediaSaturation: 1 - heat * 0.15 - uv * 0.08 - haze * 0.12,
    mediaContrast: 1 + uv * 0.06 - haze * 0.08,
    dustOpacity: haze * 0.2 * daylight,
  };
}

export function readDust(payload, now = Date.now()) {
  const issuedAt = Date.parse(payload?.issuedAt);
  if (payload?.version !== 1 || payload.source !== 'NASA GEOS-FP' || payload.intervalMinutes !== 180
    || payload.grid?.latitude !== 25.25 || payload.grid?.longitude !== 55.3125
    || !Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt > 72 * 3600000
    || !Array.isArray(payload.points) || payload.points.length > 64) return null;
  const points = payload.points;
  let lastTime = -Infinity;
  for (const point of points) {
    const time = Date.parse(point?.time);
    if (!Number.isFinite(time) || time <= lastTime || !Number.isFinite(point.dustUgM3) || point.dustUgM3 < 0 || point.dustUgM3 > 100000
      || !Number.isFinite(point.opticalDepth) || point.opticalDepth < 0 || point.opticalDepth > 20) return null;
    lastTime = time;
  }
  const point = [...points].reverse().find(point => Date.parse(point.time) <= now);
  return point && now - Date.parse(point.time) < 180 * 60000 ? { ...point, issuedAt } : null;
}

const WEATHER_AGE = 90 * 60000;
const FORECAST_AGE = 18 * 3600000;
export function readWeather(payload, now = Date.now()) {
  const issuedAt = Date.parse(payload?.properties?.meta?.updated_at);
  const series = payload?.properties?.timeseries;
  if (!Number.isFinite(issuedAt) || now - issuedAt > FORECAST_AGE || issuedAt - now > 20 * 60000 || !Array.isArray(series)) return null;
  const point = series.reduce((latest, item) => {
    const timestamp = Date.parse(item?.time);
    return Number.isFinite(timestamp) && timestamp <= now && (!latest || timestamp > Date.parse(latest.time)) ? item : latest;
  }, null);
  if (!point) return null;
  const timestamp = Date.parse(point.time);
  const current = point.data?.instant?.details;
  if (!current || now - timestamp > WEATHER_AGE) return null;
  const valid = (key, minimum, maximum) => Number.isFinite(current[key]) && current[key] >= minimum && current[key] <= maximum;
  if (!valid('cloud_area_fraction', 0, 100) || !valid('wind_speed', 0, 100) || !valid('wind_from_direction', 0, 360)) return null;
  return {
    timestamp, issuedAt, cloudCover: current.cloud_area_fraction,
    windSpeed: current.wind_speed, windDirection: current.wind_from_direction,
    temperature: valid('air_temperature', -90, 70) ? current.air_temperature : null,
    uvClearSky: valid('ultraviolet_index_clear_sky', 0, 30) ? current.ultraviolet_index_clear_sky : null,
  };
}

function initDubaiLight() {
  const widget = document.querySelector('[data-dubai-controls]');
  if (!widget) return;
  const root = document.documentElement;
  const navigation = document.querySelector('.nav-shell');
  const menuWeather = navigation?.querySelector('[data-menu-weather]');
  const heroVideo = document.querySelector('[data-hero-video]');
  const syncAirMotion = () => root.style.setProperty('--dubai-air-play', !document.hidden && heroVideo && !heroVideo.paused ? 'running' : 'paused');
  heroVideo?.addEventListener('play', syncAirMotion);
  heroVideo?.addEventListener('pause', syncAirMotion);
  syncAirMotion();
  const lang = root.lang === 'en' ? 'en' : 'ru';
  const words = lang === 'ru' ? {
    dawn: 'Утро', day: 'День', sunset: 'Закат', night: 'Ночь', city: 'Дубай',
    hint: 'Сдвиньте время — свет на странице пройдёт путь от рассвета к ночи.',
    liveHint: 'Свет меняется по местному времени.',
    previewData: 'Положение солнца рассчитано для дня старта.',
    loading: 'Солнечный свет · уточняем погоду', fallback: 'Солнечный свет · погода недоступна',
    weather: 'Прогноз на', sunrise: 'Восход', sunsetLabel: 'Закат',
    forecastLoading: 'Уточняем прогноз', forecastUnavailable: 'Прогноз недоступен', windUnit: 'м/с',
    heat: 'Жара',
    directions: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
  } : {
    dawn: 'Morning', day: 'Day', sunset: 'Sunset', night: 'Night', city: 'Dubai',
    hint: 'Move through the day to see the light on this page change from dawn to night.',
    liveHint: 'The light follows local time.',
    previewData: 'Sunlight is calculated for the start date.',
    loading: 'Sunlight · checking the weather', fallback: 'Sunlight · weather unavailable',
    weather: 'Forecast for', sunrise: 'Sunrise', sunsetLabel: 'Sunset',
    forecastLoading: 'Checking the forecast', forecastUnavailable: 'Forecast unavailable', windUnit: 'm/s',
    heat: 'Heat',
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  };
  const startDate = widget.dataset.startDate;
  const dateFormat = new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' });
  const dateLabel = date => dateFormat.format(new Date(`${date}T12:00:00Z`)).replace(/ г\.$/, '').replace(/^(\d+) /, '$1\u00a0');
  const slider = widget.querySelector('input[type="range"]');
  const clockOutput = widget.querySelector('[data-dubai-clock]');
  const phaseOutput = widget.querySelector('[data-dubai-phase]');
  const modeOutput = widget.querySelector('[data-dubai-mode-label]');
  const hintOutput = widget.querySelector('[data-dubai-hint]');
  const sourceOutput = widget.querySelector('[data-dubai-source]');
  const sourceLink = widget.querySelector('[data-dubai-source-link]');
  // Invisible alternatives share one grid cell with the visible text. Their
  // natural height keeps controls in place across modes and translated wraps.
  const reserveText = (output, alternatives) => {
    const slot = document.createElement('span');
    slot.className = 'dubai-light__text-slot';
    output.before(slot);
    slot.append(output);
    return alternatives.map(text => {
      const reserve = document.createElement('span');
      reserve.className = 'dubai-light__text-reserve';
      reserve.setAttribute('aria-hidden', 'true');
      if (typeof text === 'string') reserve.textContent = text;
      else reserve.append(text);
      slot.append(reserve);
      return reserve;
    });
  };
  reserveText(hintOutput, [words.hint, words.liveHint]);
  // Reserve complete attribution rows, so the credit can stay next to the
  // visible forecast time instead of after the longest invisible fallback.
  const sourceRows = [words.previewData, words.loading, words.fallback, `${words.weather} 00:00`].map((text, index) => {
    const row = document.createElement('span');
    row.className = 'dubai-light__source-line';
    const label = document.createElement('span');
    label.textContent = text;
    row.append(label);
    if (index === 3) {
      const credit = document.createElement('span');
      credit.className = 'dubai-light__source-credit';
      credit.innerHTML = sourceLink.innerHTML;
      row.append(credit);
    }
    return row;
  });
  reserveText(sourceOutput.parentElement, sourceRows);
  reserveText(widget.querySelector('[data-dubai-phase]'), [words.dawn, words.day, words.sunset, words.night]);
  const dateReserves = reserveText(modeOutput, [dateLabel(startDate), dateLabel(dubaiClock().date)]);
  const buttons = [...widget.querySelectorAll('[data-dubai-mode]')];
  const clockFormat = value => `${String(Math.floor(clamp(Math.round(value), 0, 1439) / 60)).padStart(2, '0')}:${String(clamp(Math.round(value), 0, 1439) % 60).padStart(2, '0')}`;
  let mode = dubaiClock().date < startDate ? 'preview' : 'current';
  let previewMinutes = dubaiClock().minutes;
  let weather = null;
  let dustForecast = null;
  let nextDustRequest = 0;
  let dustRequestInFlight = false;
  let nextRequest = 0;
  let forecast = null;
  let requestInFlight = false;
  let timer;
  let disposed = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem('11111-dubai-light'));
    if (['preview', 'current'].includes(saved?.mode) && Number.isFinite(saved?.minutes)) {
      mode = saved.mode; previewMinutes = clamp(saved.minutes, 0, 1439);
    }
  } catch { /* The experience works without storage. */ }
  try {
    const saved = JSON.parse(sessionStorage.getItem(WEATHER_CACHE_KEY));
    if (Number.isFinite(saved?.nextRequest) && saved.nextRequest > Date.now() && saved.nextRequest < Date.now() + 6 * 3600000) {
      forecast = saved.forecast;
      weather = readWeather(forecast);
      if (weather) nextRequest = saved.nextRequest;
    }
  } catch { /* Browser HTTP caching remains available. */ }
  const save = () => {
    try { sessionStorage.setItem('11111-dubai-light', JSON.stringify({ mode, minutes: previewMinutes })); } catch { /* Optional. */ }
  };

  function paint() {
    dateReserves[1].textContent = dateLabel(dubaiClock().date);
    if (disposed) return;
    const current = dubaiClock();
    const minutes = mode === 'preview' ? previewMinutes : current.minutes;
    const date = mode === 'preview' ? startDate : current.date;
    weather = readWeather(forecast);
    const dust = readDust(dustForecast);
    const light = lightPalette(date, minutes, mode === 'current' ? weather : null, mode === 'current' ? dust : null);
    const nowLight = mode === 'current' ? light : lightPalette(current.date, current.minutes, weather);
    root.style.setProperty('--dubai-now-dark', nowLight.dark.join(' '));
    root.style.setProperty('--dubai-now-beam', nowLight.beam.join(' '));
    root.style.setProperty('--dubai-now-strength', String(nowLight.strength * 0.25));
    root.style.setProperty('--dubai-now-x', `${nowLight.x}%`);
    for (const key of ['paper', 'dark', 'beam']) root.style.setProperty(`--dubai-${key}`, light[key].join(' '));
    for (const [key, value] of Object.entries({ strength: light.strength, x: `${light.x}%`, y: `${light.y}%`, 'shadow-x': `${light.shadowX}px`, 'shadow-y': `${light.shadowY}px`, diffusion: `${light.diffusion}px`, 'wind-angle': `${light.windAngle}deg`, 'air-opacity': light.airOpacity, 'air-duration': `${light.airDuration}s`, 'air-x': `${light.airX}px`, 'air-y': `${light.airY}px`, 'media-saturation': light.mediaSaturation, 'media-contrast': light.mediaContrast })) {
      root.style.setProperty(`--dubai-${key}`, String(value));
    }
    root.dataset.dubaiLight = light.phase;
    root.dataset.dubaiMode = mode;
    root.style.setProperty('--dubai-dust-opacity', String(light.dustOpacity));
    const dustRow = widget.querySelector('[data-dubai-dust]');
    if (dustRow) {
      dustRow.style.visibility = mode === 'current' ? 'visible' : 'hidden';
      dustRow.setAttribute('aria-hidden', String(mode !== 'current'));
      const label = dustRow.querySelector('[data-dubai-dust-value]');
      label.textContent = dust
        ? lang === 'ru'
          ? `Пыль по модели · ${Math.round(dust.dustUgM3)} мкг/м³ · ${clockFormat(dubaiClock(new Date(dust.time)).minutes)}`
          : `Modelled dust · ${Math.round(dust.dustUgM3)} µg/m³ · ${clockFormat(dubaiClock(new Date(dust.time)).minutes)}`
        : lang === 'ru' ? 'Прогноз пыли недоступен' : 'Dust forecast unavailable';
      dustRow.querySelector('a').hidden = !dust;
    }
    widget.dataset.weather = mode === 'preview' ? 'preview' : weather ? 'fresh' : requestInFlight ? 'loading' : 'unavailable';
    slider.value = String(minutes);
    slider.disabled = mode === 'current';
    slider.setAttribute('aria-valuetext', `${clockFormat(minutes)} · ${words[light.phase]} · ${words.city}`);
    clockOutput.textContent = clockFormat(minutes);
    clockOutput.dateTime = `${date}T${clockFormat(minutes)}:00+04:00`;
    phaseOutput.textContent = words[light.phase];
    modeOutput.textContent = dateLabel(date);
    hintOutput.textContent = mode === 'preview' ? words.hint : words.liveHint;
    widget.querySelector('[data-dubai-sunrise]').textContent = `${words.sunrise} ${clockFormat(light.sunrise)}`;
    widget.querySelector('[data-dubai-sunset]').textContent = `${words.sunsetLabel} ${clockFormat(light.sunset)}`;
    slider.style.setProperty('--day-start', `${light.sunrise / 1440 * 100}%`);
    slider.style.setProperty('--day-end', `${light.sunset / 1440 * 100}%`);
    sourceOutput.textContent = mode === 'preview' ? words.previewData : weather ? `${words.weather} ${clockFormat(dubaiClock(new Date(weather.timestamp)).minutes)}` : requestInFlight ? words.loading : words.fallback;
    sourceLink.hidden = mode === 'preview' || !weather;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dubaiMode === mode)));
    widget.hidden = false;
    if (menuWeather && navigation.open) {
      const hasForecast = weather && weather.temperature !== null;
      menuWeather.querySelector('[data-menu-weather-time]').textContent = hasForecast
        ? `${words.city} · ${words.weather.toLowerCase()} ${clockFormat(dubaiClock(new Date(weather.timestamp)).minutes)}`
        : words.city;
      menuWeather.querySelector('[data-menu-weather-readings]').hidden = !hasForecast;
      const state = menuWeather.querySelector('[data-menu-weather-state]');
      state.hidden = Boolean(hasForecast);
      state.textContent = requestInFlight ? words.forecastLoading : words.forecastUnavailable;
      if (hasForecast) {
        const temperature = Math.round(weather.temperature);
        menuWeather.querySelector('[data-menu-weather-air]').textContent = `${temperature > 0 ? '+' : temperature < 0 ? '−' : ''}${Math.abs(temperature)}°`;
        const heatLabel = menuWeather.querySelector('[data-menu-weather-heat]');
        heatLabel.hidden = weather.temperature < 40;
        heatLabel.textContent = words.heat;
        const wind = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }).format(weather.windSpeed);
        menuWeather.querySelector('[data-menu-weather-wind]').textContent = `${wind} ${words.windUnit}, ${words.directions[Math.round(weather.windDirection / 45) % 8]}`;
        menuWeather.querySelector('[data-menu-weather-cloud]').textContent = `${Math.round(weather.cloudCover)}%`;
      }
      menuWeather.dataset.weather = hasForecast ? 'fresh' : requestInFlight ? 'loading' : 'unavailable';
      menuWeather.hidden = false;
    }
  }

  async function updateWeather() {
    if ((mode !== 'current' && !navigation?.open) || document.hidden || disposed || requestInFlight || Date.now() < nextRequest) return;
    // Simple CORS requests identify this site via Origin; native HTTP caching is preserved.
    const endpoint = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${DUBAI.latitude}&lon=${DUBAI.longitude}`;
    requestInFlight = true;
    nextRequest = Date.now() + 30 * 60000;
    paint();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Weather unavailable');
      forecast = await response.json();
      weather = readWeather(forecast);
      const expires = Date.parse(response.headers.get('Expires'));
      if (Number.isFinite(expires)) nextRequest = Math.max(nextRequest, expires);
      try { sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ forecast, nextRequest })); } catch { /* Optional cache. */ }
    } catch { forecast = null; weather = null; }
    finally { clearTimeout(timeout); requestInFlight = false; paint(); }
  }

  async function updateDust() {
    if (mode !== 'current' || document.hidden || disposed || dustRequestInFlight || Date.now() < nextDustRequest) return;
    dustRequestInFlight = true;
    nextDustRequest = Date.now() + 30 * 60000;
    try {
      const response = await fetch(widget.dataset.dustUrl, { credentials: 'omit', signal: AbortSignal.timeout(6500) });
      if (!response.ok) throw new Error('Dust unavailable');
      const payload = await response.json();
      dustForecast = readDust(payload) ? payload : null;
    } catch { dustForecast = null; }
    finally { dustRequestInFlight = false; paint(); }
  }
  function tick() { paint(); void updateWeather(); void updateDust(); }
  navigation?.addEventListener('toggle', () => { if (navigation.open) tick(); });
  buttons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.dubaiMode;
    save(); tick();
  }));
  slider.addEventListener('input', () => {
    previewMinutes = Number(slider.value); save(); paint();
  });
  document.addEventListener('visibilitychange', () => {
    syncAirMotion();
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

if (typeof document !== 'undefined') {
  initDubaiLight();
  const replay = document.querySelector('[data-ride-replay]');
  if (replay) import(new URL(replay.dataset.replayModule, document.baseURI)).then(module => module.initRideReplay(lightPalette, dubaiClock)).catch(() => {});
}
