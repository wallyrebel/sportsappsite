import {collect,boundedText} from '../../src/broadcast/collect';
import {mergeData,type Snapshot} from '../../src/broadcast/model';
import {SOURCES,GAPS} from '../../src/broadcast/sources';

async function snapshots(env:Env):Promise<Snapshot[]>{const rows=await env.BROADCAST_DB.prepare('SELECT payload FROM source_snapshots').all<{payload:string}>();return rows.results.map(r=>JSON.parse(r.payload));}
async function save(env:Env,s:Snapshot){await env.BROADCAST_DB.prepare('INSERT INTO source_snapshots (id,payload,last_attempt,last_success,failures) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,last_attempt=excluded.last_attempt,last_success=excluded.last_success,failures=excluded.failures').bind(s.sourceId,JSON.stringify(s),s.lastAttempt,s.lastSuccess,s.failures).run();}
async function refresh(env:Env,now:Date){
  await env.BROADCAST_DB.prepare('INSERT INTO collector_runs (id,last_started) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET last_started=excluded.last_started').bind(now.toISOString()).run();
  const previous=await snapshots(env),byId=new Map(previous.map(s=>[s.sourceId,s]));
  const due=SOURCES.filter(s=>!byId.get(s.id)||now.getTime()-Date.parse(byId.get(s.id)!.lastAttempt)>=s.intervalMinutes*60000)
    .sort((a,b)=>(byId.get(a.id)?.lastAttempt||'').localeCompare(byId.get(b.id)?.lastAttempt||''));
  // Bound work and source traffic. Each source retains its last good snapshot on any failed page.
  const news=due.find(s=>s.kind==='wordpress');const batch=[...(news?[news]:[]),...due.filter(s=>s!==news).slice(0,6)];
  let failed=0;
  for(const source of batch){
    const old=byId.get(source.id);let next:Snapshot;
    try{next=await collect(source,old,now);}catch(error){next={sourceId:source.id,games:old?.games||[],stories:old?.stories||[],lastSuccess:old?.lastSuccess||null,lastAttempt:now.toISOString(),failures:(old?.failures||0)+1,error:error instanceof Error?error.message:'Collection failed',requests:0};}
    await save(env,next);byId.set(source.id,next);if(next.error)failed++;
    console.log(JSON.stringify({source:source.id,ok:!next.error,items:next.games.length+next.stories.length,error:next.error}));
  }
  const data=mergeData(SOURCES,[...byId.values()],GAPS,now);
  await env.BROADCAST_DB.prepare('UPDATE collector_runs SET last_finished=?,processed=?,failed=? WHERE id=1').bind(new Date().toISOString(),batch.length,failed).run();
  const issues=[...data.sources.filter(s=>s.failures>=3).map(s=>`${s.name}: ${s.error}`),...data.conflicts.map(g=>`Score conflict: ${g.date} ${g.teams.join(' / ')}`)];
  // Optional email uses a separately provisioned secret; the dashboard works without it.
  const key='RESEND_API_KEY' in env?String(env.RESEND_API_KEY):'';
  if(issues.length&&env.ALERT_EMAIL&&key){
    const latest=await env.BROADCAST_DB.prepare('SELECT sent_at FROM broadcast_alerts WHERE id=?').bind('digest').first<{sent_at:string}>();
    if(!latest||now.getTime()-Date.parse(latest.sent_at)>6*3600000){
      const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.ALERT_FROM,to:[env.ALERT_EMAIL],subject:'Mississippi Sports broadcast needs attention',text:issues.slice(0,30).join('\n')+'\n\nhttps://mississippisportsapp.com/broadcast/status'})});
      await boundedText(response,100000);
      await env.BROADCAST_DB.prepare('INSERT INTO broadcast_alerts(id,sent_at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET sent_at=excluded.sent_at').bind('digest',now.toISOString()).run();
    }
  }
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path!=='/api/broadcast')return new Response('Not found',{status:404});
    if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
    try{const data=mergeData(SOURCES,await snapshots(env),GAPS);const run=await env.BROADCAST_DB.prepare('SELECT last_started AS lastStarted,last_finished AS lastFinished,processed,failed FROM collector_runs WHERE id=1').first<NonNullable<typeof data.collector>>();if(run)data.collector=run;return Response.json(data,{headers:{'Cache-Control':'public, max-age=30','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});}
    catch(error){console.error(JSON.stringify({event:'broadcast-read-failed',message:error instanceof Error?error.message:'unknown'}));return Response.json({error:'Broadcast data temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  },
  async scheduled(controller,env){await refresh(env,new Date(controller.scheduledTime));}
} satisfies ExportedHandler<Env>;
