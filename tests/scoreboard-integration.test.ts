import test from 'node:test';
import assert from 'node:assert/strict';
import {withHighSchoolScores} from '../src/broadcast/scoreboard';
import type {BroadcastData,Game,Health} from '../src/broadcast/model';
const now=new Date('2026-10-06T23:00:00Z'),stamp=now.toISOString();
const college:Game={id:'college',sourceId:'college',source:'Official',sourceUrl:'https://example.com',observedAt:stamp,level:'College',sport:'Volleyball',date:'2026-10-06',time:'6 PM',teams:['A','B'],scores:null,status:'scheduled'};
const source:Health={id:'college',kind:'calendar',name:'Official',url:'https://example.com',intervalMinutes:60,note:'',state:'healthy',lastSuccess:stamp,lastAttempt:stamp,runtimeSuccess:stamp,error:null,failures:0,count:1};
test('broadcast includes current high-school scores with correct orientation and preserves other programming',()=>{
  const data:BroadcastData={generatedAt:stamp,games:[college],stories:[{id:1,title:'News',url:'https://example.com',image:null,publishedAt:stamp}],sources:[source],gaps:[],conflicts:[]};
  const snapshot={schemaVersion:1,generatedAt:stamp,lastAttempt:stamp,days:[{date:'2026-10-06',sources:[{name:'Volleyball',url:'https://www.maxpreps.com/ms/volleyball/scores/',checkedAt:stamp,state:'ok'}],games:[{id:'hs',source:'MaxPreps',url:'https://www.maxpreps.com/ms/',observedAt:stamp,date:'2026-10-06',sport:'Volleyball',sportKey:'volleyball',status:'live',teams:[{name:'Kossuth',score:0},{name:'Corinth',score:2}]}]}]};
  const result=withHighSchoolScores(data,snapshot,now);
  assert.equal(result.games.length,2);assert.equal(result.stories[0].title,'News');
  const game=result.games.find(g=>g.id==='hs')!;assert.equal(game.status,'in-progress');assert.deepEqual(game.scores,[0,2]);assert.equal(game.stale,false);
  assert.equal(withHighSchoolScores(data,snapshot,now,true).games.find(g=>g.id==='hs')!.stale,true);
});
