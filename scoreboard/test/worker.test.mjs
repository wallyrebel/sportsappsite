import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.mjs';

test('standalone and production API routes use the same validated feed handler',async()=>{
  const env={ASSETS:{fetch(){throw Error('API request reached static assets');}}};
  for(const path of ['/api/scores','/scoreboard/api/scores']){
    const response=await worker.fetch(new Request('https://example.com'+path+'?date=invalid'),env);
    assert.equal(response.status,400);assert.match((await response.json()).error,/date/);
  }
});
