import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('watch page gets the ticker while video embeds and catalogs stay intact',async()=>{
  const html='<html><body><section class="watch-layout"><video id="video"></video></section><section class="library">Replays</section></body></html>';
  const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'watch-page',modules:true,scriptPath:fileURLToPath(new URL('../workers/watch-scoreboard/index.mjs',import.meta.url)),compatibilityDate:'2026-09-18',serviceBindings:{ASSETS:async request=>new Response(new URL(request.url).pathname==='/api/catalog.json'?'{}':html,{headers:{'Content-Type':new URL(request.url).pathname==='/api/catalog.json'?'application/json':'text/html','Content-Security-Policy':"default-src 'self'; frame-ancestors *"}})}}]}));
  try{
    const page=await mf.dispatchFetch('https://example.com/'),text=await page.text();
    assert.equal((text.match(/id="ms-scoreboard"/g)??[]).length,1);assert.ok(text.indexOf('ms-scoreboard')>text.indexOf('id="video"'));assert.ok(text.indexOf('ms-scoreboard')<text.indexOf('class="library"'));
    assert.match(page.headers.get('Content-Security-Policy'),/frame-src 'self' https:\/\/mississippisportsapp.com/);
    assert.equal(await (await mf.dispatchFetch('https://example.com/embed/sports')).text(),html);
    assert.equal(await (await mf.dispatchFetch('https://example.com/api/catalog.json')).text(),'{}');
  }finally{await mf.dispose();}
});
