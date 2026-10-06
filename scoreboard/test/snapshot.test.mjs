import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSnapshot} from '../lib/snapshot.mjs';
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
