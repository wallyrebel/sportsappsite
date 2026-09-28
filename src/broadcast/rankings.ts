import {load} from 'cheerio/slim';
import {parseExpressionAt} from 'acorn';
import type {Ranking,RankingEntry,Source} from './model';

const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
function validate(entries:RankingEntry[]):RankingEntry[]{
  if(entries.length<10||entries.some(e=>!Number.isInteger(e.rank)||e.rank<1||!e.team||!/^([1-7]A|Private)$/.test(e.classification)||!(e.record==='—'||/^\d+-\d+(?:-\d+)?$/.test(e.record))||!Number.isFinite(e.rating)||e.rating<0||e.rating>100)||new Set(entries.map(e=>e.rank)).size!==entries.length)throw new Error('Ranking rows incomplete or invalid');
  return entries.sort((a,b)=>a.rank-b.rank);
}
function ranking(source:Source,observedAt:string,publishedAt:string,entries:RankingEntry[]):Ranking {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)||!Number.isFinite(Date.parse(publishedAt))||publishedAt>observedAt.slice(0,10))throw new Error('Ranking publication date missing or invalid');
  return {sourceId:source.id,source:source.name,sourceUrl:source.url,sport:source.sport!,publishedAt,observedAt,entries:validate(entries)};
}
export function parseFootballRankings(raw:string,source:Source,observedAt:string):Ranking {
  const $=load(raw),label=clean($('.run-card strong').first().text());
  const date=label.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})/),month=date?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(date[1])+1:0;
  const publishedAt=date&&month?`${date[3]}-${String(month).padStart(2,'0')}-${date[2].padStart(2,'0')}`:'';
  const entries=$('summary.ranking-grid').map((_,el)=>{const row=$(el);return {rank:Number(row.find('.rank-number').text()),team:clean(row.find('.team-cell a').text()),classification:clean(row.find('.team-cell small').text()).split(' ')[0],record:clean(row.children('.tabular').first().text()),rating:Number(row.find('.mfpi-score').text())};}).get();
  return ranking(source,observedAt,publishedAt,entries);
}
export function volleyballBundle(raw:string,source:Source):string {
  const $=load(raw),src=$('link[rel="modulepreload"]').map((_,e)=>$(e).attr('href')).get().find(s=>/^\/_next\/static\/chunks\/page-[\w-]+\.js$/.test(s));
  if(!src)throw new Error('Volleyball ranking data bundle missing');
  return new URL(src,source.url).href;
}
// Read only literal data from the site's published bundle. Never execute remote JavaScript.
function literal(node:any):any {
  if(node.type==='Literal'&&(node.value===null||['string','number','boolean'].includes(typeof node.value)))return node.value;
  if(node.type==='TemplateLiteral'&&!node.expressions.length)return node.quasis[0].value.cooked;
  if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal'&&typeof node.argument.value==='number')return -node.argument.value;
  if(node.type==='ArrayExpression')return node.elements.map(literal);
  if(node.type==='ObjectExpression'){const out=Object.create(null);for(const p of node.properties){if(p.type!=='Property'||p.computed||p.method||p.kind!=='init')throw new Error('Nonliteral ranking data');const key=p.key.type==='Identifier'?p.key.name:literal(p.key);if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe ranking property');out[key]=literal(p.value);}return out;}
  throw new Error('Nonliteral ranking data');
}
export function parseVolleyballRankings(html:string,bundle:string,source:Source,observedAt:string):Ranking {
  const $=load(html),publishedAt=$('.vb-hero time').attr('datetime')||'';
  const match=/\brankings\s*:\s*(\[)/.exec(bundle);if(!match)throw new Error('Volleyball rankings missing');
  const expression=parseExpressionAt(bundle,match.index+match[0].lastIndexOf('['),{ecmaVersion:'latest'});
  const dataNode=expression.type==='SequenceExpression'?expression.expressions[0]:expression;
  if(dataNode.type!=='ArrayExpression')throw new Error('Ranking data is not an array');
  const items=literal(dataNode);
  const bundleDate=/generated_at\s*:\s*[`"'](\d{4}-\d{2}-\d{2})/.exec(bundle)?.[1];
  if(bundleDate!==publishedAt)throw new Error('Volleyball page and data dates disagree');
  return ranking(source,observedAt,publishedAt,items.map((r:any)=>({rank:r.rank,team:r.team,classification:r.classification,record:r.record,rating:r.mvpi})));
}
