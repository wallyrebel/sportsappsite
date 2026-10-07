import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {FeedCollector} from '../lib/providers.mjs';
import {SPORTS,centralDate} from '../public/shared.mjs';
import {shiftDate} from '../lib/snapshot.mjs';
import {collectionTtl,restoreCollectionCache} from '../lib/collection.mjs';

const target=path.resolve(process.argv[2]??'.scoreboard-data/scoreboard.json'),today=centralDate();
let previous={days:[]};try{previous=JSON.parse(await readFile(target,'utf8'));}catch{}
const cache=restoreCollectionCache(previous,today);
const collector=new FeedCollector({cache,spacingMs:500}),rows=[];
// Current scores every run; future schedules are cached for six hours.
// Yesterday is rechecked for late finals. Older final results remain available for seven days.
for(let offset=0;offset<=7;offset++){const date=shiftDate(today,offset);rows.push(await collector.get(date,offset===0?SPORTS:SPORTS.slice(0,9),collectionTtl(date,today)));}
rows.push(await collector.get(shiftDate(today,-1),SPORTS.slice(0,9),collectionTtl(shiftDate(today,-1),today)));
rows.push(...(previous.days??[]).filter(r=>r.date>=shiftDate(today,-7)&&r.date<shiftDate(today,-1)));
const current=rows.find(r=>r.date===today),good=current.sources.filter(s=>s.state==='ok').length;
const snapshot={schemaVersion:1,generatedAt:new Date().toISOString(),lastAttempt:new Date().toISOString(),days:rows};
await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify(snapshot));
const finals=rows.find(r=>r.date===shiftDate(today,-1)).games.filter(g=>g.status==='final').length;
const errors=Object.fromEntries([...new Set(current.sources.filter(s=>s.error).map(s=>s.error))].map(error=>[error,current.sources.filter(s=>s.error===error).length]));
console.log(JSON.stringify({date:today,games:current.games.length,yesterdayFinals:finals,availableSources:good,totalSources:current.sources.length,errors,days:rows.length}));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## High-school scores — ${today}\n\nCurrent source checks: **${good}/${current.sources.length} available**. Yesterday's retained finals: **${finals}**.\n\n${Object.entries(errors).map(([error,count])=>`- ${count} sources: ${error}`).join('\n')}\n\n${good?'The snapshot was collected for publication.':'Current checks failed. Retained results are published with source health; this run remains failed and the next scheduled run will check again.'}\n`);
if(!good){console.error('No current source checks succeeded. Snapshot retains delayed data and reports failures.');process.exitCode=2;}
