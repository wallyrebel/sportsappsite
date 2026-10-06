import {mergeData,centralDate,shiftDate,type BroadcastData,type Source,type Snapshot,type Game} from './model';
// @ts-ignore shared pure JavaScript is also used by the portable embeds.
import {selectSnapshot} from '../../scoreboard/lib/snapshot.mjs';
interface ScoreGame {id:string;sport:string;sportKey:string;date:string;status:string;startLabel:string|null;detail:string;url:string;observedAt:string;stale:boolean;teams:{name:string;score:number|null}[];}
interface ScoreSource {name:string;date:string;url:string;checkedAt:string|null;state:string;error:string|null;}
export function withHighSchoolScores(data:BroadcastData,snapshot:unknown,now=new Date()):BroadcastData{
  const today=centralDate(now),selected=selectSnapshot(snapshot,{date:shiftDate(today,-1),days:9,now:now.getTime()});
  const mapped:Game[]=selected.games.map((g:ScoreGame)=>({id:g.id,sourceId:'scoreboard-'+g.sportKey,source:'MaxPreps',sourceUrl:g.url,observedAt:g.observedAt,
    level:'High school',sport:g.sport,date:g.date,time:g.startLabel??'Time TBA',teams:g.teams.map(t=>t.name) as [string,string],
    scores:g.teams.every(t=>t.score!==null)?g.teams.map(t=>t.score) as [number,number]:null,
    status:({live:'in-progress',cancelled:'canceled',unknown:'missing'} as Record<string,string>)[g.status]??g.status,stale:g.stale} as Game));
  const replaceDates=new Set((selected.sources as ScoreSource[]).map(s=>s.date));
  const retained=data.games.filter(g=>!(g.level==='High school'&&g.source.startsWith('MaxPreps')&&replaceDates.has(g.date)));
  const sources:Source[]=[...data.sources];
  const snapshots:Snapshot[]=data.sources.map(s=>({sourceId:s.id,games:retained.filter(g=>g.sourceId===s.id),stories:[],lastSuccess:s.lastSuccess,lastAttempt:s.lastAttempt??now.toISOString(),error:s.error,failures:s.failures,requests:0}));
  for(const source of selected.sources as ScoreSource[]){
    if(source.date!==today)continue;
    const key=source.url.match(/\/ms\/(.*?)\/scores\//)?.[1].replaceAll('/','-');if(!key)continue;
    const id='scoreboard-'+key;
    sources.push({id,name:'MaxPreps · '+source.name,url:source.url,kind:'maxpreps',level:'High school',sport:source.name,intervalMinutes:5,note:'Scheduled high-school feed; reporting and scheduler delays apply.'});
    snapshots.push({sourceId:id,games:mapped.filter(g=>g.sourceId===id),stories:[],lastSuccess:source.checkedAt,lastAttempt:selected.lastAttempt??now.toISOString(),runtimeSuccess:source.checkedAt??undefined,error:source.state==='ok'?null:source.error??'Source delayed',failures:source.state==='ok'?0:1,requests:0});
  }
  const merged=mergeData(sources,snapshots,data.gaps,now),stale=new Set(mapped.filter(g=>g.stale).map(g=>g.id));
  merged.games=merged.games.map(g=>({...g,stale:g.stale||stale.has(g.id)}));
  return {...merged,sources:[...data.sources.filter(s=>s.kind!=='maxpreps'),...merged.sources.filter(s=>s.id.startsWith('scoreboard-'))],stories:data.stories,rankings:data.rankings,collector:data.collector};
}
