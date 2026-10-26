import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
const { prepareAssetBundle, verifyAssetBundle, createAssetRepository, syncVersionedAssets } = loadTs('server/versionedAssetStore.ts');
const original = plain(await snapshotFixture());
const candidate = plain(await snapshotFixture(f => { f.itemsEnglish[0].name += ' fixture revision'; }));
const bundle = prepareAssetBundle(original);
const nextBundle = prepareAssetBundle(candidate);
const active = { ...plain(bundle), revision: 1 };
const sql = readFileSync(new URL('../docs/migrations/versioned-assets-proposal.sql', import.meta.url),'utf8');
const memoryRepository = (initial = active) => {
  let current = plain(initial);
  const state = { writes: 0, reads: 0, repository: {
    async readActive() { state.reads++; return plain(current); },
    async publish(next, revision) {
      state.writes++;
      if ((current?.revision ?? null) !== revision) throw new Error('Conflict');
      current = { ...plain(next), revision: (revision ?? 0)+1 };
      return plain(current);
    },
  } };
  return state;
};
const synchronize = (repository, snapshot = candidate) => syncVersionedAssets({ repository, clientVersion: snapshot.clientVersion, capture: async () => snapshot });

test('versioned sync publishes once and no-op captures do not touch storage', async () => {
  const state = memoryRepository();
  assert.equal((await synchronize(state.repository,original)).status,'unchanged');
  assert.equal(state.writes,0);
  assert.equal((await synchronize(state.repository)).observedActive.revision,2);
  assert.equal(state.writes,1);
});
test('initial empty store can publish a verified complete bundle', async () => {
  const state = memoryRepository(null);
  const result = await synchronize(state.repository,original);
  assert.equal(result.status,'published'); assert.equal(result.observedActive.revision,1);
});
test('capture failure retains last good data without any publish', async () => {
  const state=memoryRepository();
  const result=await syncVersionedAssets({repository:state.repository,clientVersion:6819,capture:async()=>{throw new Error('offline');}});
  assert.equal(result.status,'failed'); assert.equal(result.phase,'capture');
  assert.equal(result.observedActive.snapshot.contentHash,original.contentHash); assert.equal(state.writes,0);
});
test('checksum, locale, empty collection, truncated collection, mixed or regressive versions are rejected', async () => {
  const corrupt=plain(original); corrupt.documents[1].payload[0].name='tampered';
  const missingLocale=plain(original); missingLocale.documents.pop();
  const empty=await snapshotFixture(f=>{f.heroesEnglish=[];f.heroesJapanese=[];});
  const truncated=await snapshotFixture(f=>{f.itemsEnglish.pop();f.itemsJapanese.pop();});
  const wrong=plain(original); wrong.documents[0].clientVersion++;
  const regressive=await snapshotFixture(f=>{f.steamInfo.client_version--;});
  for(const snapshot of [corrupt,missingLocale,empty,truncated,wrong,regressive]) {
    const state=memoryRepository(); const result=await synchronize(state.repository,snapshot);
    assert.equal(result.status,'failed'); assert.equal(state.writes,0);
    assert.equal(result.observedActive.snapshot.contentHash,original.contentHash);
  }
});
test('missing or conflicting entity identities and forged normalized values cannot publish', async () => {
  const missing=await snapshotFixture(f=>{f.heroesJapanese=[];});
  const conflict=await snapshotFixture(f=>{f.heroesJapanese[0].class_name='hero_wrong';});
  for(const snapshot of [missing,conflict]) assert.throws(()=>prepareAssetBundle(snapshot));
  const forged=plain(bundle); forged.catalog.heroes[0].name.english='forged';
  assert.throws(()=>verifyAssetBundle(forged),/NORMALIZED_CONTENT_MISMATCH/);
});
test('write failure before commit is checked once and never retried', async () => {
  const state=memoryRepository(); state.repository.publish=async()=>{state.writes++;throw new Error('failed');};
  const result=await synchronize(state.repository);
  assert.equal(result.status,'failed'); assert.equal(result.code,'PUBLICATION_FAILED');
  assert.equal(state.writes,1); assert.equal(state.reads,2);
});
test('lost commit response is recovered by read-back without a duplicate write', async () => {
  const state=memoryRepository(); const publish=state.repository.publish;
  state.repository.publish=async(...args)=>{await publish(...args);throw new Error('transport');};
  const result=await synchronize(state.repository);
  assert.equal(result.status,'published'); assert.equal(result.recoveredAfterWriteError,true);
  assert.equal(state.writes,1); assert.equal(state.reads,2);
});
test('unknown write result is explicitly uncertain and does not retry', async () => {
  const state=memoryRepository();
  state.repository.publish=async()=>{state.writes++;throw new Error('transport');};
  const read=state.repository.readActive;
  state.repository.readActive=async()=>{if(state.reads) throw new Error('offline');return read();};
  const result=await synchronize(state.repository);
  assert.equal(result.status,'uncertain'); assert.equal(result.observedActive,null); assert.equal(state.writes,1);
});
test('a competing publication is reported as conflict', async () => {
  const competing={...plain(bundle),revision:2}; let reads=0;
  const result=await synchronize({readActive:async()=>++reads===1?active:competing,publish:async()=>{throw new Error('conflict');}});
  assert.equal(result.status,'conflict'); assert.equal(result.observedActive.revision,2);
});
test('invalid stored data fails closed before capture and RPC errors do not expose details', async () => {
  let captured=false;
  const result=await syncVersionedAssets({repository:{readActive:async()=>({...active,revision:0}),publish:async()=>assert.fail()},clientVersion:6819,capture:async()=>{captured=true;return original;}});
  assert.equal(result.phase,'read'); assert.equal(captured,false);
  const repository=createAssetRepository({rpc:async()=>({data:null,error:{message:'sensitive mocked error'}})});
  await assert.rejects(repository.readActive(),/^Error: ASSET_REPOSITORY_RPC_FAILED$/);
});

// In-process PostgreSQL only. No URL, Supabase client, .env or real database.
async function isolatedDatabase() {
  const db=new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
  await db.exec(sql);
  await db.exec('set role service_role;');
  const client={rpc:async(name,args)=>{
    try {
      const result=name==='read_deadlock_asset_release'
        ? await db.query('select public.read_deadlock_asset_release() as data')
        : await db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,$3::bigint) as data',[args.p_snapshot,args.p_catalog,args.p_expected_revision]);
      return {data:result.rows[0].data,error:null};
    } catch(error) { return {data:null,error}; }
  }};
  return {db,repository:createAssetRepository(client)};
}
test('SQL: atomic publication, immutable history, idempotence and CAS protect the active release', async () => {
  const {db,repository}=await isolatedDatabase();
  try {
    assert.equal(await repository.readActive(),null);
    assert.equal((await repository.publish(bundle,null)).revision,1);
    assert.equal((await repository.publish(bundle,1)).revision,1);
    const attempts=await Promise.allSettled([repository.publish(nextBundle,1),repository.publish(nextBundle,1)]);
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await repository.readActive()).revision,2);
    const counts=await db.query('select count(*)::int as n from public.deadlock_asset_snapshots');
    assert.equal(counts.rows[0].n,2);
    await assert.rejects(db.query('update public.deadlock_asset_snapshots set content_hash=content_hash'),/permission denied/);
    await assert.rejects(db.query('delete from public.deadlock_normalized_snapshots'),/permission denied/);
  } finally { await db.close(); }
});
test('SQL: failure after raw insert rolls back the whole transaction and preserves the prior release', async () => {
  const {db,repository}=await isolatedDatabase();
  try {
    await repository.publish(bundle,null);
    const broken=plain(nextBundle.catalog);broken.heroes=[];
    await assert.rejects(db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,1)',[nextBundle.snapshot,broken]),/check constraint/);
    assert.equal((await db.query('select count(*)::int as n from public.deadlock_asset_snapshots')).rows[0].n,1);
    assert.equal((await repository.readActive()).snapshot.contentHash,original.contentHash);
    const regressive=prepareAssetBundle(await snapshotFixture(f=>{f.steamInfo.client_version--;}));
    await assert.rejects(db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,1)',[regressive.snapshot,regressive.catalog]),/regression/);
  } finally { await db.close(); }
});
test('SQL: provenance mismatch and reuse of a normalizer version with different content fail', async () => {
  const {db,repository}=await isolatedDatabase();
  try {
    await repository.publish(bundle,null);
    const broken=plain(nextBundle.catalog);broken.sourceSnapshotHash='f'.repeat(64);
    await assert.rejects(db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,1)',[nextBundle.snapshot,broken]),/foreign key/);
    const rewritten=plain(bundle.catalog);rewritten.heroes[0].name.english='rewritten';
    await assert.rejects(db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,1)',[bundle.snapshot,rewritten]),/different content/);
    assert.equal((await repository.readActive()).revision,1);
  } finally { await db.close(); }
});
test('SQL: RLS and explicit grants deny anonymous/authenticated reads and publication', async () => {
  const {db,repository}=await isolatedDatabase();
  try {
    await repository.publish(bundle,null);
    const tables=await db.query("select relname,relrowsecurity from pg_class where relname in ('deadlock_asset_snapshots','deadlock_normalized_snapshots','deadlock_active_asset_release')");
    assert.equal(tables.rows.length,3); assert.ok(tables.rows.every(r=>r.relrowsecurity));
    for(const role of ['anon','authenticated']) {
      await db.exec('reset role;'); await db.exec('set role '+role+';');
      await assert.rejects(db.query('select * from public.deadlock_asset_snapshots'),/permission denied/);
      await assert.rejects(db.query('select public.read_deadlock_asset_release()'),/permission denied/);
      await assert.rejects(db.query('select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,1)',[nextBundle.snapshot,nextBundle.catalog]),/permission denied/);
    }
  } finally { await db.close(); }
});
