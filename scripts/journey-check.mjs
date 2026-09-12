import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProjectStatus, currentProjectStatus } from '../src/project-status-validation.mjs';
import { unseenUpdates } from '../src/assets/journey.js';
import { replayPoint, validReplay } from '../src/assets/ride-replay.js';
import { readDust } from '../src/assets/dubai-light.js';
import { readDustMetadata, readDustAscii } from './lib/dust-data.mjs';

const now = Date.parse('2026-12-03T10:00:00Z');
const entry = (updatedAt, distanceKm) => ({ version:1, verified:true, updatedAt, distanceKm, discipline:{ru:'Велосипед',en:'Cycling'}, note:{ru:'',en:''}, source:{label:{ru:'Отметка команды',en:'Team update'},url:'https://example.com/confirmed'} });
const log = { version:2, entries:[entry('2026-12-01T18:00:00+04:00',333), entry('2026-12-02T18:00:00+04:00',666)] };
assert.deepEqual(validateProjectStatus(log, now), []);
assert.equal(currentProjectStatus(log).distanceKm,666);
assert.equal(currentProjectStatus({version:2,entries:[]}).verified,false);
for (const bad of [
  { ...log, entries:[...log.entries,entry('2026-12-01T19:00:00+04:00',700)] },
  { ...log, entries:[...log.entries,entry('2026-12-03T08:00:00Z',400)] },
  { ...log, entries:[entry('2026-11-30T08:00:00Z',333)] },
  { ...log, entries:[entry('2026-12-04T08:00:00Z',333)] },
  { ...log, entries:[{...log.entries[0],source:null}] },
  { ...log, entries:[{...log.entries[0],verified:false,source:null}] },
  { ...log, entries:[entry('2026-12-01T18:00:00',333)] },
]) assert(validateProjectStatus(bad,now).length);
const feed=[{id:'old'},{id:'new'}];
assert.deepEqual(unseenUpdates(feed,null),[]);
assert.deepEqual(unseenUpdates(feed,{version:1,ids:['old']}),[{id:'new'}]);
assert.deepEqual(unseenUpdates(feed,{version:1,ids:['old','new']}),[]);

const replay={version:1,mode:'time',source:'https://www.strava.com/activities/13190277378',start:'2024-12-01T02:00:00Z',end:'2024-12-01T03:00:00Z',distanceKm:30,points:[[0,0,20,20],[1800,15,100,200],[3600,30,30,30]]};
assert(validReplay(replay));
assert.equal(replayPoint(replay,1799).index,0,'No invented position between recorded points');
assert.equal(replayPoint(replay,1800).point[1],15);
assert.equal(replayPoint(replay,3600).point[1],30);
assert(!validReplay({...replay,points:[replay.points[1],replay.points[0]]}));
const actual=JSON.parse(await readFile('src/assets/ride-2024.json','utf8'));
const laps=JSON.parse(await readFile('src/ride-2024-laps.json','utf8'));
assert(validReplay(actual));
assert.equal(laps.laps.length,203);
assert.equal(laps.laps.reduce((sum, lap) => sum+lap[1],0),138828);
assert(Math.abs(laps.laps.reduce((sum,lap)=>sum+lap[0],0)-1000.98)<0.001);
assert.equal(actual.timing.elapsedSeconds,138980);
assert.equal(actual.distanceKm,1001);
assert.equal(actual.sourcePoints,98012);
assert.equal(actual.start,'2024-12-24T09:58:00+04:00');
assert.equal(actual.end,'2024-12-26T00:34:20+04:00');
assert(!validReplay({...actual,distanceKm:null}));
assert(!validReplay({...actual,timing:{...actual.timing,elapsedSeconds:97989}}));

const meta=readDustMetadata('time { String grads_size "2"; String grads_min "22:30z11sep2026"; String grads_step "180mn"; }');
assert.equal(new Date(meta.start).toISOString(),'2026-09-11T22:30:00.000Z');
const ascii='dusmass, [2][1][1]\n[0][0], 2E-7\n[1][0], 3E-7\n\ntime, [2]\n1, 1.125\nlat, [1]\n25.25\nlon, [1]\n55.3125\nduexttau, [2][1][1]\n[0][0], 0.2\n[1][0], 0.3\n\ntime, [2]\n1, 1.125\n';
const points=readDustAscii(ascii,meta);
assert.equal(points[0].dustUgM3,200);
assert.equal(points[1].time,'2026-09-12T01:30:00.000Z');
assert.throws(()=>readDustAscii(ascii.replace('2E-7','1.0E15'),meta));
const dust={version:1,source:'NASA GEOS-FP',issuedAt:'2026-09-12T00:00:00Z',grid:{latitude:25.25,longitude:55.3125},intervalMinutes:180,points};
assert.equal(readDust(dust,Date.parse('2026-09-12T02:00:00Z')).dustUgM3,300);
assert.equal(readDust(dust,Date.parse('2026-09-12T04:31:00Z')),null);
assert.equal(readDust({...dust,points:[{...points[0],opticalDepth:null}]},Date.parse('2026-09-12T02:00:00Z')),null);
console.log('History, return visits, GPX / Strava replay and dust data checks passed.');
