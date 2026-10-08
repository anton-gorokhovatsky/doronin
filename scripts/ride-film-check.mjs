import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {startSiteServer} from './lib/site-server.mjs';

const record = JSON.parse(await readFile('src/assets/ride-2024.json','utf8'));
const timing = JSON.parse(await readFile('src/ride-2024-laps.json','utf8'));
const {montage} = JSON.parse(await readFile('src/assets/ride-film/sources.json','utf8'));
assert.equal(timing.reportedElapsedSeconds,record.points.at(-1)[0]);
assert.equal(timing.reportedMovingSeconds,97989);
assert.equal(montage.clips.reduce((sum,cut)=>sum+cut.frames,0),montage.totalFrames);
assert.equal(montage.chapters.length,4);
for (let i=1;i<montage.clips.length;i++) {
  const previous=montage.clips[i-1],current=montage.clips[i];
  assert(current.sourceStartSeconds>=previous.sourceStartSeconds+previous.frames/montage.frameRate,'Original scenes do not repeat or overlap');
}
const server=await startSiteServer(process.argv[2] || 'site');
const out='artifacts/gate/automated/ride-film';
await mkdir(out,{recursive:true});
const reports=[];
const launchers={chromium,webkit};
const engines=(process.env.RIDE_FILM_ENGINES || 'chromium,webkit').split(',').map(name=>name.trim());
assert(engines.length>0 && engines.every(name=>launchers[name]),'Playback requires a known browser engine');
try {
  for (const engine of engines) {
    const launcher=launchers[engine];
    const browser=await launcher.launch();
    try {
      for (const [lang,width,enlarged] of [['ru',1440,false],['ru',390,false],['en',320,false],['en',390,true]]) {
        const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
        await page.route('https://api.met.no/**',r=>r.abort());
        await page.route('https://mc.yandex.ru/**',r=>r.abort());
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`${server.origin}/${lang==='en'?'en/':''}?film=gate${enlarged?'&text=200':''}#ride-2024`);
        await page.evaluate(()=>document.fonts.ready);
        const panel=page.locator('[data-ride-film]');
        const play=page.locator('[data-film-play]');
        const video=page.locator('[data-film-video]');
        await play.scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>!document.querySelector('[data-film-play]').disabled);
        assert.equal(await page.locator('[data-film-total]').innerText(),'38:36');
        assert.equal(await page.locator('[data-film-duration-label]').innerText(),lang==='ru'?'Полное время · ч:мин':'Total duration · hr:min');
        assert.match(await page.locator('.ride-film__moving-time').innerText(),lang==='ru'?/Всего\s+в\s+движении.*27:13/:/Total\s+moving\s+time.*27:13/);
        assert(await video.evaluate(v=>v.paused && v.muted && !v.getAttribute('src')),'No video or sound starts on arrival');
        await play.focus();await play.press('Space');
        await page.waitForFunction(()=>!document.querySelector('[data-film-video]').paused && document.querySelector('[data-film-video]').currentTime>.2);
        assert.notEqual(await page.locator('[data-film-total]').innerText(),'00:00','Elapsed counter advances with the actual film');
        assert.equal(await page.locator('[data-film-duration-label]').innerText(),lang==='ru'?'С начала заезда · ч:мин':'Elapsed time · hr:min');
        await play.press('Space');
        const paused=await video.evaluate(v=>v.currentTime);
        await page.waitForTimeout(200);
        assert.equal(await video.evaluate(v=>v.currentTime),paused,'Pause stops media and timer');
        for (let i=0;i<4;i++) {
          await page.locator('[data-film-chapter]').nth(i).click();
          const start=montage.chapters[i].startFrame/montage.frameRate;
          await page.waitForFunction(at=>{const v=document.querySelector('[data-film-video]');return v.paused && !v.seeking && Math.abs(v.currentTime-at)<.1;},start);
          assert.equal(await panel.getAttribute('data-film-phase'),String(i));
          assert.equal(await page.locator('[data-film-chapter][aria-pressed="true"]').count(),1);
        }
        await page.locator('[data-film-sound]').click();
        await page.waitForFunction(()=>!document.querySelector('[data-film-video]').paused && !document.querySelector('[data-film-video]').muted);
        assert.equal(await page.locator('audio').count(),0,'Only the current video supplies audio');
        await page.locator('[data-film-sound]').click();
        assert(await video.evaluate(v=>v.muted),'Sound can be muted without pausing');
        await page.locator('.menu-toggle').click();
        await page.waitForFunction(()=>document.querySelector('[data-film-video]').paused);
        await page.locator('.menu-toggle').click();
        const range=page.locator('[data-film-range]');
        await range.focus();await range.press('End');
        await page.waitForFunction(()=>document.querySelector('[data-film-range]').value==='138980' && !document.querySelector('[data-film-video]').seeking);
        assert.equal(await page.locator('[data-film-total]').innerText(),'38:36');
        assert.match(await page.locator('[data-film-distance-value]').innerText(),/^1001[,.]0$/);
        await play.click();
        await page.waitForFunction(()=>document.querySelector('[data-film-video]').currentTime<2 && !document.querySelector('[data-film-video]').paused);
        await play.click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await panel.screenshot({path:`${out}/${engine}-${lang}-${width}${enlarged?'-200':''}.png`});
        assert.deepEqual(errors,[]);reports.push({engine,lang,width,enlarged,playback:true,sound:true,chapters:4,pause:true,replay:true});
        await page.close();
        console.log(`${engine} ${lang} ${width}${enlarged?' 200%':''}: film playback, sound, chapters and replay passed`);
      }
      const page=await browser.newPage({viewport:{width:390,height:844}});
      await page.route('**/ride-montage.mp4?*',r=>r.abort());
      await page.route('https://api.met.no/**',r=>r.abort());
      await page.goto(`${server.origin}/#ride-2024`);
      await page.locator('[data-film-play]').click();
      await page.locator('[data-film-status]').filter({hasText:/Не удалось/}).waitFor({state:'visible'});
      assert(await page.locator('.ride-film__picture').isVisible());
      assert(await page.locator('.ride-film__source').isVisible());
      assert.equal(await page.locator('[data-film-play]').getAttribute('aria-pressed'),'false');
      await page.close();
    } finally {await browser.close();}
  }
} finally {await server.close();}
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
