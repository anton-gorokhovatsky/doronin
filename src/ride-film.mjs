// The accepted archival episode, rendered through the site's typography pass.
export function renderRideFilm(l, record, timing, version, toggleIcon, externalIcon) {
  if (!record) return '';
  const ru = l.lang === 'ru';
  const media = `${l.assetBase}assets/ride-film/`;
  const elapsed = record.points.at(-1)[0];
  const moving = timing.reportedMovingSeconds;
  if (timing.reportedElapsedSeconds !== elapsed || !(moving > 0 && moving <= elapsed)) {
    throw new Error('Film and Strava recording durations disagree');
  }
  const duration = seconds => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}`;
  const axis = iso => {
    const parts = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
      timeZone: 'Asia/Dubai', day: '2-digit', month: ru ? '2-digit' : 'short', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso));
    const part = key => parts.find(piece => piece.type === key)?.value ?? '';
    return `${part('day')}${ru ? '.' : '\u00a0'}${part('month')} · ${part('hour')}:${part('minute')}`;
  };
  const x = record.points.map(p => p[2]), y = record.points.map(p => p[3]);
  const width = Math.max(...x) - Math.min(...x) + 3;
  const height = Math.max(...y) - Math.min(...y) + 3;
  const viewBox = `${(Math.min(...x) - 1.5).toFixed(2)} ${(Math.min(...y) - 1.5).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;
  const route = record.points.map(p => `${p[2]},${p[3]}`).join(' ');
  const dates = ru ? ['24 декабря', '24–25 декабря', '25 декабря', '25–26 декабря'] : ['24 December', '24–25 December', '25 December', '25–26 December'];
  const shortDates = ru ? ['24.12', '24–25.12', '25.12', '25–26.12'] : ['24 Dec', '24–25 Dec', '25 Dec', '25–26 Dec'];
  const names = ru ? ['День', 'Ночь', 'День', 'Ночь'] : ['Day', 'Night', 'Day', 'Night'];
  const chapters = names.map((name, i) => `<button class="ride-film__chapter" type="button" data-film-chapter="${i}" aria-label="${ru ? 'Перейти к моменту: ' : 'Jump to: '}${name}, ${dates[i]}" aria-pressed="${i === 0}" disabled><b>${name}</b><span class="ride-film__chapter-date">${dates[i]}</span><span class="ride-film__chapter-date-short">${shortDates[i]}</span></button>`).join('');
  return `<article class="ride-film" id="ride-2024" aria-labelledby="ride-film-title" data-ride-film data-montage-url="${media}ride-montage.mp4?v=${version}" data-sources-url="${media}sources.json?v=${version}" data-record-url="${l.assetBase}assets/ride-2024.json?v=${version}" data-moving-seconds="${moving}">
      <div class="ride-film__screen">
        <img class="ride-film__picture" data-film-picture src="${media}cover.jpg?v=${version}" alt="" width="1280" height="720" loading="lazy">
        <video class="ride-film__video" data-film-video muted playsinline preload="none" poster="${media}cover.jpg?v=${version}" aria-describedby="ride-film-description" hidden></video>
        <header class="ride-film__meta">
          <p>${ru ? 'Дубай · 1001 км · 24–26 декабря 2024' : 'Dubai · 1001 km · 24–26 December 2024'}</p>
          <a href="#proof">${ru ? 'Из фильма «1111»' : 'From the film “1111”'}</a>
        </header>
        <h3 class="ride-film__title" id="ride-film-title">${ru ? 'Заезд 2024 года' : 'The 2024 ride'}</h3>
        <div class="ride-film__readings">
          <div class="ride-film__duration"><strong data-film-total data-optical-start style="--optical-start-shift: -.094em">${duration(elapsed)}</strong><div class="ride-film__duration-caption"><span data-film-duration-label>${ru ? 'Полное время · ч:мин' : 'Total duration · hr:min'}</span><span class="ride-film__moving-time">${ru ? 'Всего в движении — ' : 'Total moving time — '}${duration(moving)}</span></div></div>
          <div class="ride-film__position">
            <svg class="ride-film__map" data-film-map viewBox="${viewBox}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" role="img" aria-label="${ru ? 'Трасса из записи заезда 2024 года' : 'Course from the 2024 ride recording'}"><polyline data-film-route points="${route}"></polyline><polyline data-film-trail></polyline><circle r="10" cx="${record.points[0][2]}" cy="${record.points[0][3]}"></circle></svg>
            <p><strong class="ride-film__distance" data-film-distance><span class="ride-film__approx" data-film-distance-approx style="visibility:hidden">≈</span><span data-film-distance-value>${ru ? '0,0' : '0.0'}</span><span> ${ru ? 'км' : 'km'}</span></strong><span class="ride-film__clock"><span class="ride-film__approx">≈</span><time data-film-clock datetime="${record.start}">${ru ? '24 декабря · 09:58' : '24 December · 09:58'}</time></span></p>
          </div>
        </div>
        <div class="ride-film__timeline">
          <label class="sr-only" for="film-ride-time">${ru ? 'Момент записи, включая остановки' : 'Recording time, including stops'}</label>
          <input class="ride-film__range" id="film-ride-time" data-film-range type="range" min="0" max="${elapsed}" step="1" value="0" disabled aria-describedby="ride-film-description">
          <div class="ride-film__ends"><span data-film-start>${axis(record.start)}</span><span data-film-end>${axis(record.end)}</span></div>
        </div>
        <div class="ride-film__controls">
          <div class="ride-film__transport" role="group" aria-label="${ru ? 'Управление просмотром' : 'Playback controls'}">
            <button class="ride-film__play" type="button" data-film-play data-playing="false" aria-pressed="false" disabled><span data-film-play-label>${ru ? 'Смотреть заезд' : 'Watch the ride'}</span>${toggleIcon}</button>
            <button class="ride-film__sound" type="button" data-film-sound aria-pressed="false" disabled>${ru ? 'Включить звук' : 'Turn sound on'}</button>
          </div>
          <div class="ride-film__chapters" role="group" aria-label="${ru ? 'Перейти к моменту заезда' : 'Jump to a moment in the ride'}">${chapters}</div>
          <p class="ride-film__status" data-film-status role="status"></p>
          <noscript><p class="ride-film__status">${ru ? 'Для просмотра эпизода включите JavaScript. Фильм целиком и запись Strava доступны по ссылкам.' : 'Enable JavaScript to play the episode. The full film and Strava recording are available through the links.'}</p></noscript>
        </div>
      </div>
      <footer class="ride-film__notes">
        <div class="ride-film__context"><p>${ru ? 'Здесь прошёл велосипедный этап «1111». В декабре Виктор вернётся на эту трассу.' : 'This course hosted the cycling leg of “1111”. Viktor returns here in December.'}</p></div>
        <div class="ride-film__provenance">
          <div class="ride-film__description" id="ride-film-description">
            <p>${ru ? 'Кадры из фильма «1111», 2024 год.' : 'Scenes from the film “1111”, 2024.'}</p>
            <p>${ru ? 'Шкала записи Strava учитывает остановки. Время восстановлено по 203 отрезкам; положение на трассе приблизительное. Секунда просмотра соответствует примерно 20 минутам записи. Монтаж подобран по времени суток, без точной привязки кадров к GPS.' : 'The Strava recording timeline includes stops. Time is reconstructed from 203 splits; positions on the course are approximate. A second of viewing represents about 20 minutes of the recording. Scenes follow the time of day, without exact synchronization to GPS.'}</p>
          </div>
          <a class="text-link ride-film__source" href="${record.source}" target="_blank" rel="noopener noreferrer"><span class="text-link__label">${ru ? 'Запись заезда в Strava' : 'Ride recording on Strava'}</span>${externalIcon}</a>
        </div>
      </footer>
    </article>`;
}
