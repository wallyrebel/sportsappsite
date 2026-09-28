import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {SOURCES,GAPS} from '../src/broadcast/sources';
import {collect} from '../src/broadcast/collect';
import {mergeData,type Snapshot} from '../src/broadcast/model';
// Optional local verification. Never runs at website build time or commits scraped data.
const snapshots:Snapshot[]=[];
for(const source of SOURCES){
  if(process.argv[2]&&!source.id.includes(process.argv[2]))continue;
  try{const snapshot=await collect(source);snapshots.push(snapshot);console.log(JSON.stringify({id:source.id,finals:snapshot.games.filter(g=>g.status==='final').length,upcoming:snapshot.games.filter(g=>g.status==='scheduled').length,results:snapshot.games.filter(g=>g.status==='result').length,stories:snapshot.stories.length}));}
  catch(error){const message=error instanceof Error?error.message:String(error);console.log(JSON.stringify({id:source.id,error:message}));snapshots.push({sourceId:source.id,games:[],stories:[],lastSuccess:null,lastAttempt:new Date().toISOString(),error:message,failures:1,requests:0});}
}
let previous:Snapshot[]=[];try{previous=JSON.parse(await readFile('.research/verified-snapshots.json','utf8'));}catch{}
const merged=[...new Map([...previous,...snapshots].map(s=>[s.sourceId,s])).values()];
await mkdir('.research',{recursive:true});await writeFile('.research/verified-snapshots.json',JSON.stringify(merged));await writeFile('.research/broadcast.json',JSON.stringify(mergeData(SOURCES,merged,GAPS)));
