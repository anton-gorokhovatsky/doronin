// Selected current-day composition for the separate December rehearsal.
// Completed distance is the explicit Dec 5 scenario assumption, never live status.
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const icon = direction => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${direction === 'left' ? 'M13 8H3m3.5-3.5L3 8l3.5 3.5' : direction === 'down' ? 'M8 3v10m-3.5-3.5L8 13l3.5-3.5' : 'M3 8h10m-3.5-3.5L13 8l-3.5 3.5'}"/></svg>`;
export function renderCurrentDay({lang, media, story, plan, mediaRoot}) {
  const scenarioDate = new Date('2026-12-05T00:00:00Z');
  const dayMs = 86400000;
  const elapsedDays = Math.round((scenarioDate - new Date(`${plan.period.startDate}T00:00:00Z`)) / dayMs);
  const previousPlanKm = plan.segments.reduce((total, segment) => {
    const start = new Date(`${segment.startDate}T00:00:00Z`);
    const end = new Date(`${segment.endDate}T00:00:00Z`);
    if (end < scenarioDate) return total + segment.totalDistanceKm;
    if (segment.dailyDistanceKm && start < scenarioDate) return total + Math.round((scenarioDate - start) / dayMs) * segment.dailyDistanceKm;
    return total;
  }, 0);
    const en = lang === 'en';
    const text = en ? {
      date:'December 5', remembered:'From Victor’s life',
      media:'Photos and video from the stage', prev:'Previous material', next:'Next material',
      select:'Show material', open:'Open photograph', older:'Previous story',
      olderTitle:'The Stage on the Back of a KamAZ', stages:'Challenge stages', close:'Close photograph',
      failed:'This material could not be loaded', retry:'Try again', loading:'Loading…',
      today:'Today’s target', readStory:'Read the full story', hideStory:'Collapse story'
    } : {
      date:'5 декабря', remembered:'Из жизни Виктора',
      media:'Фото и видео текущего этапа', prev:'Предыдущий материал', next:'Следующий материал',
      select:'Показать материал', open:'Открыть фотографию', older:'Предыдущая история',
      olderTitle:'Сцена в кузове КамАЗа', stages:'Этапы челленджа', close:'Закрыть фотографию',
      failed:'Материал не загрузился', retry:'Повторить загрузку', loading:'Загружаем…',
      today:'Сегодняшняя цель', readStory:'Читать историю целиком', hideStory:'Свернуть историю'
    };
    const targetLabel = en ? plan.targetDistanceKm.toLocaleString('en-US') : plan.targetDistanceKm.toLocaleString('ru-RU').replaceAll('\u00a0', '\u202f');
    const progressLabel = en ? `${previousPlanKm} kilometres covered out of ${targetLabel}` : `Пройдено ${previousPlanKm} из ${targetLabel} километров`;
    const currentSegment = plan.segments.find(segment => segment.startDate <= '2026-12-05' && segment.endDate >= '2026-12-05');
    const nextSpecial = plan.segments.find(segment => segment.startDate > '2026-12-05' && segment.kind === 'special');
    if (!currentSegment || !nextSpecial) throw new Error('Current and next stage are required');
    const todayDistance = currentSegment.dailyDistanceKm || currentSegment.totalDistanceKm;
    const nextDate = new Intl.DateTimeFormat(en?'en-US':'ru-RU', {day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${nextSpecial.startDate}T00:00:00Z`)).replace(' ','\u00a0');
    const currentCopy = `<div class="lab-current" aria-label="${en?'The ride today':'Текущий заезд'}">
      <h3 class="lab-current__target">${en?`Today’s target — ${todayDistance}\u00a0km`:`Сегодняшняя цель — ${todayDistance}\u00a0км`}</h3>
      <p class="lab-current__covered">${en?`Victor has covered ${previousPlanKm}\u00a0km of ${targetLabel}\u00a0km.`:`Виктор проехал ${previousPlanKm}\u00a0км из ${targetLabel}\u00a0км.`}</p>
      <progress class="lab-distance-progress" value="${previousPlanKm}" max="${plan.targetDistanceKm}" aria-label="${progressLabel}">${Math.round(previousPlanKm / plan.targetDistanceKm * 100)}%</progress>
      <p class="lab-current__next">${en?`Next special stage: ${nextDate}, ${nextSpecial.totalDistanceKm}\u00a0km.`:`Следующий специальный этап — ${nextDate}, ${nextSpecial.totalDistanceKm}\u00a0км.`}</p>
    </div>`;
    const pastSummary = `<summary class="lab-past-summary">
      <span class="lab-past-period"><strong>${en?`First ${elapsedDays} days`:`Первые ${elapsedDays}\u00a0дня`}</strong><span>${en?'December 1–4':'1–4\u00a0декабря'}</span></span>
      <span class="lab-past-distance"><strong>${previousPlanKm}\u00a0${en?'km':'км'}</strong><span>${en?`covered out of ${targetLabel}\u00a0km`:`пройдено из ${targetLabel}\u00a0км`}</span><progress class="lab-distance-progress" value="${previousPlanKm}" max="${plan.targetDistanceKm}" aria-label="${progressLabel}">${Math.round(previousPlanKm / plan.targetDistanceKm * 100)}%</progress></span>
      <span class="lab-past-action calendar-past__command"><span class="calendar-past__action--closed">${en?'Stories from these days':'Истории этих дней'}</span><span class="calendar-past__action--open">${en?'Hide stories':'Скрыть истории'}</span><span class="calendar-past__tail"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m5 3 5 5-5 5"/></svg></span></span>
    </summary>`;
    const frames = media.items.map((item,index)=>`<figure class="lab-frame" data-lab-index="${index}" data-ratio="${item.width/item.height}" data-kind="${item.kind}">
      ${item.kind === 'video'
        ? `<video controls playsinline preload="metadata" poster="${mediaRoot+item.poster}" width="${item.width}" height="${item.height}" aria-label="${esc(item[lang])}"><source src="${mediaRoot+item.file}" type="video/mp4"></video>`
        : `<a class="lab-photo" href="${mediaRoot+item.file}" aria-label="${text.open} ${index+1}: ${esc(item[lang])}"><img src="${mediaRoot+item.file}" width="${item.width}" height="${item.height}" alt="${esc(item[lang])}" decoding="async"></a>`}
      <button class="lab-select" type="button" data-select="${index}" aria-label="${text.select} ${index+1}"><span>${String(index+1).padStart(2,'0')}</span></button>
      <div class="lab-error" hidden><p>${text.failed}</p><button type="button" data-retry>${text.retry}</button></div>
      </figure>`).join('');
    const section = `<section data-current-day class="section section--light lab-episode" id="race-day-05" data-episode="05" tabindex="-1" aria-labelledby="lab-day-title">
      <header class="lab-day"><h2 class="lab-day__date" id="lab-day-title"><time datetime="2026-12-05">${text.date}</time></h2></header>
      <div class="lab-scene"><div class="lab-media">${currentCopy}<div class="lab-canvas" role="group" aria-label="${text.media}">${frames}</div>
      <nav class="lab-controls" aria-label="${text.media}"><span class="lab-count" aria-live="polite" aria-atomic="true">1 / ${media.items.length}</span><div class="lab-arrows"><button type="button" data-lab-prev aria-label="${text.prev}">${icon('left')}</button><button type="button" data-lab-next aria-label="${text.next}">${icon('right')}</button></div></nav></div>
      <aside class="lab-story" id="life-story-05" aria-labelledby="lab-story-title"><p class="lab-story__kicker">${text.remembered}</p><h3 class="lab-story__title" id="lab-story-title">${esc(story[lang].title)}</h3><div class="lab-story__body"><p>${esc(story[lang].paragraphs[0])}</p><details class="lab-story__more" open><summary><span class="lab-story__read">${text.readStory}</span><span class="lab-story__collapse">${text.hideStory}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg></summary><div class="lab-story__continuation">${story[lang].paragraphs.slice(1).map(p=>`<p>${esc(p)}</p>`).join('')}<nav class="lab-footer" aria-label="${text.older}"><a href="#life-story-04" class="lab-previous"><span>${text.older}</span><strong>${icon('left')}${text.olderTitle}</strong></a></nav></div></details></div></aside></div>
      <dialog class="lab-viewer" aria-label="${en?'Photograph':'Фотография'}"><button type="button" data-lab-close aria-label="${text.close}">×</button><img alt=""></dialog>
      <script type="application/json" id="lab-config">${JSON.stringify({lang,text,source:media.diarySource,storySource:story.source})}</script>
    </section>`;
  return {section, pastSummary, elapsedDays, completedDistanceKm:previousPlanKm};
}
