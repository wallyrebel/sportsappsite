export type Level = 'High school' | 'JUCO' | 'College';
export type GameStatus = 'final' | 'result' | 'scheduled' | 'in-progress' | 'postponed' | 'canceled' | 'missing';
export interface Game {
  id: string; sourceId: string; source: string; sourceUrl: string; observedAt: string;
  level: Level; sport: string; date: string; time: string;
  teams: [string, string]; scores: [number, number] | null; status: GameStatus;
  result?: string; event?: boolean; conflict?: boolean; stale?: boolean;
}
export interface Story { id: number; title: string; url: string; image: string | null; publishedAt: string; }
export interface Source {
  id: string; name: string; url: string; kind: 'wordpress' | 'maxpreps' | 'mais' | 'mais-monitor' | 'maccc' | 'sidearm' | 'calendar' | 'milesplit';
  level?: Level; sport?: string; school?: string; intervalMinutes: number; note: string;
}
export interface Snapshot {
  sourceId: string; games: Game[]; stories: Story[]; lastSuccess: string | null;
  lastAttempt: string; error: string | null; failures: number; requests: number;
}
export interface Health extends Source { lastSuccess: string | null; lastAttempt: string | null; error: string | null; failures: number; count: number; state: 'healthy' | 'empty' | 'stale' | 'error' | 'pending'; }
export interface BroadcastData { generatedAt: string; games: Game[]; stories: Story[]; sources: Health[]; gaps: {name:string; url:string; note:string}[]; conflicts: Game[]; }

export function centralDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago', year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function shiftDate(date: string, days: number): string { return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10); }
export function score(value: unknown): number | null {
  const s=String(value ?? '').trim(); return /^\d{1,3}$/.test(s) ? Number(s) : null;
}
export function statusFrom(label: string, hasScores: boolean): GameStatus {
  if (/cancel/i.test(label)) return 'canceled';
  if (/postpon|suspend/i.test(label)) return 'postponed';
  if (/\bfinal\b/i.test(label)) return hasScores ? 'final' : 'missing';
  if (/missing|unreported/i.test(label)) return 'missing';
  if (/\bQ[1-4]\b|\b[1-4](st|nd|rd|th)\b|half|in progress/i.test(label)) return 'in-progress';
  return 'scheduled';
}
const aliases: Record<string,string> = {'mra':'madisonridgelandacademy','olemiss':'mississippi','mississippist':'mississippistate'};
function teamKey(name: string): string { const s=name.toLowerCase().replace(/\b(community college|cc)\b/g,'').replace(/[^a-z0-9]/g,''); return aliases[s] || s; }
export function mergeData(sources: Source[], snapshots: Snapshot[], gaps: BroadcastData['gaps'], now=new Date()): BroadcastData {
  const today=centralDate(now), byId=new Map(snapshots.map(s=>[s.sourceId,s]));
  const health: Health[]=sources.map(s=>{
    const v=byId.get(s.id); const stale=!v?.lastSuccess || now.getTime()-Date.parse(v.lastSuccess)>Math.max(s.intervalMinutes*3,90)*60000;
    const count=s.kind==='wordpress'?v?.stories.length??0:v?.games.length??0;
    return {...s,lastSuccess:v?.lastSuccess??null,lastAttempt:v?.lastAttempt??null,error:v?.error??null,failures:v?.failures??0,count,state:!v?'pending':v.error?'error':stale?'stale':count?'healthy':'empty'};
  });
  const games=snapshots.flatMap(s=>s.games).filter(g=>g.date>=shiftDate(today,-7)&&g.date<=shiftDate(today,14)).map(g=>{
    const stale=now.getTime()-Date.parse(g.observedAt)>3*3600000;
    // An unplayed record from yesterday is not an upcoming game or a presumed final.
    return {...g,stale,status:g.status==='scheduled'&&g.date<today?'missing' as const:g.status};
  });
  const groups=new Map<string,Game[]>();
  for(const g of games){ const k=[g.level,g.sport.toLowerCase(),g.date,...g.teams.map(teamKey).sort()].join('|'); const a=groups.get(k)||[];a.push(g);groups.set(k,a); }
  const output: Game[]=[];
  for(const group of groups.values()){
    // Never collapse doubleheaders from a single source. Cross-source disagreements are withheld.
    const sourcesInGroup=new Set(group.map(g=>g.sourceId));
    const finals=group.filter(g=>g.status==='final');
    const scoreKeys=new Set(finals.map(g=>g.teams.map((t,i)=>[teamKey(t),g.scores?.[i]]).sort().map(v=>v.join(':')).join('|')));
    const ambiguous=sourcesInGroup.size>1&&group.length>sourcesInGroup.size;
    if(sourcesInGroup.size>1&&(scoreKeys.size>1||ambiguous)){output.push(...group.map(g=>({...g,conflict:true})));continue;}
    if(sourcesInGroup.size===1){output.push(...group);continue;}
    output.push([...group].sort((a,b)=>Number(b.status==='final')-Number(a.status==='final')||b.observedAt.localeCompare(a.observedAt))[0]);
  }
  const stories=[...new Map(snapshots.flatMap(s=>s.stories).map(s=>[s.id,s])).values()].filter(s=>Date.parse(s.publishedAt)<=now.getTime()).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  return {generatedAt:now.toISOString(),games:output.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),stories,sources:health,gaps,conflicts:output.filter(g=>g.conflict)};
}
