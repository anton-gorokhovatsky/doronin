import { chromium, webkit } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';
import { checkReplayReadingStability } from './lib/replay-motion-check.mjs';
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
        await page.locator('[data-menu-weather-readings]').waitFor({state:'visible'});
        const value=page.locator('.site-nav__journey [data-menu-status-value]');
        assert.match(await value.textContent(),lang==='ru'?/80\s+дней/:/80\s+days/);
        assert((await value.evaluate(el=>getComputedStyle(el).fontFamily)).includes('Commissioner'));
        await page.locator('.site-nav__utility').scrollIntoViewIfNeeded();
        await page.locator('.site-nav__utility').screenshot({path:`${out}/${name}-${lang}-${width}-menu.png`});
        await page.locator('.menu-toggle').click();
        await page.locator('[data-dubai-mode="current"]').click();
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
        await page.locator('[data-ride-replay]').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('[data-ride-replay]').evaluate(el=>el.tagName),'ARTICLE');
        assert(await page.locator('[data-replay-diagram]').isVisible());
        await page.locator('[data-replay-controls]').waitFor({state:'visible'});
        await checkReplayReadingStability(page);
        const range=page.locator('[data-replay-time]');
        await range.scrollIntoViewIfNeeded();
        await range.focus();await range.press('End');
        await page.waitForFunction(()=>Number(document.querySelector('[data-replay-time]').value)===1000);
        assert.match(await page.locator('[data-replay-distance]').textContent(),/^1001\s+(?:км|km)$/);
        assert.match(await page.locator('[data-replay-status]').textContent(),/203/);
        await range.press('Home');
        assert.match(await page.locator('[data-replay-distance]').textContent(),/^0/);
        const play=page.locator('[data-replay-play]');
        await play.focus();await play.press('Space');
        await page.waitForFunction(()=>Number(document.querySelector('[data-replay-time]').value)>0);
        await play.press('Space');
        assert.equal(await play.getAttribute('data-playing'),'false');
        const paused=await range.inputValue();
        await page.waitForTimeout(250);
        assert.equal(await range.inputValue(),paused);
        await page.locator('[data-ride-replay]').screenshot({path:`${out}/${name}-${lang}-${width}-replay.png`});
        // Returning users see new material until it has actually been opened.
        await page.evaluate(()=>{const items=JSON.parse(document.querySelector('#project-updates-data').textContent);localStorage.setItem('11111-seen-updates-v1',JSON.stringify({version:1,ids:items.slice(0,-1).map(x=>x.id)}));});
        await page.goto(`${base}/${lang==='en'?'en/':''}?release=${revision||'four-review'}&return=1#top`);
        await page.locator('[data-return-update]').waitFor({state:'visible'});
        await page.locator('[data-return-links] a').click();
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem('11111-seen-updates-v1')).ids.includes(JSON.parse(document.querySelector('#project-updates-data').textContent).filter(x=>x.kind==='diary').at(-1).id));
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        assert(await page.locator('[data-return-update]').isHidden());
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
        const panel=page.locator('[data-ride-replay]');
        await panel.scrollIntoViewIfNeeded();
        assert(await panel.locator('h3').isVisible());
        assert((await page.locator('[data-replay-route]').getAttribute('points')).length>100);
        assert(await page.locator('.ride-replay__source').isVisible());
        if(javaScriptEnabled)await page.locator('[data-replay-error]').waitFor({state:'visible'});
        assert(await page.locator('[data-replay-controls]').isHidden());
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        report.push({engine:name,replayFallback:javaScriptEnabled?'network-failure':'no-js'});
        await page.close();
      }
    }finally{await browser.close();}
  }
}finally{await server?.close();}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(report);
