export const TIMEZONE = 'America/Chicago';
export const SPORTS = [
  ['baseball','Baseball'], ['basketball','Boys Basketball'], ['basketball/girls','Girls Basketball'],
  ['football','Football'], ['flag-football/girls','Girls Flag Football'], ['soccer','Boys Soccer'],
  ['soccer/girls','Girls Soccer'], ['softball','Softball'], ['volleyball','Volleyball'],
  ['lacrosse','Boys Lacrosse'], ['lacrosse/girls','Girls Lacrosse'], ['tennis','Boys Tennis'],
  ['tennis/girls','Girls Tennis'], ['wrestling','Wrestling'], ['golf','Boys Golf'],
  ['golf/girls','Girls Golf'], ['swimming','Boys Swimming'], ['swimming/girls','Girls Swimming'],
  ['cross-country','Boys Cross Country'], ['cross-country/girls','Girls Cross Country'],
  ['track-field','Boys Track & Field'], ['track-field/girls','Girls Track & Field']
].map(([path,label]) => ({key:path.replaceAll('/','-'),path,label}));

// School-based presets include every sport returned for either participating school.
// Add more groups here without duplicating the collector or the display.
export const GROUPS = {
  statewide: {label:'Mississippi',teams:[],sponsor:{image:'./sponsors/casey-lott.png',alt:'Casey Lott, Injury Law. 662-888-8888.'}},
  desoto: {label:'DeSoto County',teams:['Center Hill','DeSoto Central','Hernando','Horn Lake','Lake Cormorant','Lewisburg','Olive Branch','Southaven','DeSoto Christian Academy','Northpoint Christian']},
  tippah: {label:'Tippah County',teams:['Ripley','Falkner','Walnut','Pine Grove','Blue Mountain']},
  alcorn: {label:'Alcorn County',teams:['Alcorn Central','Biggersville','Corinth','Kossuth'],sponsor:{image:'./sponsors/steven-eaton.jpg',alt:'Steven Eaton, Modern Woodmen Fraternal Financial. Career opportunities available. 662-287-0113.'}}
};
const ALIASES = {
  'desoto-christian':'desoto-christian-academy',
  'walnut-attendance-center-wildcats':'walnut', 'walnut-attendance-center':'walnut',
  'ripley-tigers':'ripley', 'falkner-eagles':'falkner', 'pine-grove-panthers':'pine-grove',
  'blue-mountain-cougars':'blue-mountain', 'alcorn-central-golden-bears':'alcorn-central',
  'biggersville-lions':'biggersville', 'corinth-warriors':'corinth', 'kossuth-aggies':'kossuth',
  'itawamba-agricultural':'itawamba-ahs', 'itawamba-ahs-indians':'itawamba-ahs'
};
export function slug(value) { return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
export function teamKey(value) { const key=slug(value); return ALIASES[key]??key; }
export function centralDate(value=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value??'') && Number.isFinite(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function filterGames(games,{group='statewide',teams=[],sport='all',status='all'}={}) {
  const wanted = new Set((group==='custom'?teams:(GROUPS[group]?.teams??[])).map(teamKey));
  if(group==='custom'&&!wanted.size) return [];
  return games.filter(g=>(!wanted.size||g.teams.some(t=>wanted.has(teamKey(t.slug))||wanted.has(teamKey(t.name))))
    &&(sport==='all'||g.sportKey===sport)&&(status==='all'||g.status===status));
}
export function scoreNumber(value) { return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null; }
export function safeSourceUrl(value) {
  try { const u=new URL(value);return u.protocol==='https:'&&['www.maxpreps.com','maxpreps.com'].includes(u.hostname)?u.href:null; } catch{return null;}
}
export function deduplicate(games) {
  const result=new Map();
  const priority={unknown:0,scheduled:1,live:2,final:3,postponed:4,cancelled:4};
  for(const game of games) {
    const key=game.contestId?`${game.sportKey}:${game.contestId}`:game.id;
    const old=result.get(key);
    // A source with an explicit result wins over a still-scheduled listing.
    // Prefer the newest observation when statuses tie; never combine different teams' scores.
    if(!old || (priority[game.status]??0)>(priority[old.status]??0) ||
      ((priority[game.status]??0)===(priority[old.status]??0)&&Date.parse(game.observedAt)>Date.parse(old.observedAt))) result.set(key,game);
  }
  return [...result.values()].sort((a,b)=>({live:0,scheduled:1,final:2,postponed:3,cancelled:4,unknown:5}[a.status]??5)-({live:0,scheduled:1,final:2,postponed:3,cancelled:4,unknown:5}[b.status]??5)||a.date.localeCompare(b.date)||(a.startMinutes??1440)-(b.startMinutes??1440)||a.sport.localeCompare(b.sport)||a.teams[0].name.localeCompare(b.teams[0].name));
}
