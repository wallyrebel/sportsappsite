import {GROUPS,SPORTS,centralDate,filterGames} from './shared.mjs';
const here=new URL('.',import.meta.url);
const $=id=>document.getElementById(id);
const initial=new URLSearchParams(location.search);
let group=Object.hasOwn(GROUPS,initial.get('group'))?initial.get('group'):'statewide',data=null,fetchVersion=0,loadedDate=null;
if(initial.get('days')==='8')$('date-mode').value='week';
for(const sport of SPORTS){const option=document.createElement('option');option.value=sport.key;option.textContent=sport.label;$('sport').append(option);}
$('fixed-date').value=centralDate();$('base-url').value=here.href.replace(/\/$/,'');
$('date-badge').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',month:'short',day:'numeric'}).format(new Date());
function selectedDate(){return $('date-mode').value==='fixed'?$('fixed-date').value:centralDate();}
function config(){return {group,teams:$('teams').value.split(',').map(s=>s.trim()).filter(Boolean),sport:$('sport').value,status:$('status').value};}
function params(){const p=new URLSearchParams({group,sport:$('sport').value,status:$('status').value,theme:$('theme').value,speed:$('speed').value});if(group==='custom')p.set('teams',$('teams').value);if($('date-mode').value==='fixed')p.set('date',$('fixed-date').value);if($('date-mode').value==='week')p.set('days','8');return p;}
function base(){try{const u=new URL($('base-url').value);return /^https?:$/.test(u.protocol)?u.href.replace(/\/$/,''):here.href.replace(/\/$/,'');}catch{return here.href.replace(/\/$/,'');}}
function embedCode(){
  const p=params(),url=base()+'/embed?'+p.toString();
  $('iframe-code').value=`<iframe src="${url.replaceAll('&','&amp;')}" title="Mississippi sports scores" width="100%" height="${GROUPS[group]?.sponsor?264:144}" style="border:0;display:block;" loading="eager"></iframe>`;
  p.set('mode','vmix');$('vmix-url').value=base()+'/embed?'+p.toString();$('open-vmix').href=here.href+'embed?'+p.toString();
}
function update(){
  $('custom-label').hidden=group!=='custom';$('fixed-date-label').hidden=$('date-mode').value!=='fixed';
  document.querySelectorAll('.preset').forEach(b=>{b.classList.toggle('active',b.dataset.group===group);b.setAttribute('aria-pressed',String(b.dataset.group===group));});
  $('group-description').textContent=group==='statewide'?'All available Mississippi varsity game listings, across sports.':group==='custom'?'Choose the schools that belong in this feed.':GROUPS[group].teams.join(' · ');
  $('speed-label').textContent=$('speed').value+' px/sec';
  $('preview').height=GROUPS[group]?.sponsor?'264':'144';
  const src=here.href+'embed?'+params().toString();if($('preview').getAttribute('src')!==src)$('preview').src=src;
  $('preview-caption').textContent=(GROUPS[group]?.label??'Custom teams')+' · '+($('date-mode').value==='today'?'Today':$('date-mode').value==='week'?'Today + next 7 days':selectedDate());
  embedCode();renderGames();load();
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function renderGames(){
  if(!data||data.date!==selectedDate())return;
  const games=filterGames(data.games,config());$('games-heading').textContent=($('date-mode').value==='today'?'Today’s games':$('date-mode').value==='week'?'Today + next 7 days':selectedDate()+' games');$('game-count').textContent=games.length+' games';$('games').replaceChildren();
  if(!games.length)$('games').append(node('p','empty-state',data.sources.every(s=>s.state==='unavailable')?'Score sources are unavailable. See the source status below.':'No reported games for this selection. Try another date or group.'));
  for(const g of games){const a=node('a','listing');a.href=g.url;a.target='_blank';a.rel='noopener noreferrer';const head=node('div','listing-head');head.append(node('span','',g.sport),node('span',g.status,g.stale?'Delayed':g.status==='scheduled'?(g.startLabel??'Time TBA'):g.status.toUpperCase()));a.append(head);for(const t of g.teams){const row=node('div','listing-team');row.append(node('span','',t.name),node('strong','',t.score??'—'));a.append(row);}a.append(node('span','listing-source',g.date+' · '+g.source));$('games').append(a);}
  $('sources').replaceChildren();for(const s of data.sources){const row=node('div','source-row');const a=node('a','',s.name);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a,node('span',s.state,s.state==='ok'?'Available':s.state==='stale'?'Delayed':'Unavailable'),node('span','',s.checkedAt?new Date(s.checkedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago'}):'No data'));if(s.error)row.title=s.error;$('sources').append(row);}
  const ok=data.sources.filter(s=>s.state==='ok').length;$('source-summary').textContent=`Source coverage: ${ok} of ${data.sources.length} available · details`;
}
async function load(){
  const version=++fetchVersion,day=selectedDate();loadedDate=day;$('game-count').textContent='Checking sources…';$('games').replaceChildren(node('p','empty-state','Loading available games…'));
  try{const response=await fetch(here.href+'api/scores?date='+day+($('date-mode').value==='week'?'&days=8':''),{cache:'no-store',signal:AbortSignal.timeout(45000)});const result=await response.json();if(version!==fetchVersion)return;if(!Array.isArray(result.games))throw Error(result.error??'Unavailable');data=result;renderGames();}
  catch{if(version===fetchVersion){$('game-count').textContent='Connection unavailable';$('games').replaceChildren(node('p','empty-state','Unable to load the scoreboard. Retrying automatically.'));}}
}
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;update();}));
for(const id of ['teams','sport','status','date-mode','fixed-date','theme','speed'])$(id).addEventListener('change',update);
$('base-url').addEventListener('input',embedCode);
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($(button.dataset.copy).value);$('copy-status').textContent='Copied.';}
  catch{$(button.dataset.copy).focus();$(button.dataset.copy).select();$('copy-status').textContent='Select and copy this text.';}
}));
update();setInterval(()=>{if(loadedDate!==selectedDate())update();else load();},60000);
