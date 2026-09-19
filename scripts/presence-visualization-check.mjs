import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {startSiteServer} from './lib/site-server.mjs';
const server=await startSiteServer(process.argv[2] || 'site');
const out='artifacts/gate/automated/presence';await mkdir(out,{recursive:true});const reports=[];
try {
 for(const[engine,launcher]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();
  try {
   for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'});
    await page.clock.setFixedTime(new Date('2026-09-19T14:25:00Z'));
    await page.route('https://api.met.no/**',r=>r.abort());await page.route('https://mc.yandex.ru/**',r=>r.abort());
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${server.origin}/#presence`);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('html').getAttribute('data-solar-theme'),'light');
    assert.equal(await page.locator('html').getAttribute('data-dubai-light'),'sunset');
    const audio=page.locator('[data-presence-audio]');
    assert(await audio.evaluate(el=>el.paused));
    const scenes=page.locator('[data-presence-scene]');
    const wave=scenes.first().locator('.audio-story__wave');
    assert.equal(await wave.evaluate(el=>getComputedStyle(el).display),'flex');
    assert.equal(await wave.evaluate(el=>getComputedStyle(el).visibility),'hidden');
    await scenes.first().click();
    await page.waitForFunction(()=>document.querySelector('[data-presence-scene]').dataset.playing==='true');
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-presence-scene] .audio-story__wave i')].some(el=>el.style.transform));
    assert(await wave.isVisible());
    const measures=[];
    for(let i=0;i<8;i++){measures.push(await wave.locator('i').evaluateAll(els=>els.map(el=>el.style.transform).join(',')));await page.waitForTimeout(120);}
    assert(new Set(measures).size>1,`${engine} ${width}: bars must react to the audio (${await audio.evaluate(el=>el.currentTime)}s; ${measures.join('; ')})`);
    await page.locator('[data-presence-player]').screenshot({path:`${out}/${engine}-${width}-sound.png`});
    await scenes.first().click();
    await page.waitForFunction(()=>document.querySelector('[data-presence-scene]').dataset.playing==='false');
    assert(await audio.evaluate(el=>el.paused));assert.equal(await wave.evaluate(el=>getComputedStyle(el).visibility),'hidden');
    await scenes.nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('[data-presence-scene]')[1].dataset.playing==='true');
    assert(await scenes.nth(1).locator('.audio-story__wave').isVisible());
    await audio.evaluate(el=>el.pause());
    await page.emulateMedia({reducedMotion:'reduce'});await scenes.nth(2).click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-presence-scene]')[2].dataset.playing==='true');
    assert(await scenes.nth(2).locator('.audio-story__wave').isVisible());
    assert((await scenes.nth(2).locator('.audio-story__wave i').evaluateAll(els=>els.map(el=>el.style.transform))).every(x=>!x));
    await audio.evaluate(el=>el.pause());
    await page.evaluate(()=>window.scrollTo(0,document.querySelector('.hero__foot').getBoundingClientRect().top+scrollY));
    await page.screenshot({path:`${out}/${engine}-${width}-twilight.png`});
    assert.deepEqual(errors,[]);reports.push({engine,width,audioResponds:true,twilight:'light',reducedMotion:'static bars'});console.log(`${engine} ${width}: audio and twilight passed`);await page.close();
   }
  }finally{await browser.close();}
 }
}finally{await server.close();}
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
