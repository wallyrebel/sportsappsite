import {centralDate,validDate,deduplicate} from '../public/shared.mjs';
export const SNAPSHOT_URL='https://raw.githubusercontent.com/wallyrebel/sportsappsite/scoreboard-data/scoreboard.json';
export function shiftDate(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function selectSnapshot(snapshot,{date=centralDate(),days=1,now=Date.now(),offline=false}={}){
  if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.days))throw Error('Invalid scoreboard snapshot');
  const today=centralDate(now),end=shiftDate(date,days-1),rows=snapshot.days.filter(d=>d.date>=date&&d.date<=end);
  const sources=rows.flatMap(row=>(row.sources??[]).map(s=>{
    const age=now-Date.parse(s.checkedAt),limit=row.date===today?15*60000:12*3600000;
    return {...s,date:row.date,state:!s.checkedAt?'unavailable':offline||s.state!=='ok'||age>limit?'stale':'ok'};
  }));
  const games=rows.flatMap(row=>(row.games??[]).filter(g=>g.date===row.date&&g.source==='MaxPreps'&&Array.isArray(g.teams)&&g.teams.length===2).flatMap(g=>{
    const age=now-Date.parse(g.observedAt),source=sources.find(s=>s.date===g.date&&s.name===g.sport);
    // Stop airing a live score after one hour without a successful source check.
    if(!Number.isFinite(age)||age< -60000||age>(g.status==='live'?3600000:g.status==='scheduled'?86400000:7*86400000))return [];
    // A missed result from yesterday must never be presented as upcoming.
    if(g.status==='scheduled'&&g.date<today)return [];
    return [{...g,stale:g.stale||!source||source.state!=='ok'}];
  }));
  if(!sources.length)sources.push({name:'MaxPreps',url:'https://www.maxpreps.com/ms/',checkedAt:null,state:'unavailable',error:'This date has not been collected yet.'});
  return {date,endDate:end,timezone:'America/Chicago',fetchedAt:snapshot.generatedAt,lastAttempt:snapshot.lastAttempt,
    games:deduplicate(games),sources,refreshSeconds:60,collectionTargetSeconds:300,
    coverage:'Available Mississippi varsity game listings. Reporting and sport coverage vary; schedules cover today and the next seven days.'};
}
let last=null,pending=null,lastFetch=0;
export async function fetchSnapshot(request=(...args)=>globalThis.fetch(...args)){
  if(last&&Date.now()-lastFetch<60000)return {snapshot:last,offline:false};
  if(pending)return pending;
  pending=(async()=>{try{
    const response=await request(SNAPSHOT_URL,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
    if(!response.ok)throw Error(`Snapshot HTTP ${response.status}`);
    const text=await response.text();if(text.length>5000000)throw Error('Snapshot too large');
    const value=JSON.parse(text);if(value.schemaVersion!==1||!Array.isArray(value.days))throw Error('Invalid snapshot');
    last=value;lastFetch=Date.now();return {snapshot:last,offline:false};
  }catch(error){if(last&&Date.now()-lastFetch<86400000)return {snapshot:last,offline:true};throw error;}
  finally{pending=null;}})();return pending;
}
export async function scoresResponse(request){
  const url=new URL(request.url),date=url.searchParams.get('date')??centralDate(),days=url.searchParams.get('days')==='8'?8:1;
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  if(!validDate(date)||date<shiftDate(centralDate(),-7)||date>shiftDate(centralDate(),7))return Response.json({error:'Choose a date within seven days of today.'},{status:400});
  try{const {snapshot,offline}=await fetchSnapshot();return Response.json(selectSnapshot(snapshot,{date,days,offline}),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});}
  catch{return Response.json({error:'Score collection has not completed successfully. The display will retry automatically.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}
}
