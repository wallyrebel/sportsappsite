import {centralDate,shiftDate,type Source,type Snapshot,type Game} from './model';
import {parseWordpress,parseMaxpreps,maxprepsDates,parseMais,parseMaccc,parseSidearm,parseCalendar,monitorMais,parseMileSplit} from './parsers';
import {parseFootballRankings,parseVolleyballRankings,volleyballBundle} from './rankings';

export async function boundedText(response:Response,limit=2_500_000):Promise<string>{
  if(!response.ok){await response.body?.cancel();throw new Error(`Source HTTP ${response.status}`);}
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('Source response exceeds size limit');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Source returned no body');
  const decoder=new TextDecoder();let length=0,result='';
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error('Source response exceeds size limit');}result+=decoder.decode(value,{stream:true});}return result+decoder.decode();}finally{reader.releaseLock();}
}
export async function collect(source:Source,previous?:Snapshot,now=new Date(),request:typeof fetch=fetch):Promise<Snapshot>{
  const stamp=now.toISOString(),today=centralDate(now);let requests=0;
  const get=async(url:string)=>{requests++;return boundedText(await request(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html,application/json','User-Agent':'MississippiSportsBroadcast/1.0 (+https://mississippisportsapp.com/broadcast/status)'}}));};
  let games:Game[]=[],stories=previous?.stories||[];
  let rankings=previous?.rankings||[];
  if(source.kind==='rankings-football')rankings=[parseFootballRankings(await get(source.url),source,stamp)];
  if(source.kind==='rankings-volleyball'){const html=await get(source.url);rankings=[parseVolleyballRankings(html,await get(volleyballBundle(html,source)),source,stamp)];}
  if(source.kind==='wordpress')stories=parseWordpress(await get(source.url));
  if(source.kind==='mais')games=parseMais(await get(source.url),source,stamp);
  if(source.kind==='sidearm')games=parseSidearm(await get(source.url),source,stamp);
  if(source.kind==='mais-monitor')monitorMais(await get(source.url));
  if(source.kind==='milesplit'){
    for(const month of new Set([shiftDate(today,-7),today,shiftDate(today,14)].map(d=>d.slice(0,7)))){
      const [year,m]=month.split('-'),url=new URL(source.url);url.searchParams.set('year',year);url.searchParams.set('month',String(Number(m)));
      games.push(...parseMileSplit(await get(url.href),source,stamp));
    }
  }
  if(source.kind==='calendar'){
    const dates=[shiftDate(today,-7),today,shiftDate(today,14)];
    for(const month of new Set(dates.map(d=>d.slice(0,7)))){
      const [year,m]=month.split('-');const url=new URL('/services/responsive-calendar.ashx',source.url);
      url.search=new URLSearchParams({type:'month',sport:'0',location:'all',date:`${Number(m)}/15/${year}`,year}).toString();
      games.push(...parseCalendar(await get(url.href),source,stamp));
    }
  }
  if(source.kind==='maxpreps'){
    const dateUrl=(d:string)=>{const [y,m,day]=d.split('-');return source.url+'?date='+encodeURIComponent(`${Number(m)}/${Number(day)}/${y}`);};
    const raw=await get(dateUrl(today));games=parseMaxpreps(raw,source,stamp);
    const dates=maxprepsDates(raw,source).filter(d=>d>=shiftDate(today,-7)&&d<=shiftDate(today,14));
    const selected=[...dates.filter(d=>d<today).sort().reverse().slice(0,2),...dates.filter(d=>d>today).sort().slice(0,2)];
    for(const d of selected)games.push(...parseMaxpreps(await get(dateUrl(d)),source,stamp));
    const scanned=new Set([today,...selected]);
    games.push(...(previous?.games||[]).filter(g=>!scanned.has(g.date)));
  }
  if(source.kind==='maccc'){
    // Twice-daily collection covers recent finals and the coming week on each pass.
    const offsets=Array.from({length:11},(_,i)=>i-3);
    const scanned=new Set(offsets.map(n=>shiftDate(today,n)));
    for(const date of scanned)games.push(...parseMaccc(await get(source.url+'?d='+date),source,stamp,date));
    games.push(...(previous?.games||[]).filter(g=>!scanned.has(g.date)));
  }
  games=[...new Map(games.filter(g=>g.date>=shiftDate(today,-7)&&g.date<=shiftDate(today,14)).map(g=>[g.id,g])).values()];
  return {sourceId:source.id,games,stories,rankings,lastSuccess:stamp,lastAttempt:stamp,error:null,failures:0,requests};
}
