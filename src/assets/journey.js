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
  const month = calendar.querySelector('[data-calendar-month]');
  const monthLabel = style => new Intl.DateTimeFormat(lang, { month: style, timeZone: 'UTC' }).format(date).replace(/\.$/, '');
  calendar.querySelector('[data-calendar-day]').textContent = String(date.getUTCDate());
  calendar.querySelector('[data-calendar-title]').textContent = latest.title;
  const link = calendar.querySelector('[data-calendar-link]');
  link.href = latest.href;
  link.setAttribute('aria-label', `${lang === 'ru' ? 'Читать последнюю запись' : 'Read the latest entry'} · ${latest.dateLabel} · ${latest.title}`);
  const toggle = calendar.querySelector('[data-calendar-toggle]');
  // Native focus-visible can persist when a pointer clicks the already-focused control.
  calendar.addEventListener('pointerdown', () => calendar.setAttribute('data-pointer-focus', ''), { capture: true });
  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' '].includes(event.key)) calendar.removeAttribute('data-pointer-focus');
  }, { capture: true });
  const copy = calendar.querySelector('.return-calendar__copy');
  let collapsed = true;
  const sync = () => {
    calendar.classList.toggle('is-collapsed', collapsed);
    copy.hidden = collapsed;
    month.textContent = monthLabel(collapsed ? 'short' : 'long');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = lang === 'ru' ? (collapsed ? 'Развернуть название записи' : 'Свернуть название записи') : (collapsed ? 'Show entry title' : 'Hide entry title');
    toggle.setAttribute('aria-label', label);
  };
  const day = calendar.querySelector('[data-calendar-day]');
  const compact = calendar.querySelector('.return-calendar__compact');
  const chevron = toggle.querySelector('.icon');
  let running = [];
  let ghost;
  const finish = () => {
    running.forEach(animation => { animation.onfinish = null; animation.cancel(); });
    running = [];
    ghost?.remove();
    ghost = null;
    calendar.classList.remove('is-morphing');
    link.style.removeProperty('width');
  };
  toggle.addEventListener('click', () => {
    const reduce = document.documentElement.classList.contains('motion-reduced') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof calendar.animate !== 'function') {
      finish();
      collapsed = !collapsed;
      sync();
      return;
    }
    // Keep the date and control nodes; capture an interrupted transition before cancelling it.
    const from = calendar.getBoundingClientRect();
    const oldLink = getComputedStyle(link);
    const fromLink = { padding: oldLink.padding, gap: oldLink.gap };
    const fromFont = getComputedStyle(day).fontSize;
    const fromChevron = getComputedStyle(chevron).transform;
    const outgoing = collapsed ? compact : copy;
    const outgoingBox = outgoing.getBoundingClientRect();
    const outgoingDisplay = getComputedStyle(outgoing).display;
    const outgoingClone = outgoing.cloneNode(true);
    finish();
    collapsed = !collapsed;
    sync();
    const to = calendar.getBoundingClientRect();
    const nextLink = getComputedStyle(link);
    const toLink = { padding: nextLink.padding, gap: nextLink.gap };
    const border = parseFloat(getComputedStyle(calendar).borderLeftWidth) || 0;
    // Freeze text measure while the glass changes size, so words do not jump between lines.
    link.style.width = `${to.width - border * 2}px`;
    calendar.classList.add('is-morphing');
    ghost = outgoingClone;
    ghost.removeAttribute('id');
    ghost.removeAttribute('hidden');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add('return-calendar__ghost');
    Object.assign(ghost.style, {
      position: 'absolute', pointerEvents: 'none',
      left: `${outgoingBox.left - from.left - border}px`,
      top: `${outgoingBox.top - from.top - border}px`,
      width: `${outgoingBox.width}px`,
    });
    ghost.style.setProperty('display', outgoingDisplay, 'important');
    calendar.append(ghost);
    const timing = { duration: 340, easing: getComputedStyle(calendar).getPropertyValue('--ease-enter').trim() || 'ease-out' };
    const shape = calendar.animate([
      { width: `${from.width}px`, height: `${from.height}px` },
      { width: `${to.width}px`, height: `${to.height}px` },
    ], timing);
    running = [
      shape,
      link.animate([fromLink, toLink], timing),
      month.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: 50, fill: 'backwards' }),
      day.animate([{ fontSize: fromFont }, { fontSize: getComputedStyle(day).fontSize }], timing),
      chevron.animate([{ transform: fromChevron }, { transform: getComputedStyle(chevron).transform }], timing),
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' }),
      (collapsed ? compact : copy).animate([
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 0, transform: 'translateY(4px)', offset: 0.2 },
        { opacity: 1, transform: 'translateY(0)' },
      ], timing),
    ];
    shape.onfinish = finish;
  });
  window.addEventListener('resize', finish, { passive: true });
  sync();
  document.body.append(calendar);
  // Keep the diary available as the next chapter enters the viewport, even
  // while the bottom of the hero and its action are still visible above it.
  const firstChapter = document.querySelector('#manifesto-title');
  const footer = document.querySelector('.site-footer');
  const boundaryGap = 16;
  const main = document.querySelector('main');
  // Cache the text nodes, not their coordinates: scrolling, disclosure and
  // enlarged text must be checked against the actual current line fragments.
  let readingNodes = null;
  let pageControls = [];
  let engaged = false;
  const intersects = (a, b) => a.width > 0 && a.height > 0 &&
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const rendered = element => {
    // WebKit may retain nonzero rects for content inside a closed details.
    if (typeof element.checkVisibility === 'function') return element.checkVisibility({ checkVisibilityCSS: true });
    if (getComputedStyle(element).visibility !== 'visible') return false;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
        const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
        if (!summary?.contains(element)) return false;
      }
    }
    return true;
  };
  const contentObscured = card => {
    if (!main) return false;
    if (!readingNodes) {
      readingNodes = new Map();
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!node.textContent.trim() || parent.closest('script, style, noscript, .sr-only')) continue;
        if (!readingNodes.has(parent)) readingNodes.set(parent, []);
        readingNodes.get(parent).push(node);
      }
      pageControls = [...main.querySelectorAll('a, button, input, select, textarea, summary, [role="button"], [role="slider"]')];
    }
    for (const control of pageControls) {
      if (intersects(control.getBoundingClientRect(), card) &&
          rendered(control)) return true;
    }
    const range = document.createRange();
    for (const [parent, nodes] of readingNodes) {
      if (!intersects(parent.getBoundingClientRect(), card) ||
          !rendered(parent)) continue;
      for (const node of nodes) {
        range.selectNodeContents(node);
        if ([...range.getClientRects()].some(rect => intersects(rect, card))) return true;
      }
    }
    return false;
  };
  let readingStarted = false;
  let footerVisible = false;
  const syncVisibility = () => {
    const chapterTop = firstChapter?.getBoundingClientRect().top ?? -Infinity;
    readingStarted = chapterTop <= window.innerHeight - (readingStarted ? 0 : boundaryGap);
    // The footer already contains the diary action. Clear the floating card
    // as soon as the footer enters the viewport, and keep its disclosure state.
    const footerTop = footer?.getBoundingClientRect().top ?? Infinity;
    footerVisible = footerTop < window.innerHeight + (footerVisible ? boundaryGap : 0);
    const hidden = !readingStarted || footerVisible || Boolean(document.fullscreenElement);
    if (hidden && !calendar.hidden) finish();
    calendar.hidden = hidden;
    // Leave any keyboard-focused control readable and operable beneath the
    // floating card. Keep its geometry so scrolling can restore it immediately.
    const focused = document.activeElement;
    const control = focused?.matches('a, button, input, select, textarea, summary, [role="button"], [role="slider"]');
    let obscured = false;
    if (!hidden && control && !calendar.contains(focused)) {
      const card = calendar.getBoundingClientRect();
      const target = focused.getBoundingClientRect();
      obscured = card.left < target.right && card.right > target.left &&
        card.top < target.bottom && card.bottom > target.top;
    }
    calendar.toggleAttribute('data-focus-obscured', obscured);
    // Preserve the card's corner, dimensions and disclosure. Only yield when
    // its actual footprint covers reading or an action, not a whole section.
    calendar.toggleAttribute('data-content-obscured', !hidden && !engaged &&
      contentObscured(calendar.getBoundingClientRect()));
  };
  let visibilityFrame = 0;
  const scheduleVisibility = () => {
    if (visibilityFrame) return;
    visibilityFrame = requestAnimationFrame(() => {
      visibilityFrame = 0;
      syncVisibility();
    });
  };
  document.addEventListener('focusin', () => {
    engaged = calendar.contains(document.activeElement);
    scheduleVisibility();
  });
  document.addEventListener('focusout', () => {
    if (!calendar.contains(document.activeElement)) engaged = false;
    scheduleVisibility();
  });
  // A card appearing under a stationary pointer is not an interaction.
  calendar.addEventListener('pointerdown', () => { engaged = true; });
  calendar.addEventListener('pointerleave', event => {
    // Touch has no hover; lifting a finger must not dismiss the title just opened.
    if (event.pointerType === 'touch') return;
    if (calendar.hasAttribute('data-pointer-focus') || !calendar.contains(document.activeElement)) engaged = false;
    scheduleVisibility();
  });
  calendar.addEventListener('click', scheduleVisibility);
  document.addEventListener('pointerdown', event => {
    if (!calendar.contains(event.target)) {
      engaged = false;
      scheduleVisibility();
    }
  }, { passive: true });
  document.addEventListener('fullscreenchange', scheduleVisibility);
  window.addEventListener('scroll', () => {
    engaged = false;
    scheduleVisibility();
  }, { passive: true });
  window.addEventListener('resize', scheduleVisibility, { passive: true });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleVisibility);
    if (main) observer.observe(main);
    observer.observe(calendar);
  }
  if (main) new MutationObserver(() => {
    readingNodes = null;
    scheduleVisibility();
  }).observe(main, { childList: true, subtree: true });
  document.fonts?.ready.then(scheduleVisibility);
  syncVisibility();
  return calendar;
}
if (typeof document !== 'undefined') initUpdates();
