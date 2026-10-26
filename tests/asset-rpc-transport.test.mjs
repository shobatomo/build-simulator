import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
import { assetDatabase, publish, readActive } from './helpers/asset-database.mjs';
const { prepareAssetBundle, createAssetRepository, syncVersionedAssets }=loadTs('server/versionedAssetStore.ts');
const original=plain(prepareAssetBundle(await snapshotFixture()));
const candidate=plain(prepareAssetBundle(await snapshotFixture(f=>{f.itemsEnglish[0].name+=' transport fixture';})));
const origin='https://asset-fixture.invalid';

function mockTransport(handler) {
  const calls=[];
  const client=createClient(origin,'fixture-only-not-a-credential',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      const url=new URL(input instanceof globalThis.Request?input.url:String(input));
      assert.equal(url.origin,origin);assert.equal(init.method,'POST');
      assert.ok(['/rest/v1/rpc/read_deadlock_asset_release','/rest/v1/rpc/publish_deadlock_asset_release'].includes(url.pathname));
      const name=url.pathname.split('/').pop();const args=JSON.parse(init.body);
      calls.push({name,args});
      return handler(name,args,calls.length);
    }},
  });
  return {repository:createAssetRepository(client),calls};
}
const json=data=>globalThis.Response.json(data);
const failure=(status,code='fixture-error')=>globalThis.Response.json({code,message:'private fixture detail must not escape',details:'fixture',hint:null},{status});
test('real SDK serializes read/publication RPC arguments and round-trips through an in-memory DB', async()=>{
  const db=await assetDatabase();
  try {
    // Administrative full-bundle transport is tested as owner, never service_role.
    const {repository,calls}=mockTransport(async(name,args)=>json(name==='read_deadlock_asset_release'
      ?await readActive(db):await publish(db,{snapshot:args.p_snapshot,catalog:args.p_catalog},args.p_expected_revision)));
    assert.equal(await repository.readActive(),null);
    assert.equal((await repository.publish(original,null)).revision,1);
    assert.equal((await repository.readActive()).snapshot.contentHash,original.snapshot.contentHash);
    assert.deepEqual(calls.map(c=>c.name),['read_deadlock_asset_release','publish_deadlock_asset_release','read_deadlock_asset_release']);
    assert.deepEqual(calls[1].args,{p_snapshot:original.snapshot,p_catalog:original.catalog,p_expected_revision:null});
  } finally {await db.close();}
});
test('HTTP permission, missing-function and server errors are sanitized without retrying publication', async()=>{
  for(const status of [401,403,404,500]) {
    const {repository,calls}=mockTransport(()=>failure(status,status===404?'PGRST202':'fixture-error'));
    await assert.rejects(repository.publish(original,null),/^Error: ASSET_REPOSITORY_RPC_FAILED$/);
    assert.equal(calls.length,1);
  }
});
test('malformed, empty or forged successful publication responses cannot masquerade as success', async()=>{
  const forged={...plain(original),revision:1};forged.catalog.heroes[0].name.english='forged';
  for(const payload of [null,[],{},forged]) {
    const {repository,calls}=mockTransport(()=>json(payload));
    await assert.rejects(repository.publish(original,null));assert.equal(calls.length,1);
  }
  const {repository}=mockTransport(()=>new globalThis.Response('not-json',{status:200,headers:{'Content-Type':'application/json'}}));
  await assert.rejects(repository.readActive(),/^Error: ASSET_REPOSITORY_RPC_FAILED$/);
});
test('invalid candidate is rejected before the SDK transport is invoked',async()=>{
  const {repository,calls}=mockTransport(()=>assert.fail('No HTTP expected'));
  const corrupt=plain(original);corrupt.snapshot.documents[0].payload.client_version=-1;
  await assert.rejects(repository.publish(corrupt,null));assert.equal(calls.length,0);
});
test('lost POST response is reconciled by a read and never publishes twice',async()=>{
  const db=await assetDatabase();
  try {
    await publish(db,original,null);
    const {repository,calls}=mockTransport(async(name,args)=>{
      if(name==='read_deadlock_asset_release') return json(await readActive(db));
      await publish(db,{snapshot:args.p_snapshot,catalog:args.p_catalog},args.p_expected_revision);
      throw new TypeError('fixture lost response');
    });
    const result=await syncVersionedAssets({repository,clientVersion:6819,capture:async()=>candidate.snapshot});
    assert.equal(result.status,'published');assert.equal(result.recoveredAfterWriteError,true);assert.equal(result.observedActive.revision,2);
    assert.equal(calls.filter(c=>c.name==='publish_deadlock_asset_release').length,1);
    assert.equal(calls.filter(c=>c.name==='read_deadlock_asset_release').length,2);
  } finally {await db.close();}
});
test('write refusal preserves prior data; unreadable outcomes remain uncertain',async()=>{
  const active={...plain(original),revision:1};
  for(const unreadable of [false,true]) {
    const {repository,calls}=mockTransport((name,args,count)=>{
      if(name==='publish_deadlock_asset_release') return failure(500);
      if(count>1 && unreadable) throw new TypeError('fixture read transport failure');
      return json(active);
    });
    const result=await syncVersionedAssets({repository,clientVersion:6819,capture:async()=>candidate.snapshot});
    assert.equal(result.status,unreadable?'uncertain':'failed');
    assert.equal(calls.filter(c=>c.name==='publish_deadlock_asset_release').length,1);
    assert.equal(result.observedActive?.revision??null,unreadable?null:1);
  }
});
