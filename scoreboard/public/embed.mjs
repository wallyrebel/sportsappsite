import {GROUPS,centralDate,filterGames,validDate} from './shared.mjs';
const here=new URL('.',import.meta.url);
const query=new URLSearchParams(location.search);
const settings={group:query.get('group')??'statewide',teams:(query.get('teams')??'').split(',').map(s=>s.trim()).filter(Boolean),
  sport:query.get('sport')??'all',status:query.get('status')??'all'};
const vmix=query.get('mode')==='vmix';
document.body.classList.toggle('vmix',vmix);
document.body.classList.toggle('light',query.get('theme')==='light');
const title=query.get('title')?.slice(0,70)??(settings.group==='custom'?'YOUR TEAMS':GROUPS[settings.group]?.label??'Mississippi');
document.querySelector('#group-label').textContent=title;
document.title=`${title} · Score Wire`;
const viewport=document.querySelector('#viewport'),track=document.querySelector('#track'),statusEl=document.querySelector('#feed-status');
const pauseButton=document.querySelector('#pause'),motion=matchMedia('(prefers-reduced-motion: reduce)');
const speed=Math.min(110,Math.max(15,Number(query.get('speed'))||45));
let animation=null,manualPause=false,hover=false,focus=false,signature='',lastData=null,lastSuccess=0,activeDate=null,busy=false;
function date(){return validDate(query.get('date'))?query.get('date'):centralDate();}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function scoreCard(game){
  const card=el('a','game-card');card.href=game.url;card.target='_blank';card.rel='noopener noreferrer';
  const meta=el('div','game-meta');meta.append(el('span','sport-label',game.sport+(query.get('days')==='8'?' · '+game.date.slice(5):'')));
  const label=game.stale?'DELAYED':game.status==='live'?`LIVE${game.teams.every(t=>t.score===null)?' · SCORE PENDING':game.detail&&!/^(LIVE|in progress)$/i.test(game.detail)?' · '+game.detail:''}`:
    game.status==='final'?'FINAL':game.status==='scheduled'?(game.startLabel??'TIME TBA'):game.status.toUpperCase();
  meta.append(el('span',`game-status ${game.stale?'delayed':game.status}`,label));card.append(meta);
  for(const team of game.teams){const row=el('div','team-row');row.append(el('span','team-name',team.name),el('strong','team-score',team.score===null?'—':String(team.score)));card.append(row);}
  card.setAttribute('aria-label',`${game.sport}: ${game.teams.map(t=>`${t.name} ${t.score??''}`).join(' versus ')}, ${label}`);
  card.title=`${game.source} · ${game.date}${game.scoreUpdatedAt?' · Score observed '+new Date(game.scoreUpdatedAt).toLocaleString():''}`;
  return card;
}
function pauseState(){if(animation){(manualPause||hover||focus||motion.matches)?animation.pause():animation.play();}pauseButton.textContent=manualPause?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(manualPause));}
function animate(){
  if(!track.firstElementChild?.classList.contains('wire-group'))return;
  const phase=animation?(Number(animation.currentTime??0)%Number(animation.effect.getTiming().duration))/Number(animation.effect.getTiming().duration):0;
  animation?.cancel();animation=null;
  track.querySelectorAll('.repeat-group').forEach(e=>e.remove());
  const original=track.firstElementChild;
  if(motion.matches){viewport.classList.add('no-motion');return;}
  viewport.classList.remove('no-motion');
  // Repeat enough content to span even a full-HD canvas with one available game.
  while(original.scrollWidth<viewport.clientWidth&&original.children.length<100){const cards=[...original.children];for(const c of cards){const copy=c.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;original.append(copy);}}
  const width=original.getBoundingClientRect().width;
  if(!width)return;
  const duplicate=original.cloneNode(true);duplicate.classList.add('repeat-group');duplicate.setAttribute('aria-hidden','true');duplicate.querySelectorAll('a').forEach(a=>a.tabIndex=-1);track.append(duplicate);
  animation=track.animate([{transform:'translateX(0)'},{transform:`translateX(-${width}px)`}],{duration:width/speed*1000,iterations:Infinity,easing:'linear'});
  animation.currentTime=phase*width/speed*1000;pauseState();
}
function render(data){
  const games=filterGames(data.games,settings);
  const key=JSON.stringify(games.map(g=>[g.id,g.date,g.status,g.detail,g.startLabel,g.stale,g.teams]));
  if(signature!==key||!track.firstElementChild){
    signature=key;animation?.cancel();animation=null;track.replaceChildren();
    if(!games.length){track.append(el('p','wire-empty',data.sources.every(s=>s.state==='unavailable')?'Score sources unavailable. Retrying…':`No reported games for this selection on ${data.date}.`));}
    else{const group=el('div','wire-group');games.forEach(g=>group.append(scoreCard(g)));track.append(group);animate();}
  }
  const unavailable=data.sources.filter(s=>s.state==='unavailable').length,stale=data.sources.filter(s=>s.state==='stale').length;
  const checked=data.sources.filter(s=>s.checkedAt).map(s=>Date.parse(s.checkedAt));
  const time=checked.length?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(Math.min(...checked))):null;
  statusEl.textContent=`${games.length} games${time?' · Sources checked '+time:''}${stale?' · Delayed data':''}${unavailable?' · Partial coverage':''}`;
  statusEl.title=`${unavailable} sources unavailable; ${stale} delayed. Scores depend on reporting by the sources.`;
  document.querySelector('#day-label').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(data.date+'T12:00:00Z'))+' · '+(settings.sport==='all'?'ALL SPORTS':'SCORES');
}
async function refresh(){
  if(busy)return;busy=true;
  const selectedDate=date();
  if(activeDate!==selectedDate){activeDate=selectedDate;lastData=null;signature='';animation?.cancel();track.replaceChildren(el('p','wire-empty','Loading games…'));}
  try{
    const response=await fetch(`${here.href}api/scores?date=${selectedDate}&days=${query.get('days')==='8'?'8':'1'}`,{cache:'no-store',signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!Array.isArray(data.games)||!Array.isArray(data.sources))throw Error('Unavailable');
    lastData=data;lastSuccess=Date.now();render(data);
  }catch{
    if(lastData&&Date.now()-lastSuccess<3600000){render({...lastData,games:lastData.games.map(g=>({...g,stale:true}))});statusEl.textContent='Connection interrupted · Showing delayed data';}
    else{animation?.cancel();track.replaceChildren(el('p','wire-empty','Score feed unavailable. Retrying automatically…'));statusEl.textContent='Unable to check scores';}
  }finally{busy=false;}
}
pauseButton.addEventListener('click',()=>{manualPause=!manualPause;pauseState();});
if(!vmix){viewport.addEventListener('mouseenter',()=>{hover=true;pauseState();});viewport.addEventListener('mouseleave',()=>{hover=false;pauseState();});viewport.addEventListener('focusin',()=>{focus=true;pauseState();});viewport.addEventListener('focusout',()=>{focus=false;pauseState();});}
motion.addEventListener('change',animate);
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(animate,150);}).observe(viewport);
await refresh();setInterval(refresh,60000);
