import {load} from 'cheerio/slim';
import {SPORTS,slug,safeSourceUrl,deduplicate} from '../public/shared.mjs';

export function scoreboardUrl(sport,date) {
  const [y,m,d]=date.split('-');
  return `https://www.maxpreps.com/ms/${sport.path}/scores/?date=${Number(m)}/${Number(d)}/${y}`;
}
function fromUrlDate(url) {
  const match=url.match(/\/(\d{1,2})-(\d{1,2})-(\d{4})\//);
  return match?`${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`:null;
}
function timeDetails(text) {
  const m=text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])(?:m)?$/i);
  if(!m) return {startMinutes:null,startLabel:null};
  const h=Number(m[1]),minutes=Number(m[2]??0);
  if(h<1||h>12||minutes>59)return {startMinutes:null,startLabel:null};
  return {startMinutes:(h%12+(m[3].toLowerCase()==='p'?12:0))*60+minutes,startLabel:`${h}:${String(minutes).padStart(2,'0')} ${m[3].toUpperCase()}M`};
}
export function parseMaxPreps(html,sport,date,observedAt=new Date().toISOString()) {
  const $=load(html);
  const cards=$('[data-contest-id]');
  // A login, block page or redesigned response must not be mistaken for zero games.
  if(!cards.length&&!$('.contest-count').length&&!/no (?:games|matches|contests)/i.test($('body').text())) throw Error('Scoreboard format unavailable');
  const games=[];
  let skippedDate=0,excludedState=0,invalid=0;
  cards.each((_,el)=>{
    const card=$(el),box=card.find('.contest-box-item').first();
    const href=safeSourceUrl(card.find('a.c-c').first().attr('href'));
    if(!href){invalid++;return;}
    // Some empty-day pages redirect to the next game day. Use each game's date,
    // never the requested date, so Thursday games cannot appear under Tuesday.
    const gameDate=fromUrlDate(href);
    if(gameDate!==date){skippedDate++;return;}
    const path=new URL(href).pathname;
    if(!path.startsWith('/ms/')&&!(path.startsWith('/inter-state/')&&/-ms(?:-|\/)/.test(path))){excludedState++;return;}
    const teams=card.find('ul.teams > li').toArray().map(e=>{
      const row=$(e),nameNode=row.find('.name').clone();nameNode.find('.rank').remove();
      const name=nameNode.text().replace(/\s+/g,' ').trim();
      const raw=row.find('.score').text().trim();
      return {name,slug:slug(name),score:/^\d+$/.test(raw)?Number(raw):null};
    });
    if(teams.length!==2||teams.some(t=>!t.name)){invalid++;return;}
    const detail=card.find('.details').first().text().replace(/\s+/g,' ').trim();
    const state=box.attr('data-contest-state')??'';
    let status='unknown';
    if(/cancel/i.test(detail))status='cancelled';
    else if(/postpon|suspend|ppd/i.test(detail))status='postponed';
    else if(/^final\b/i.test(detail))status='final';
    else if(box.attr('data-contest-live')==='1'||/^(?:inprogress|live|in-progress|contest-in-progress)$/.test(state)||/^in progress$/i.test(detail))status='live';
    else if(state==='pregame')status='scheduled';
    else if(state==='boxscore'&&teams.every(t=>t.score!==null))status='final';
    const timing=timeDetails(detail);
    if(status==='scheduled')teams.forEach(t=>t.score=null);
    const contestId=card.attr('data-contest-id');
    games.push({id:`maxpreps-${contestId}`,contestId,date:gameDate,sport:sport.label,sportKey:sport.key,
      status,detail,...timing,teams,url:href,source:'MaxPreps',observedAt,scoreUpdatedAt:null});
  });
  if(cards.length&&invalid===cards.length)throw Error('All scoreboard cards failed validation');
  return {games:deduplicate(games),skippedDate,excludedState,invalid,listed:cards.length};
}
export class FeedCollector {
  constructor({fetchImpl=(...args)=>globalThis.fetch(...args),now=()=>Date.now(),cache=new Map(),spacingMs=400}={}) {
    this.fetchImpl=fetchImpl;this.now=now;this.cache=cache;this.pending=new Map();this.nextRequestAt=0;this.spacingMs=spacingMs;
  }
  async read(key,url,parser,ttl=180_000) {
    const old=this.cache.get(key),at=this.now();
    if(old&&at<old.nextCheck)return old;
    if(this.pending.has(key))return this.pending.get(key);
    const job=(async()=>{
      const wait=Math.max(0,this.nextRequestAt-this.now());this.nextRequestAt=Math.max(this.now(),this.nextRequestAt)+this.spacingMs;
      if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
      try {
        const response=await this.fetchImpl(url,{headers:{'User-Agent':'MississippiScoreboard/1.0 (public scoreboard reader)','Accept':'text/html'},signal:AbortSignal.timeout(15000)});
        if(!response.ok){await response.body?.cancel();throw Error(`Source returned HTTP ${response.status}`);}
        const observedAt=new Date(this.now()).toISOString();
        const reader=response.body.getReader();let text='',size=0;const decoder=new TextDecoder();
        try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2500000){await reader.cancel();throw Error('Source response exceeds size limit');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
        const data=parser(text,observedAt);
        const hasLive=data.games?.some(g=>g.status==='live');
        const entry={data,url,checkedAt:observedAt,stale:false,error:null,nextCheck:this.now()+(hasLive?Math.min(ttl,60_000):ttl)};
        this.cache.set(key,entry);return entry;
      } catch(error) {
        // Preserve completed results during outages; expire live observations independently.
        const games=(old?.data?.games??[]).filter(g=>{
          const age=this.now()-Date.parse(g.observedAt??old.checkedAt);
          return Number.isFinite(age)&&age>=-60000&&age<=(g.status==='live'?3600000:g.status==='scheduled'?86400000:7*86400000);
        });
        const entry={data:{...old?.data,games},url,checkedAt:old?.checkedAt??null,stale:true,
          error:String(error.message).slice(0,160),nextCheck:this.now()+(/HTTP 404/.test(error.message)?12*60*60*1000:Math.max(ttl,60_000))};
        this.cache.set(key,entry);return entry;
      } finally {this.pending.delete(key);}
    })();
    this.pending.set(key,job);
    // Bound cached date/source combinations, retaining current entries and in-flight work.
    if(this.cache.size>700){for(const [k,v] of this.cache){if(this.now()-Date.parse(v.checkedAt??0)>86400000&&!this.pending.has(k))this.cache.delete(k);}}
    return job;
  }
  async get(date,sports=SPORTS,ttl=180_000) {
    const specs=sports.map(s=>({key:`${s.key}:${date}`,label:s.label,url:scoreboardUrl(s,date),ttl,
      parse:(html,at)=>parseMaxPreps(html,s,date,at)}));
    const entries=await Promise.all(specs.map(s=>this.read(s.key,s.url,s.parse,s.ttl)));
    const sources=entries.map((entry,i)=>({name:specs[i].label,url:entry.url,checkedAt:entry.checkedAt,nextCheck:entry.nextCheck,
      state:entry.error?(entry.checkedAt?'stale':'unavailable'):'ok',error:entry.error}));
    const all=entries.flatMap((entry,i)=>{
      let games=entry.data.games??[];
      return games.map(g=>({...g,stale:entry.stale}));
    });
    return {date,timezone:'America/Chicago',fetchedAt:new Date(this.now()).toISOString(),
      games:deduplicate(all),sources,coverage:'Available varsity game scoreboards. Meet-based results and unreported games may be absent.',
      refreshSeconds:60};
  }
}
