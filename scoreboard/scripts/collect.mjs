import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {FeedCollector} from '../lib/providers.mjs';
import {SPORTS,centralDate} from '../public/shared.mjs';
import {shiftDate} from '../lib/snapshot.mjs';

const target=path.resolve(process.argv[2]??'.scoreboard-data/scoreboard.json'),today=centralDate();
let previous={days:[]};try{previous=JSON.parse(await readFile(target,'utf8'));}catch{}
const cache=new Map(),now=Date.now();
for(const row of previous.days??[])for(const s of row.sources??[]){
  const sport=SPORTS.find(t=>t.label===s.name);if(!sport)continue;
  const age=now-Date.parse(s.checkedAt),ttl=row.date===today?180000:6*3600000;
  cache.set(`${sport.key}:${row.date}`,{data:{games:(row.games??[]).filter(g=>g.sportKey===sport.key)},url:s.url,
    checkedAt:s.checkedAt,stale:s.state!=='ok',error:s.error,nextCheck:s.state==='ok'?Date.parse(s.checkedAt)+ttl:s.nextCheck??0});
}
const collector=new FeedCollector({cache,spacingMs:500}),rows=[];
// Current scores every run; future schedules are cached for six hours.
// Yesterday is rechecked for late finals. Older final results remain available for seven days.
for(let offset=0;offset<=7;offset++)rows.push(await collector.get(shiftDate(today,offset),offset===0?SPORTS:SPORTS.slice(0,9),offset===0?180000:6*3600000));
rows.push(await collector.get(shiftDate(today,-1),SPORTS.slice(0,9),30*60000));
rows.push(...(previous.days??[]).filter(r=>r.date>=shiftDate(today,-7)&&r.date<shiftDate(today,-1)));
const current=rows.find(r=>r.date===today),good=current.sources.filter(s=>s.state==='ok').length;
const snapshot={schemaVersion:1,generatedAt:new Date().toISOString(),lastAttempt:new Date().toISOString(),days:rows};
await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify(snapshot));
console.log(JSON.stringify({date:today,games:current.games.length,availableSources:good,totalSources:current.sources.length,days:rows.length}));
if(!good){console.error('No current source checks succeeded. Snapshot retains delayed data and reports failures.');process.exitCode=2;}
