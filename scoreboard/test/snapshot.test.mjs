import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSnapshot,scoresResponse,shiftDate} from '../lib/snapshot.mjs';
import {centralDate} from '../public/shared.mjs';
const now=Date.parse('2026-10-06T23:00:00Z');
const game=(date='2026-10-06',status='live',minutes=0)=>({id:date,source:'MaxPreps',date,status,sport:'Volleyball',sportKey:'volleyball',observedAt:new Date(now-minutes*60000).toISOString(),teams:[{name:'Kossuth',score:0},{name:'Corinth',score:2}]});
const snapshot=g=>({schemaVersion:1,generatedAt:new Date(now).toISOString(),days:[{date:g.date,games:[g],sources:[{name:'Volleyball',checkedAt:g.observedAt,state:'ok'}]}]});
test('delay marks live data and expiry removes it even when API remains reachable',()=>{
  assert.equal(selectSnapshot(snapshot(game(undefined,undefined,16)),{date:'2026-10-06',now}).games[0].stale,true);
  assert.equal(selectSnapshot(snapshot(game(undefined,undefined,61)),{date:'2026-10-06',now}).games.length,0);
});
test('yesterday schedule cannot appear upcoming; multi-day response includes tomorrow',()=>{
  assert.equal(selectSnapshot(snapshot(game('2026-10-05','scheduled')),{date:'2026-10-05',now}).games.length,0);
  assert.equal(selectSnapshot(snapshot(game('2026-10-07','scheduled')),{date:'2026-10-06',days:8,now}).games.length,1);
});
test('uncollected date reports unavailable rather than a successful empty feed',()=>{
  assert.equal(selectSnapshot({schemaVersion:1,days:[]},{date:'2026-10-06',now}).sources[0].state,'unavailable');
});

test('rolling window keeps last night finals ahead of upcoming games and excludes old unresolved games',()=>{
  const priorFinal=game('2026-10-05','final'),priorLive={...game('2026-10-05','live'),id:'old-live'};
  const priorUnknown={...game('2026-10-05','unknown'),id:'old-unknown'},current=game(),upcoming=game('2026-10-07','scheduled');
  const data={schemaVersion:1,days:[{...snapshot(priorFinal).days[0],games:[priorFinal,priorLive,priorUnknown]},...snapshot(current).days,...snapshot(upcoming).days]};
  const selected=selectSnapshot(data,{date:'2026-10-06',days:8,past:1,now});
  assert.deepEqual(selected.games.map(g=>g.status),['live','final','scheduled']);
  assert.deepEqual(selected.games[1].teams.map(t=>t.score),[0,2]);
  assert.equal(selected.startDate,'2026-10-05');assert.equal(selected.endDate,'2026-10-13');
  assert.equal(selectSnapshot(data,{date:'2026-10-06',days:8,past:0,now}).games.some(g=>g.date==='2026-10-05'),false);
});

test('existing API URLs automatically include yesterday finals; strict date mode can opt out',async t=>{
  const today=centralDate(),yesterday=shiftDate(today,-1),stamp=new Date().toISOString();
  const completed={...game(yesterday,'final'),observedAt:stamp};
  const data={schemaVersion:1,generatedAt:stamp,days:[{date:yesterday,games:[completed],sources:[{name:'Volleyball',state:'ok',checkedAt:stamp}]}]};
  t.mock.method(globalThis,'fetch',async()=>Response.json(data));
  const result=await (await scoresResponse(new Request(`https://example.com/api/scores?date=${today}&days=8`))).json();
  assert.equal(result.games.length,1);assert.equal(result.games[0].date,yesterday);assert.equal(result.pastDays,1);
  const strict=await (await scoresResponse(new Request(`https://example.com/api/scores?date=${today}&past=0`))).json();
  assert.equal(strict.games.length,0);
  assert.equal((await scoresResponse(new Request('https://example.com/api/scores?past=99'))).status,400);
});
