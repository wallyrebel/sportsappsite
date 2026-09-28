import {load} from 'cheerio/slim';
import {unflatten} from 'devalue';
import {score,statusFrom,type Game,type Source,type Story} from './model';
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const plain=(s:string)=>clean(load(s).root().text());
function http(value:unknown,base:string):string|null {if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,base);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function base(source:Source,now:string,date:string):Omit<Game,'id'|'teams'|'scores'|'status'>{return {sourceId:source.id,source:source.name,sourceUrl:source.url,observedAt:now,level:source.level!,sport:source.sport||'All sports',date,time:'Time TBA'};}
export function parseWordpress(raw:string):Story[]{
  const data=JSON.parse(raw);if(!Array.isArray(data))throw new Error('WordPress response is not a posts list');
  return data.flatMap(p=>{const url=http(p.link,'https://sportsmississippi.com');const publishedAt=p.date_gmt?`${p.date_gmt}Z`:'';if(!url||!Number.isFinite(Date.parse(publishedAt))||!p.title?.rendered)return [];
    return [{id:Number(p.id),title:plain(p.title.rendered),url,image:http(p._embedded?.['wp:featuredmedia']?.[0]?.source_url,'https://sportsmississippi.com'),publishedAt}];});
}
export function parseMaxpreps(raw:string,source:Source,now:string):Game[]{
  const $=load(raw), panel=$('#ctl00_ContentBottom_ContestsPanel');
  if(!panel.length)throw new Error('MaxPreps scoreboard markup missing');
  const games:Game[]=[];
  panel.find('li[data-contest-id]').each((_,el)=>{
    const card=$(el), teams=card.find('.teams > li');if(teams.length!==2)return;
    const names=teams.map((_,t)=>clean($(t).find('.name').text())).get();
    if(names.some(n=>!n||/non varsity|junior varsity|\bJV\b|middle school/i.test(n)))return;
    const link=http(card.find('a.c-c').attr('href'),source.url);const match=link?.match(/\/(\d{1,2})-(\d{1,2})-(\d{4})\//);if(!match)return;
    const date=`${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
    const a=score($(teams[0]).find('.score').text()),b=score($(teams[1]).find('.score').text());
    const scores:Game['scores']=a!==null&&b!==null?[a,b]:null;const detail=clean(card.find('.details').text());
    const status=statusFrom(detail,!!scores);
    games.push({...base(source,now,date),id:source.id+':'+card.attr('data-contest-id'),sourceUrl:link!,teams:[names[0],names[1]],scores:status==='final'||status==='in-progress'?scores:null,status,time:status==='scheduled'?`${detail||'Time TBA'} · source time`:detail});
  });return games;
}
export function maxprepsDates(raw:string,source:Source):string[]{const $=load(raw);return [...new Set($('a[href]').map((_,el)=>{try{const u=new URL($(el).attr('href')!,source.url);if(u.pathname!==new URL(source.url).pathname)return '';const d=u.searchParams.get('date')?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return d?`${d[3]}-${d[1].padStart(2,'0')}-${d[2].padStart(2,'0')}`:'';}catch{return '';}}).get().filter(Boolean))];}
export function parseMais(raw:string,source:Source,now:string):Game[]{
  const $=load(raw);if(!/Winning Team/.test($.root().text())||!/Losing Team/.test($.root().text()))throw new Error('MAIS final-results table not recognized');
  const out:Game[]=[];$('tr').each((_,el)=>{const c=$(el).children('td').map((_,e)=>clean($(e).text())).get();if(c.length!==7||!/^\d{4}-\d{2}-\d{2}$/.test(c[0])||!['Varsity','A-Game','HSB','HSG'].includes(c[6]))return;const a=score(c[2]),b=score(c[5]);if(a===null||b===null||!c[1]||!c[4])return;out.push({...base(source,now,c[0]),id:`${source.id}:${c[0]}:${c[1]}:${c[4]}`,teams:[c[1],c[4]],scores:[a,b],status:'final',time:'Final'});});return out;
}
export function parseMaccc(raw:string,source:Source,now:string,date:string):Game[]{
  const $=load(raw);if(!$('.event-row').length&&!/Composite Schedule|Composite Calendar/i.test($.root().text()))throw new Error('MACCC composite markup missing');
  const out:Game[]=[];$('.event-row').each((i,el)=>{const e=$(el),t=e.find('.list-events-participants.team');if(t.length!==2)return;
    const names=t.map((_,n)=>clean($(n).find('.team-name').attr('title')||$(n).find('.team-name').clone().find('.va').remove().end().text())).get();if(names.some(n=>!n))return;
    const a=score($(t[0]).find('.team-result').text()),b=score($(t[1]).find('.team-result').text()),scores:Game['scores']=a!==null&&b!==null?[a,b]:null;
    const label=clean(e.find('.cal-status').text()),sport=clean(e.find('.list-event-sport').text());const status=statusFrom(label,!!scores);
    out.push({...base(source,now,date),id:`${source.id}:${date}:${sport}:${names.join(':')}:${i}`,sport,teams:[names[0],names[1]],scores:status==='final'||status==='in-progress'?scores:null,status,time:label||'Time TBA'});
  });return out;
}
export function parseSidearm(raw:string,source:Source,now:string):Game[]{
  const $=load(raw),text=$('#__NUXT_DATA__').text();if(!text)throw new Error('Official calendar structured data missing');
  const state=unflatten(JSON.parse(text),{Reactive:x=>x,ShallowReactive:x=>x,Ref:x=>x,ShallowRef:x=>x,EmptyRef:x=>x});
  const events=new Map<string,Game>();const seen=new WeakSet<object>();
  function walk(value:unknown,depth=0){if(!value||typeof value!=='object'||seen.has(value)||depth>50)return;seen.add(value);
    const v=value as Record<string,any>;
    if(v.id&&v.start_date&&v.opponent?.title&&v.sport?.title){
      const a=score(v.result?.team_score),b=score(v.result?.opponent_score),scores:Game['scores']=a!==null&&b!==null?[a,b]:null;
      const isFinal=!!scores&&/^(W|L|T)$/i.test(v.result?.status||'');
      const label=[v.result?.status,v.result?.prescore,v.result?.postscore,v.game_state_display].filter(Boolean).join(' ');
      let status=statusFrom(label,!!scores);if(isFinal)status='final';else if(v.is_live)status='in-progress';
      const sport=String(v.sport.title);const gender=v.sport.gender==='f'?"Women's ":v.sport.gender==='m'?"Men's ":'';
      const g:Game={...base(source,now,v.start_date.slice(0,10)),id:`${source.id}:${v.id}`,sport:/men|women|football|baseball|softball/i.test(sport)?sport:gender+sport,teams:[source.school!,plain(v.opponent.title)],scores:status==='final'||status==='in-progress'?scores:null,status,time:v.is_all_day?'All day':v.is_tdb?'Time TBA':v.start_date_utc?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(v.start_date_utc)):v.time?`${v.time} · source time`:'Time TBA',sourceUrl:http(v.game_center_link,source.url)||source.url};
      events.set(g.id,g);
    }
    for(const x of Object.values(v))walk(x,depth+1);
  }walk(state);if(!events.size)throw new Error('Official calendar has no server-rendered events; supplemental adapter needed');return [...events.values()];
}
export function parseCalendar(raw:string,source:Source,now:string):Game[]{
  const days=JSON.parse(raw);if(!Array.isArray(days)||!days.length||!days.every(d=>typeof d.date==='string'&&'events' in d))throw new Error('Official calendar response not recognized');
  const out:Game[]=[];
  for(const day of days)for(const v of day.events||[]){
    if(!v.id||!v.opponent?.title||!v.sport?.title||!/^\d{4}-\d{2}-\d{2}/.test(v.date))continue;
    if(/\bJV\b|junior varsity/i.test(v.sport.title+' '+v.opponent.title))continue;
    const a=score(v.result?.team_score),b=score(v.result?.opponent_score),scores:Game['scores']=a!==null&&b!==null?[a,b]:null;
    const detail=plain([v.result?.prescore_info,v.result?.postscore_info].filter(Boolean).join(' · '));
    const label=[v.noplay_text,detail].filter(Boolean).join(' ');
    let status=statusFrom(label,!!scores);
    if(v.status==='C')status='canceled';else if(v.status==='P')status='postponed';
    else if(scores&&/^[WLT]$/.test(v.result?.status||''))status='final';
    else if(v.result?.status==='N'&&detail)status='result';
    const title=String(v.sport.title),short=String(v.sport.shortname||'');
    const sport=/women|men|football|baseball|softball/i.test(title)?title:(short.startsWith('w')?"Women's ":short.startsWith('m')?"Men's ":'')+title;
    out.push({...base(source,now,v.date.slice(0,10)),id:`${source.id}:${v.id}`,sport,teams:[source.school!,plain(v.opponent.title)],scores:status==='final'?scores:null,status,result:status==='result'?detail:undefined,time:v.time?`${plain(v.time)} · source time`:'Time TBA',sourceUrl:http(v.result?.boxscore?.url||v.result?.recap?.url,source.url)||source.url});
  }return out;
}
export function monitorMais(raw:string){const text=load(raw).root().text();if(/No results have been posted|No scores have been posted/.test(text))return;if(/Volleyball Scores|Event Date|Meet Results|Tournament Results/.test(text))throw new Error('Published results need format validation; withheld from broadcast');throw new Error('MAIS results page not recognized');}
export function parseMileSplit(raw:string,source:Source,now:string):Game[]{
  const $=load(raw);if(!$('#ddYear').length||!$('#ddLevel').length)throw new Error('MileSplit calendar markup missing');
  const year=$('#ddYear option[selected]').attr('value');if(!/^20\d{2}$/.test(year||''))throw new Error('MileSplit calendar year not explicit');
  const out:Game[]=[];$('.meet-row').each((_,el)=>{const r=$(el),name=clean(r.find('.meet-row__name').text()),venue=clean(r.find('.meet-row__venue').text());
    if(!r.attr('data-level')?.split(',').includes('hs')||!/\bMS$/.test(venue)||/elementary|middle school|junior high|\bJV\b|ES\/MS/i.test(name))return;
    const day=clean(r.find('.meet-row__day').first().text()),dateMs=Date.parse(`${day} ${year} 12:00:00 GMT`);if(!Number.isFinite(dateMs))return;
    const result=http(r.find('.meet-row__results').attr('href'),source.url),url=http(r.find('.meet-row__name').attr('href'),source.url);if(!url)return;
    const status=/cancel/i.test(name)?'canceled':result?'result':'scheduled';
    out.push({...base(source,now,new Date(dateMs).toISOString().slice(0,10)),id:`${source.id}:${r.attr('data-meet-id')}`,teams:[name,venue],scores:null,status,event:true,result:result?'Results posted · see MileSplit':undefined,time:'Meet time TBA',sourceUrl:result||url});
  });return out;
}
