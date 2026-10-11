const KEY = '11111-seen-updates-v1';
export function unseenUpdates(items, saved) {
  if (saved?.version !== 1 || !Array.isArray(saved.ids) || saved.ids.some(id => typeof id !== 'string')) return [];
  return items.filter(item => !saved.ids.includes(item.id));
}

function initUpdates() {
  const data = document.querySelector('#project-updates-data');
  const notice = document.querySelector('[data-return-update]');
  if (!data || !notice) return;
  const items = JSON.parse(data.textContent);
  const lang = document.documentElement.lang;
  // The latest entry is useful on every visit, including after it has been read.
  const latest = items.filter(item => item.kind === 'diary').at(-1);
  const calendar = latest ? initCalendar(notice, latest, lang) : null;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { return; }
  const save = ids => {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, ids: ids.slice(-500) })); } catch { /* Optional, on this browser only. */ }
  };
  if (!saved) { save(items.map(item => item.id)); return; }
  const pending = unseenUpdates(items, saved);
  if (!pending.length) return;
  const links = notice.querySelector('[data-return-links]');
  for (const kind of ['diary', 'distance']) {
    const updates = pending.filter(item => item.kind === kind);
    if (!updates.length || (kind === 'diary' && calendar)) continue;
    const latest = updates.at(-1);
    const link = document.createElement('a');
    link.href = latest.href;
    const label = kind === 'diary'
      ? `${lang === 'ru' ? 'В\u00a0дневнике' : 'In the diary'} · ${latest.dateLabel} · ${latest.title}`
      : lang === 'ru' ? `Подтверждено ${latest.label}` : `${latest.label} confirmed`;
    const split = label.lastIndexOf(' ');
    link.append(document.createTextNode(label.slice(0, split + 1)));
    const tail = document.createElement('span');
    tail.className = 'return-update__tail';
    const tailLabel = document.createElement('span');
    tailLabel.textContent = label.slice(split + 1);
    tail.append(tailLabel);
    tail.append(notice.querySelector('[data-return-icon]').content.cloneNode(true));
    link.append(tail);
    links.append(link);
  }
  notice.hidden = !links.children.length;
  // Opening the page does not mark unseen material read. A visible article or
  // the history does; hidden archive panels never count as read.
  if (!('IntersectionObserver' in window)) return;
  const known = new Set(saved.ids);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !entry.target.getClientRects().length) continue;
      const matching = items.filter(item => item.href === `#${entry.target.id}`);
      matching.forEach(item => known.add(item.id));
      save([...known]);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0 });
  for (const id of new Set(pending.map(item => item.href.slice(1)))) {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  }
}
function initCalendar(notice, latest, lang) {
  const calendar = notice.querySelector('[data-return-calendar]').content.firstElementChild.cloneNode(true);
  const date = new Date(`${latest.date}T12:00:00Z`);
  calendar.querySelector('[data-calendar-date]').dateTime = latest.date;
  calendar.querySelector('[data-calendar-month]').textContent =
    new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(date).replace(/\.$/, '');
  calendar.querySelector('[data-calendar-day]').textContent = String(date.getUTCDate());
  const link = calendar.querySelector('[data-calendar-link]');
  link.href = latest.href;
  link.setAttribute('aria-label', `${lang === 'ru' ? 'Читать последнюю запись' : 'Read the latest entry'} · ${latest.dateLabel} · ${latest.title}`);
  const close = calendar.querySelector('[data-calendar-close]');
  const dismissalKey = '11111-diary-widget-dismissed';
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(dismissalKey) === '1'; } catch { /* Storage is optional. */ }
  // A pointer click must not retain the keyboard ring on an already-focused control.
  calendar.addEventListener('pointerdown', () => calendar.setAttribute('data-pointer-focus', ''), { capture: true });
  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' '].includes(event.key)) calendar.removeAttribute('data-pointer-focus');
  }, { capture: true });
  document.body.append(calendar);
  const firstChapter = document.querySelector('#manifesto-title');
  const footer = document.querySelector('.site-footer');
  const main = document.querySelector('main');
  const boundaryGap = 16;
  let readingStarted = false;
  let footerVisible = false;
  const syncVisibility = () => {
    const chapterTop = firstChapter?.getBoundingClientRect().top ?? -Infinity;
    readingStarted = chapterTop <= window.innerHeight - (readingStarted ? 0 : boundaryGap);
    // The footer has its own diary action. A small boundary buffer prevents
    // oscillation when reversing the scroll at the hero or footer.
    const footerTop = footer?.getBoundingClientRect().top ?? Infinity;
    footerVisible = footerTop < window.innerHeight + (footerVisible ? boundaryGap : 0);
    const hidden = dismissed || !readingStarted || footerVisible || Boolean(document.fullscreenElement);
    calendar.hidden = hidden;
    // Only keyboard focus can temporarily clear an overlapping page control.
    // Ordinary reading, pointer focus and scrolling never hide the card.
    const focused = document.activeElement;
    const control = focused?.matches(':focus-visible') &&
      focused.matches('a, button, input, select, textarea, summary, [role="button"], [role="slider"]');
    let obscured = false;
    if (!hidden && control && !calendar.contains(focused)) {
      const card = calendar.getBoundingClientRect();
      const target = focused.getBoundingClientRect();
      obscured = card.left < target.right && card.right > target.left &&
        card.top < target.bottom && card.bottom > target.top;
    }
    calendar.toggleAttribute('data-focus-obscured', obscured);
  };
  close.addEventListener('click', event => {
    const keyboard = event.detail === 0;
    dismissed = true;
    try { sessionStorage.setItem(dismissalKey, '1'); } catch { /* Still dismiss this page. */ }
    syncVisibility();
    if (keyboard && main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  });
  let visibilityFrame = 0;
  const scheduleVisibility = () => {
    if (visibilityFrame) return;
    visibilityFrame = requestAnimationFrame(() => {
      visibilityFrame = 0;
      syncVisibility();
    });
  };
  document.addEventListener('focusin', scheduleVisibility);
  document.addEventListener('focusout', scheduleVisibility);
  document.addEventListener('fullscreenchange', scheduleVisibility);
  window.addEventListener('scroll', scheduleVisibility, { passive: true });
  window.addEventListener('resize', scheduleVisibility, { passive: true });
  if ('ResizeObserver' in window && main) new ResizeObserver(scheduleVisibility).observe(main);
  document.fonts?.ready.then(scheduleVisibility);
  syncVisibility();
  return calendar;
}
if (typeof document !== 'undefined') initUpdates();
