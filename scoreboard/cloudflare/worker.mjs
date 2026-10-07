import {scoresResponse} from '../lib/snapshot.mjs';
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/scores'||path==='/scoreboard/api/scores')return scoresResponse(request);
  if(path==='/health')return Response.json({ok:true});
  const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers);
  headers.delete('X-Frame-Options');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors *; object-src 'none'; base-uri 'none'");
  headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers});
}};
