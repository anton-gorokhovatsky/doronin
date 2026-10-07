import { chromium, webkit } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';
import { checkFilmReadings, checkFilmAppearance } from './lib/ride-film-checks.mjs';
import { checkDiaryWidget } from './lib/diary-widget-checks.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.cwd();
const revision=process.argv[2];
const server=revision ? null : await startSiteServer(`${root}/site`);
const base=server?.origin || 'https://11111.life';
const out=`${root}/tmp/four-review/${revision || 'local'}`;
await mkdir(out,{recursive:true});
const now=Date.parse('2026-09-12T17:30:00Z');
const weather={properties:{meta:{updated_at:new Date(now-3600000).toISOString()},timeseries:[{time:new Date(now-1800000).toISOString(),data:{instant:{details:{cloud_area_fraction:3,wind_speed:5.9,wind_from_direction:0,air_temperature:36,ultraviolet_index_clear_sky:2}}}}]}};
const dust={version:1,source:'NASA GEOS-FP',issuedAt:'2026-09-12T06:00:00Z',grid:{latitude:25.25,longitude:55.3125},intervalMinutes:180,points:[{time:'2026-09-12T16:30:00Z',dustUgM3:300,opticalDepth:.4}]};
const report=[];
try {
  for(const [name,engine] of Object.entries({chromium,webkit})) {
    const browser=await engine.launch();
    try {
      for(const [lang,width,text] of [['ru',1440,false],['ru',390,false],['en',320,true]]) {
        console.log(`[journey] ${name} ${lang} ${width}${text ? ' / 200% text' : ''}`);
        const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.clock.setFixedTime(new Date(now));
        await page.route('https://api.met.no/**',r=>r.fulfill({json:weather}));
        await page.route('**/dubai-dust.json',r=>r.fulfill({json:dust}));
        await page.route('https://mc.yandex.ru/**',r=>r.abort());
        await page.route('**/*.mp4',r=>r.abort());
        await page.goto(`${base}/${lang==='en'?'en/':''}?release=${revision||'four-review'}`);
        await page.evaluate(()=>document.fonts.ready);
        if(text) await page.evaluate(()=>{document.documentElement.style.fontSize='200%';window.dispatchEvent(new Event('resize'));});
        await page.locator('.menu-toggle').click();
        if(text) {
          const menuFit=await page.evaluate(()=>{
            const preview=document.querySelector('.site-nav__preview').getBoundingClientRect();
            const title=document.querySelector('.site-nav__preview-title');
            const range=document.createRange();range.selectNodeContents(title);
            const logo=document.querySelector('.site-logo img').getBoundingClientRect();
            const header=document.querySelector('.site-header').getBoundingClientRect();
            return {
              titleFits:[...range.getClientRects()].every(rect=>rect.left>=preview.left && rect.right<=preview.right+1 && rect.bottom<=preview.bottom+1),
              logoFits:logo.top>=header.top && logo.bottom<=header.bottom+1,
            };
          });
          assert(menuFit.titleFits,'Enlarged menu preview title is not clipped');
          assert(menuFit.logoFits,'Menu logo fits its header when text is enlarged');
        }
        await page.locator('[data-menu-weather-readings]').waitFor({state:'visible'});
        const value=page.locator('.site-nav__journey [data-menu-status-value]');
        assert.match(await value.textContent(),lang==='ru'?/80\s+дней/:/80\s+days/);
        assert((await value.evaluate(el=>getComputedStyle(el).fontFamily)).includes('Commissioner'));
        await page.locator('.site-nav__utility').scrollIntoViewIfNeeded();
        await page.locator('.site-nav__utility').screenshot({path:`${out}/${name}-${lang}-${width}-menu.png`});
        await page.locator('.menu-toggle').click();
        await page.locator('button[data-dubai-mode="current"]').click();
        if(text) await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
        await page.waitForFunction(()=>document.querySelector('[data-dubai-dust-value]').textContent.includes('300'));
        await page.locator('.dubai-light').screenshot({path:`${out}/${name}-${lang}-${width}-light.png`});
        if(text) {
          const labels=await page.locator('.hero-peaks strong').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
          for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++) {
            const a=labels[i],b=labels[j];
            assert(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top,'Peak labels overlap');
          }
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        assert.deepEqual(errors,[]);
        await page.locator('#distance .section-heading').scrollIntoViewIfNeeded();
        await page.locator('[data-ride-film]').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('[data-ride-film]').evaluate(el=>el.tagName),'ARTICLE');
        assert(await page.locator('[data-film-map]').isVisible());
        await page.waitForFunction(()=>!document.querySelector('[data-film-range]').disabled);
        await checkFilmReadings(page);
        await checkFilmAppearance(page);
        const range=page.locator('[data-film-range]');
        await range.scrollIntoViewIfNeeded();
        await range.focus();await range.press('End');
        await page.waitForFunction(()=>Number(document.querySelector('[data-film-range]').value)===138980);
        assert.match(await page.locator('[data-film-distance-value]').textContent(),/^1001[,.]0$/);
        assert.match(await page.locator('#ride-film-description').textContent(),/203/);
        await range.press('Home');
        assert.match(await page.locator('[data-film-distance-value]').textContent(),/^0/);
        await page.locator('[data-ride-film]').screenshot({path:`${out}/${name}-${lang}-${width}-replay.png`});
        await checkDiaryWidget(page);
        report.push({engine:name,lang,width,text,errors});
        await page.close();
      }
      for (const javaScriptEnabled of [false,true]) {
        const page=await browser.newPage({viewport:{width:390,height:844},javaScriptEnabled,reducedMotion:'reduce'});
        await page.route('https://api.met.no/**',r=>r.abort());
        await page.route('https://mc.yandex.ru/**',r=>r.abort());
        await page.route('**/*.mp4',r=>r.abort());
        await page.route('**/ride-2024.json?*',r=>r.abort());
        await page.goto(`${base}/?release=${revision||'four-review'}#ride-2024`,{waitUntil:'domcontentloaded'});
        await page.evaluate(()=>document.fonts.ready);
        const panel=page.locator('[data-ride-film]');
        await panel.scrollIntoViewIfNeeded();
        assert(await panel.locator('h3').isVisible());
        assert((await page.locator('[data-film-route]').getAttribute('points')).length>100);
        assert(await page.locator('.ride-film__source').isVisible());
        if(javaScriptEnabled)await page.locator('[data-film-status]').filter({hasText:/Strava/}).waitFor({state:'visible'});
        assert.equal(await page.locator('[data-film-play]').isEnabled(),false);
        assert(await page.locator('[data-film-video]').evaluate(el=>el.paused));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        report.push({engine:name,replayFallback:javaScriptEnabled?'network-failure':'no-js'});
        await page.close();
      }
    }finally{await browser.close();}
  }
}finally{await server?.close();}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(report);
