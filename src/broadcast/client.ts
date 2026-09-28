import {centralDate,shiftDate,type BroadcastData,type Game} from './model';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const text=(id:string,value:string)=>{el(id).textContent=value;};
const channel=el('channel');
function fit(){const scale=Math.min(innerWidth/1920,innerHeight/1080);channel.style.transform=`scale(${scale})`;channel.style.left=`${(innerWidth-1920*scale)/2}px`;channel.style.top=`${(innerHeight-1080*scale)/2}px`;}
addEventListener('resize',fit);fit();
let data:BroadcastData|null=null,offline=true,storyIndex=0,boardIndex=0,railIndex=0,tickerIndex=0,slide=0,slideStart=performance.now();
let scoreAnimation:Animation|undefined,newsAnimation:Animation|undefined;
const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date.slice(0,10)+'T12:00:00Z'));
function safeUrl(value:string){try{const u=new URL(value,location.origin);return u.protocol==='https:'||u.origin===location.origin?u.href:null;}catch{return null;}}
function image(id:string,url:string|null){const img=el<HTMLImageElement>(id);if(!url||!safeUrl(url)){img.removeAttribute('src');img.style.visibility='hidden';return;}if(img.getAttribute('src')!==url){img.style.visibility='hidden';img.onload=()=>{img.style.visibility='visible';};img.onerror=()=>{img.style.visibility='hidden';};img.src=url;}}
function available(kind:'final'|'scheduled'|'result'):Game[]{const today=centralDate();const games=(data?.games||[]).filter(g=>!g.conflict&&g.status===kind&&g.date>=shiftDate(today,-7)&&(kind!=='scheduled'||g.date>=today)).sort((a,b)=>kind!=='scheduled'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  // Give each level regular airtime even when high-school records greatly outnumber college games.
  const groups=['High school','JUCO','College'].map(level=>games.filter(g=>g.level===level));const mixed:Game[]=[];for(let i=0;i<Math.max(...groups.map(g=>g.length),0);i++)for(const group of groups)if(group[i])mixed.push(group[i]);return mixed;}
function card(game:Game){const div=document.createElement('div');div.className='game';
  const meta=document.createElement('div');meta.className='game-meta';meta.textContent=`${game.level} · ${game.sport} · ${dateLabel(game.date)}`;div.append(meta);
  game.teams.forEach((name,i)=>{const row=document.createElement('div');row.className='team';const n=document.createElement('span');n.textContent=name;const s=document.createElement('b');s.textContent=game.status==='final'&&game.scores?String(game.scores[i]):'';row.append(n,s);div.append(row);});
  const foot=document.createElement('div');foot.className='game-foot';const stale=game.stale||Date.now()-Date.parse(game.observedAt)>3*3600000;
  foot.textContent=`${game.status==='final'?'FINAL':game.status==='result'?game.result||'Reported result':game.time} · ${game.source}${stale?' · LAST KNOWN':''}`;div.append(foot);return div;
}
function cards(target:string,games:Game[],message:string){const root=el(target);root.replaceChildren(...games.map(card));if(!games.length){const p=document.createElement('p');p.className='empty';p.textContent=message;root.append(p);}}
function page<T>(list:T[],index:number,size:number){if(!list.length)return [];return list.slice((index%Math.ceil(list.length/size))*size,(index%Math.ceil(list.length/size))*size+size);}
function showSlide(){
  const showBoard=slide%3===2;el('story').hidden=showBoard;el('scoreboard').hidden=!showBoard;
  if(showBoard){const kind=(['final','scheduled','result'] as const)[boardIndex%3];const games=available(kind);text('board-title',kind==='final'?'Confirmed finals':kind==='result'?'Around the meets':'Coming up');text('board-subtitle',kind==='final'?'Final results as reported by the listed source':kind==='result'?'Published meet results and result notices • Source wording retained':'Published schedules • Times and matchups may change');cards('board-games',page(games,Math.floor(boardIndex/3),6),kind==='final'?'No confirmed finals in the current feed. Check source coverage.':'No events reported in this category. Check source coverage.');text('board-page',`${games.length} reported events · Coverage status: /broadcast/status`);boardIndex++;}
  else if(data?.stories.length){const s=data.stories[storyIndex%data.stories.length];image('story-image',s.image);text('headline',s.title);text('story-date',dateLabel(s.publishedAt));text('story-position',`${storyIndex%data.stories.length+1} / ${data.stories.length}`);storyIndex++;}
  slideStart=performance.now();slide++;
}
function updateRail(){const kind=railIndex%2===0?'scheduled':'final',games=available(kind);text('rail-title',kind==='scheduled'?'UP NEXT':'LATEST FINALS');text('rail-page',`${games.length} REPORTED`);cards('rail-games',page(games,Math.floor(railIndex/2),2),'No games reported yet. Coverage may be incomplete.');railIndex++;}
function crawl(id:string,animation:Animation|undefined,speed:number,iterations=Infinity){animation?.cancel();const node=el(id),width=node.scrollWidth,start=node.parentElement!.clientWidth;return node.animate([{transform:`translateX(${start}px)`},{transform:`translateX(-${width}px)`}],{duration:(width+start)/speed*1000,iterations});}
function updateTickers(){
  const kind=(['final','scheduled','result'] as const)[tickerIndex%3];const games=available(kind);const root=el('score-ticker');root.replaceChildren();text('ticker-label',kind==='final'?'FINALS':kind==='result'?'RESULTS':'UP NEXT');
  for(const g of page(games,Math.floor(tickerIndex/3),6)){const span=document.createElement('span');span.className='ticker-item';const meta=document.createElement('small');meta.textContent=`${g.sport.toUpperCase()} · ${dateLabel(g.date)} · ${g.source}${g.stale||Date.now()-Date.parse(g.observedAt)>3*3600000?' · LAST KNOWN':''}`;span.append(meta,document.createTextNode(g.status==='final'&&g.scores?`${g.teams[0]} ${g.scores[0]} — ${g.teams[1]} ${g.scores[1]} · FINAL`:`${g.teams.join(g.event?' · ':' vs ')} · ${g.status==='result'?g.result:g.time}`));root.append(span);}
  if(!root.childNodes.length)root.textContent='Awaiting source-reported games • Missing coverage is listed at /broadcast/status';
  scoreAnimation=crawl('score-ticker',scoreAnimation,95,1);void scoreAnimation.finished.then(updateTickers).catch(()=>{});tickerIndex++;
  const news=(data?.stories||[]).map(s=>s.title).join('     •     ')||'Sports Mississippi • Your state. Your teams.';if(el('news-ticker').textContent!==news||!newsAnimation){text('news-ticker',news);newsAnimation=crawl('news-ticker',newsAnimation,80);}
}
function status(){
  const states=data?.sources||[],healthy=states.filter(s=>s.state==='healthy').length;
  const age=data?Math.round((Date.now()-Date.parse(data.generatedAt))/60000):0;
  text('data-status',!data?'CONNECTING · NO VERIFIED DATA YET':`${offline?'OFFLINE · LAST SAVED DATA':age>3?'UPDATE DELAYED':states.some(s=>s.state==='error')?'SOME FEEDS UNAVAILABLE':'AUTO UPDATING'} · ${healthy}/${states.length} SOURCES CURRENT · COVERAGE GAPS ${data.gaps.length}${data.conflicts.length?' · SCORES HELD FOR CONFLICT':''}`);
}
let received=false;
async function refresh(){try{const r=await fetch('/api/broadcast',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Unavailable');const value=await r.json();if(!Array.isArray(value.games)||!Array.isArray(value.sources)||!Array.isArray(value.stories))throw new Error('Invalid snapshot');data=value;offline=false;try{localStorage.setItem('ms-broadcast-last-good',JSON.stringify(value));}catch{}if(!received){showSlide();updateRail();updateTickers();received=true;}}catch{offline=true;}finally{status();}}
try{const cached=JSON.parse(localStorage.getItem('ms-broadcast-last-good')||'null');if(cached&&Array.isArray(cached.games)&&Date.now()-Date.parse(cached.generatedAt)<86400000){data=cached;showSlide();updateRail();updateTickers();}}catch{}
void refresh();setInterval(()=>void refresh(),60000);setInterval(showSlide,14000);setInterval(updateRail,18000);
setInterval(()=>{const now=new Date();text('clock',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(now));text('today',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'}).format(now).toUpperCase()+' · CT');el('progress-bar').style.transform=`scaleX(${Math.min(1,(performance.now()-slideStart)/14000)})`;status();},250);
interface Sponsor {name:string;image:string;fullscreenImage?:string;placements:('sidebar'|'fullscreen')[];active:boolean;startsAt?:string;endsAt?:string;}
interface SponsorConfig {sidebarSeconds:number;fullscreenEverySeconds:number;fullscreenSeconds:number;sponsors:Sponsor[];}
let config:SponsorConfig={sidebarSeconds:20,fullscreenEverySeconds:300,fullscreenSeconds:15,sponsors:[]},adIndex=0,fullIndex=0,lastSidebar=0,lastFull=Date.now(),fullUntil=0;
function activeAds(placement:'sidebar'|'fullscreen'){return config.sponsors.filter(s=>s.active&&s.placements?.includes(placement)&&safeUrl(s.image)&&(!s.startsAt||Date.parse(s.startsAt)<=Date.now())&&(!s.endsAt||Date.parse(s.endsAt)>Date.now()));}
async function sponsors(){try{const r=await fetch('/broadcast-sponsors.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)return;const c=await r.json();if(Array.isArray(c.sponsors))config={sponsors:c.sponsors,sidebarSeconds:Math.max(5,Number(c.sidebarSeconds)||20),fullscreenEverySeconds:Math.max(60,Number(c.fullscreenEverySeconds)||300),fullscreenSeconds:Math.min(60,Math.max(5,Number(c.fullscreenSeconds)||15))};}catch{}}
void sponsors();setInterval(()=>void sponsors(),60000);
setInterval(()=>{const now=Date.now();if(now-lastSidebar>config.sidebarSeconds*1000){const list=activeAds('sidebar'),s=list[adIndex++%list.length];el('sponsor-image').hidden=!s;el('sponsor-house').hidden=!!s;text('sponsor-name',s?.name||'');if(s)image('sponsor-image',s.image);lastSidebar=now;}
  if(now-lastFull>config.fullscreenEverySeconds*1000){const list=activeAds('fullscreen'),s=list[fullIndex++%list.length];if(s){image('full-image',s.fullscreenImage||s.image);text('full-name',s.name);fullUntil=now+config.fullscreenSeconds*1000;}lastFull=now;}el('sponsor-full').hidden=now>=fullUntil;
},1000);
