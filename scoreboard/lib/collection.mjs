import {SPORTS} from '../public/shared.mjs';

export function collectionTtl(date,today){return date===today?180000:date<today?30*60000:6*3600000;}

export function restoreCollectionCache(snapshot,today){
  const cache=new Map();
  for(const row of snapshot.days??[])for(const source of row.sources??[]){
    const sport=SPORTS.find(s=>s.label===source.name);if(!sport)continue;
    const games=(row.games??[]).filter(g=>g.sportKey===sport.key),ttl=collectionTtl(row.date,today);
    const due=Date.parse(source.checkedAt)+(games.some(g=>g.status==='live')?Math.min(ttl,60000):ttl);
    cache.set(`${sport.key}:${row.date}`,{data:{games},url:source.url,checkedAt:source.checkedAt,
      stale:source.state!=='ok',error:source.error,
      nextCheck:source.state==='ok'?Math.min(due,source.nextCheck??Infinity):source.nextCheck??0});
  }
  return cache;
}
