import {withHighSchoolScores} from '../../src/broadcast/scoreboard';
// @ts-ignore Shared JavaScript feed reader has node:test coverage.
import {fetchSnapshot} from '../../scoreboard/lib/snapshot.mjs';
// Binding is configured in Cloudflare Pages for preview and production.
export const onRequestGet: PagesFunction<{BROADCAST:Fetcher}> = async ({env}) => {
  if(!env.BROADCAST)return Response.json({error:'Broadcast collector is not connected yet'},{status:503,headers:{'Cache-Control':'no-store'}});
  try{
    const response=await env.BROADCAST.fetch('https://broadcast.internal/api/broadcast');
    if(!response.ok)return response;
    const data=await response.json();
    try{const {snapshot}=await fetchSnapshot();return Response.json(withHighSchoolScores(data,snapshot),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}
    catch{return Response.json(data,{headers:{'Cache-Control':'no-store'}});}
  }
  catch{return Response.json({error:'Broadcast collector is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
