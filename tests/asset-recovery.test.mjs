import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
import { assetDatabase, publish, readActive, restore } from './helpers/asset-database.mjs';
const { prepareAssetBundle, verifyAssetBundle } = loadTs('server/versionedAssetStore.ts');
const { prepareAssetRecovery } = loadTs('server/assetRecovery.ts');
const old = plain(prepareAssetBundle(await snapshotFixture(f => { f.steamInfo.client_version = 6818; })));
const current = plain(prepareAssetBundle(await snapshotFixture()));
const newer = plain(prepareAssetBundle(await snapshotFixture(f => { f.steamInfo.client_version = 6820; })));
const operation = '12345678-1234-4234-8234-123456789001';
const otherOperation = '12345678-1234-4234-8234-123456789002';
const request = (overrides = {}) => ({ operationId: operation, expectedRevision: 2, target: old, reason: 'Restore reviewed fixture', ...overrides });
const counts = async db => (await db.query(`select
  (select count(*)::int from public.deadlock_asset_snapshots) as raw,
  (select count(*)::int from public.deadlock_normalized_snapshots) as normalized,
  (select count(*)::int from deadlock_admin.asset_recovery_operations) as operations`)).rows[0];
async function seeded() {
  const db = await assetDatabase({ recovery: true });
  await publish(db, old, null); await publish(db, current, 1);
  return db;
}
test('recovery parameters verify the exact bundle, revision and reason without I/O', () => {
  const target = plain(old);
  const result = prepareAssetRecovery(request({ target, reason: '  reviewed  ' }));
  assert.equal(result.p_reason, 'reviewed');
  target.snapshot.documents[0].payload.client_version = -1;
  verifyAssetBundle({ snapshot: result.p_snapshot, catalog: result.p_catalog });
  for (const overrides of [{operationId:'invalid'}, {expectedRevision:null}, {expectedRevision:0}, {expectedRevision:1.5}, {expectedRevision:Number.MAX_SAFE_INTEGER}, {reason:''}, {reason:' '.repeat(3)}, {reason:'x'.repeat(501)}]) assert.throws(() => prepareAssetRecovery(request(overrides)));
  const tampered=plain(old);tampered.catalog.heroes[0].name.english='forged';
  assert.throws(() => prepareAssetRecovery(request({target:tampered})),/NORMALIZED_CONTENT_MISMATCH/);
  const unsupported=plain(old);unsupported.catalog.normalizerVersion='0.1.0';
  assert.throws(() => prepareAssetRecovery(request({target:unsupported})),/UNSUPPORTED_NORMALIZER/);
});
test('owner recovery restores an older game version, increases revision and preserves all raw/history rows', async () => {
  const db=await seeded();
  try {
    await assert.rejects(publish(db,old,2),/regression/);
    const before=await db.query('select snapshot_json from public.deadlock_asset_snapshots order by client_version');
    const result=await restore(db,prepareAssetRecovery(request()));
    assert.equal(result.replayed,false);assert.equal(result.operation.expected_revision,2);assert.equal(result.operation.applied_revision,3);
    assert.equal(result.active.revision,3);assert.equal(result.active.snapshot.clientVersion,6818);
    verifyAssetBundle(result.active);
    assert.notEqual(result.operation.from_snapshot_id,result.operation.target_snapshot_id);
    assert.equal(result.operation.reason,'Restore reviewed fixture');assert.ok(result.operation.performed_by);assert.ok(result.operation.performed_at);
    assert.deepEqual(await counts(db),{raw:2,normalized:2,operations:1});
    assert.deepEqual((await db.query('select snapshot_json from public.deadlock_asset_snapshots order by client_version')).rows,before.rows);
  } finally { await db.close(); }
});
test('stale expected revision and absent active pointer fail without modifying storage', async () => {
  const db=await seeded();
  try {
    await assert.rejects(restore(db,prepareAssetRecovery(request({expectedRevision:1}))),/revision conflict/);
    assert.equal((await readActive(db)).revision,2);assert.equal((await counts(db)).operations,0);
    // Only this disposable fixture removes the pointer to exercise missing state.
    await db.query('delete from public.deadlock_active_asset_release');
    await assert.rejects(restore(db,prepareAssetRecovery(request())),/revision conflict/);
    assert.equal(await readActive(db),null);assert.equal((await counts(db)).operations,0);
  } finally { await db.close(); }
});
test('missing, altered or unsupported stored targets and invalid raw SQL inputs fail closed', async () => {
  const db=await seeded();
  try {
    const altered=plain(old);altered.snapshot.capturedAt='2026-10-26T00:00:00.000Z';
    const inputs=[prepareAssetRecovery(request({target:newer})),prepareAssetRecovery(request({target:altered}))];
    const changedCatalog=plain(prepareAssetRecovery(request()));changedCatalog.p_catalog.heroes[0].name.english='forged';inputs.push(changedCatalog);
    const oldNormalizer=plain(prepareAssetRecovery(request()));oldNormalizer.p_catalog.normalizerVersion='0.1.0';inputs.push(oldNormalizer);
    for(const field of ['p_operation_id','p_expected_revision','p_reason']) inputs.push({...plain(prepareAssetRecovery(request())),[field]:null});
    for(const parameters of inputs) await assert.rejects(restore(db,parameters),/not found|Unsupported|Invalid/);
    assert.equal((await readActive(db)).revision,2);assert.deepEqual(await counts(db),{raw:2,normalized:2,operations:0});
  } finally { await db.close(); }
});
test('operation ID replay confirms the historical receipt without undoing a later publication', async () => {
  const db=await seeded();
  try {
    const parameters=prepareAssetRecovery(request());
    const first=await restore(db,parameters);
    const repeated=await restore(db,parameters);
    assert.equal(repeated.replayed,true);assert.equal(repeated.active.revision,3);
    await publish(db,newer,3);
    const lateRetry=await restore(db,parameters);
    assert.equal(lateRetry.replayed,true);assert.deepEqual(lateRetry.operation,first.operation);
    assert.equal(lateRetry.operation.applied_revision,3);assert.equal(lateRetry.active.revision,4);
    assert.equal(lateRetry.active.snapshot.clientVersion,6820);
    assert.equal((await counts(db)).operations,1);
    for(const overrides of [{reason:'different request'}, {expectedRevision:4}, {target:current}]) {
      await assert.rejects(restore(db,prepareAssetRecovery(request(overrides))),/reused/);
    }
    assert.equal((await readActive(db)).revision,4);
  } finally { await db.close(); }
});
test('restoring the already active bundle records an explicit no-op without revision churn', async () => {
  const db=await seeded();
  try {
    const result=await restore(db,prepareAssetRecovery(request({target:current})));
    assert.equal(result.operation.applied_revision,2);assert.equal(result.active.revision,2);
    assert.equal(result.operation.from_snapshot_id,result.operation.target_snapshot_id);
    assert.equal((await counts(db)).operations,1);
  } finally { await db.close(); }
});
test('receipt failure rolls back the pointer change as well as the operation record', async () => {
  const db=await seeded();
  try {
    await db.exec(`create function deadlock_admin.reject_fixture_receipt() returns trigger language plpgsql as $$
      begin raise exception 'fixture receipt write failure'; end; $$;
      create trigger reject_fixture before insert on deadlock_admin.asset_recovery_operations
      for each row execute function deadlock_admin.reject_fixture_receipt();`);
    await assert.rejects(restore(db,prepareAssetRecovery(request())),/fixture receipt write failure/);
    const active=await readActive(db);
    assert.equal(active.revision,2);assert.equal(active.snapshot.clientVersion,6819);
    assert.deepEqual(await counts(db),{raw:2,normalized:2,operations:0});
  } finally { await db.close(); }
});
test('competing restore/publication requests cannot both consume one revision', async () => {
  const db=await seeded();
  try {
    // PGlite serializes one connection. This checks CAS, not multi-session locking.
    const outcomes=await Promise.allSettled([restore(db,prepareAssetRecovery(request())),publish(db,newer,2)]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await readActive(db)).revision,3);
    await assert.rejects(restore(db,prepareAssetRecovery(request({operationId:otherOperation}))),/revision conflict/);
  } finally { await db.close(); }
});
test('recovery remains unavailable to anon, authenticated and service_role without new grants', async () => {
  const db=await seeded();
  try {
    const rls=await db.query("select relrowsecurity from pg_class where oid='deadlock_admin.asset_recovery_operations'::regclass");
    assert.equal(rls.rows[0].relrowsecurity,true);
    for(const role of ['anon','authenticated','service_role']) {
      await db.exec('reset role;');await db.exec('set role '+role+';');
      await assert.rejects(restore(db,prepareAssetRecovery(request())),/permission denied/);
      await assert.rejects(db.query('select * from deadlock_admin.asset_recovery_operations'),/permission denied/);
    }
    await db.exec('reset role;');assert.equal((await readActive(db)).revision,2);
    assert.equal((await counts(db)).operations,0);
  } finally { await db.close(); }
});
