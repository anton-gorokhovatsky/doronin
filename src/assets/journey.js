const KEY = '11111-seen-updates-v1';
export function unseenUpdates(items, saved) {
  if (saved?.version !== 1 || !Array.isArray(saved.ids) || saved.ids.some(id => typeof id !== 'string')) return [];
  return items.filter(item => !saved.ids.includes(item.id));
}

export function diaryUpdateLabel(count, lang) {
  if (lang !== 'ru') return count === 1 ? 'New diary entry' : `${count}\u00a0new diary entries`;
  if (count === 1) return 'Новая запись в\u00a0дневнике';
  const form = new Intl.PluralRules('ru').select(count);
  const phrase = form === 'one' ? 'новая запись' : form === 'few' ? 'новые записи' : 'новых записей';
  return `${count}\u00a0${phrase} в\u00a0дневнике`;
}

function initUpdates() {
  const data = document.querySelector('#project-updates-data');
  const notice = document.querySelector('[data-return-update]');
  if (!data || !notice) return;
  const items = JSON.parse(data.textContent);
  const lang = document.documentElement.lang;
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
    if (!updates.length) continue;
    const latest = updates.at(-1);
    const link = document.createElement('a');
    link.href = latest.href;
    const label = kind === 'diary'
      ? diaryUpdateLabel(updates.length, lang)
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
  notice.hidden = false;
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
if (typeof document !== 'undefined') initUpdates();
