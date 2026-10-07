import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreCollectionCache} from '../lib/collection.mjs';
import {FeedCollector} from '../lib/providers.mjs';

const sport={key:'volleyball',path:'volleyball',label:'Volleyball'},today='2026-10-07';

test('restored yesterday source refreshes after 30 minutes instead of waiting six hours',async()=>{
  const at=Date.parse('2026-10-07T14:00:00Z'),checkedAt=new Date(at-31*60000).toISOString();
  const source={name:sport.label,state:'ok',checkedAt,nextCheck:at+5*3600000};
  const cache=restoreCollectionCache({days:[{date:'2026-10-06',games:[],sources:[source]},{date:'2026-10-08',games:[],sources:[source]}]},today);
  let requests=0;
  const collector=new FeedCollector({cache,now:()=>at,spacingMs:0,fetchImpl:async()=>{requests++;return new Response('<div class="contest-count">No games</div>');}});
  await collector.get('2026-10-06',[sport],30*60000);assert.equal(requests,1);
  await collector.get('2026-10-08',[sport],6*3600000);assert.equal(requests,1);
});

test('a prolonged provider outage preserves final scores while expired live scores disappear',async()=>{
  let now=Date.parse('2026-10-07T14:00:00Z');const observedAt=new Date(now-3*3600000).toISOString();
  const cache=new Map([['scores',{checkedAt:observedAt,nextCheck:0,data:{games:[{id:'final',status:'final',observedAt,teams:[{score:0},{score:3}]},{id:'live',status:'live',observedAt}]}}]]);
  const collector=new FeedCollector({cache,now:()=>now,spacingMs:0,fetchImpl:async()=>new Response('',{status:403})});
  const delayed=await collector.read('scores','https://example.com',()=>{},30*60000);
  assert.deepEqual(delayed.data.games.map(g=>g.id),['final']);assert.deepEqual(delayed.data.games[0].teams.map(t=>t.score),[0,3]);
  assert.equal(delayed.stale,true);assert.equal(delayed.error,'Source returned HTTP 403');assert.equal(delayed.checkedAt,observedAt);
  now+=7*86400000;
  assert.deepEqual((await collector.read('scores','https://example.com',()=>{},30*60000)).data.games,[]);
});
