// Binding is configured in Cloudflare Pages for preview and production.
export const onRequestGet: PagesFunction<{BROADCAST:Fetcher}> = async ({env}) => {
  if(!env.BROADCAST)return Response.json({error:'Broadcast collector is not connected yet'},{status:503,headers:{'Cache-Control':'no-store'}});
  try{return await env.BROADCAST.fetch('https://broadcast.internal/api/broadcast');}
  catch{return Response.json({error:'Broadcast collector is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
