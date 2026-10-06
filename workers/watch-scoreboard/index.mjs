// Decorates the existing watch site's static HTML while retaining its player assets.
const scoreboardMarkup=`<section class="scoreboard-section" aria-label="Mississippi high-school scoreboard" style="margin:24px 0 40px"><div class="section-heading" style="margin-bottom:14px"><div><p class="eyebrow">AROUND THE STATE</p><h2>Scores &amp; upcoming games</h2></div><a href="https://mississippisportsapp.com/scoreboard/" target="_blank" rel="noopener">Choose teams &amp; embed scores ↗</a></div><iframe id="ms-scoreboard" src="https://mississippisportsapp.com/scoreboard/embed?group=statewide&amp;days=8&amp;v=20261006-statewide" title="Mississippi high-school scores and upcoming games" width="100%" height="264" style="display:block;border:0;border-radius:8px" loading="eager"></iframe></section>`;
export default {async fetch(request,env){
  const response=await env.ASSETS.fetch(request),path=new URL(request.url).pathname;
  if(request.method!=='GET'||!(path==='/'||path.startsWith('/watch/'))||!response.headers.get('Content-Type')?.includes('text/html')||response.status!==200)return response;
  const headers=new Headers(response.headers);
  const csp=headers.get('Content-Security-Policy');
  if(csp){const directives=csp.split(';').filter(d=>!d.trim().startsWith('frame-src'));directives.push(" frame-src 'self' https://mississippisportsapp.com");headers.set('Content-Security-Policy',directives.join(';'));}
  headers.delete('Content-Length');headers.delete('ETag');headers.set('Cache-Control','no-cache');
  return new HTMLRewriter().on('.watch-layout',{element(element){element.after(scoreboardMarkup,{html:true});}}).transform(new Response(response.body,{status:response.status,headers}));
}};

