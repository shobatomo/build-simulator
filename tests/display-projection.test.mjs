import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
import { assetDatabase, publish, readActive, restore } from './helpers/asset-database.mjs';
import { publishDisplay, readDisplay } from './helpers/display-database.mjs';
const { prepareAssetBundle } = loadTs('server/versionedAssetStore.ts');
const { prepareAssetRecovery } = loadTs('server/assetRecovery.ts');
const { prepareDisplayProjection, decodeDisplayProjection, readDisplayProjection } = loadTs('server/displayProjection.ts');
const bundle = plain(prepareAssetBundle(await snapshotFixture()));
const next = plain(prepareAssetBundle(await snapshotFixture(f => { f.itemsEnglish[0].name += ' candidate'; })));
const projection = plain(await prepareDisplayProjection(bundle));
const envelope = { ...projection, revision: 1, clientVersion: 6819, normalizerVersion: '0.2.0', snapshotHash: bundle.snapshot.contentHash };
const hash = text => createHash('sha256').update(text).digest('hex');

test('projection is deterministic, fully verified before preparation and does not mutate its inputs', async () => {
  const before = JSON.stringify(bundle);
  assert.deepEqual(plain(await prepareDisplayProjection(bundle)), projection);
  assert.equal(JSON.stringify(bundle), before);
  const forged = plain(bundle); forged.catalog.heroes[0].name.english = 'forged';
  await assert.rejects(prepareDisplayProjection(forged), /NORMALIZED_CONTENT_MISMATCH/);
  const raw = plain(bundle); raw.snapshot.documents[1].payload[0].name = 'forged';
  await assert.rejects(prepareDisplayProjection(raw), /checksum mismatch/);
  assert.equal(decodeDisplayProjection(envelope, 'all').metadata.revision, 1);
});

test('normal read hashes only the selected persisted parts and never re-fetches or re-normalizes full assets', async () => {
  const { readDisplayProjection: read } = loadTs('server/displayProjection.ts', { overrides: {
    'server/versionedDisplayData.ts': { loadVersionedDisplayData: () => assert.fail('Full bundle processing during a read') },
  } });
  for (const collection of ['all','heroes','items']) {
    let calls = 0;
    const response = await read({ rpc: async (name, args) => {
      calls++; assert.equal(name, 'read_deadlock_display_release');
      assert.deepEqual(plain(args), { p_collection: collection, p_projection_version: 'legacy-display-v1' });
      return { error: null, data: { ...envelope, parts: envelope.parts.filter(p => collection === 'all' || [collection,'metadata'].includes(p.section)) } };
    } }, collection);
    assert.equal(calls, 1);
    assert.equal(response.metadata.snapshotHash, bundle.snapshot.contentHash);
    if (collection === 'heroes') assert.equal(response.items.length, 0);
    if (collection === 'items') assert.equal(response.heroes.length, 0);
  }
});

test('corruption, mixed release/version, duplicate, missing and unexpected sections fail closed', () => {
  const changed = plain(envelope); changed.parts[0].payloadText += ' ';
  const mixed = plain(envelope); mixed.snapshotHash = 'f'.repeat(64);
  const metadata = plain(envelope); const part = metadata.parts.find(p => p.section === 'metadata');
  const body = JSON.parse(part.payloadText); body.value.metadata.snapshotHash = 'a'.repeat(64);
  part.payloadText = JSON.stringify(body); part.contentHash = hash(part.payloadText);
  for (const value of [null, {}, changed, mixed, metadata, { ...envelope, revision: 0 },
    { ...envelope, normalizerVersion: 'future' }, { ...envelope, projectionVersion: 'future' },
    { ...envelope, parts: envelope.parts.slice(1) }, { ...envelope, parts: [...envelope.parts, envelope.parts[0]] }]) {
    assert.throws(() => decodeDisplayProjection(value, 'all'));
  }
  assert.throws(() => decodeDisplayProjection(envelope, 'heroes')); // Don't transfer unrelated items.
});

test('large payload is refused before parse/output and RPC errors cannot expose details', async () => {
  const large = plain(envelope); large.parts[0].payloadText = 'x'.repeat(4_000_001);
  assert.throws(() => decodeDisplayProjection(large, 'all'), /MISMATCH/);
  await assert.rejects(readDisplayProjection({ rpc: async () => ({ data: null, error: { message: 'secret fixture' } }) }, 'all'), /^Error: DISPLAY_READ_FAILED$/);
});

test('SQL display publication is atomic, retains full history, has a small receipt and replays safely', async () => {
  const db = await assetDatabase({ display: true });
  try {
    const receipt = await publishDisplay(db, bundle, null, projection);
    assert.equal(receipt.revision, 1); assert.ok(JSON.stringify(receipt).length < 500);
    assert.equal((await publishDisplay(db, bundle, 1, projection)).revision, 1);
    assert.equal((await publishDisplay(db, next, 1)).revision, 2);
    await assert.rejects(publishDisplay(db, bundle, 1, projection), /revision conflict/);
    assert.equal((await readActive(db)).snapshot.contentHash, next.snapshot.contentHash);
    const counts = (await db.query('select (select count(*)::int from public.deadlock_asset_snapshots) raw, (select count(*)::int from public.deadlock_normalized_snapshots) normalized, (select count(*)::int from public.deadlock_display_projections) parts')).rows[0];
    assert.deepEqual(counts, { raw: 2, normalized: 2, parts: 6 });
    await db.exec('set role service_role');
    for (const collection of ['all','heroes','items']) {
      const saved = await readDisplay(db, collection);
      assert.equal(saved.parts.length, collection === 'all' ? 3 : 2);
      const data = decodeDisplayProjection(saved, collection);
      assert.equal(data.metadata.revision, 2); assert.equal(data.metadata.snapshotHash, next.snapshot.contentHash);
    }
  } finally { await db.close(); }
});

test('SQL rejects missing/hash-invalid/mixed projections and rolls back new raw/catalog and pointer', async () => {
  const db = await assetDatabase({ display: true });
  try {
    await publishDisplay(db, bundle, null, projection);
    const correct = plain(await prepareDisplayProjection(next));
    const badHash = plain(correct); badHash.parts[0].contentHash = 'f'.repeat(64);
    const duplicate = plain(correct); duplicate.parts[2] = duplicate.parts[1];
    for (const candidate of [projection, badHash, duplicate, { ...correct, parts: correct.parts.slice(1) }]) {
      await assert.rejects(publishDisplay(db, next, 1, candidate));
      assert.equal((await readActive(db)).revision, 1);
      assert.equal((await db.query('select count(*)::int n from public.deadlock_asset_snapshots')).rows[0].n, 1);
    }
    // Direct old management function cannot bypass completeness at commit.
    await assert.rejects(publish(db, next, 1), /complete display projection/);
    assert.equal((await readActive(db)).revision, 1);
    await assert.rejects(db.query("delete from public.deadlock_display_projections where section = 'heroes'"), /complete display projection/);
    assert.equal((await readDisplay(db)).parts.length, 3);
  } finally { await db.close(); }
});

test('same projection version cannot silently replace the verified stored read model', async () => {
  const db = await assetDatabase({ display: true });
  try {
    await publishDisplay(db, bundle, null, projection);
    const altered = plain(projection); const value = JSON.parse(altered.parts[0].payloadText);
    value.value[0].name.en = 'different formatter'; altered.parts[0].payloadText = JSON.stringify(value);
    altered.parts[0].contentHash = hash(altered.parts[0].payloadText);
    await assert.rejects(publishDisplay(db, bundle, 1, altered), /different content/);
    assert.equal((await readDisplay(db)).revision, 1);
  } finally { await db.close(); }
});

test('owner recovery atomically restores matching display data while retaining later snapshots', async () => {
  const db = await assetDatabase({ display: true });
  try {
    await publishDisplay(db, bundle, null, projection); await publishDisplay(db, next, 1);
    const parameters = prepareAssetRecovery({ operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', expectedRevision: 2,
      target: bundle, reason: 'Restore reviewed display fixture' });
    await restore(db, parameters);
    const data = decodeDisplayProjection(await readDisplay(db), 'all');
    assert.equal(data.metadata.revision, 3); assert.equal(data.metadata.snapshotHash, bundle.snapshot.contentHash);
    assert.equal((await db.query('select count(*)::int n from public.deadlock_display_projections')).rows[0].n, 6);
  } finally { await db.close(); }
});

test('effective grants allow service read projection only; all anonymous and administrative access denied', async () => {
  const db = await assetDatabase({ display: true });
  try {
    await publishDisplay(db, bundle, null, projection);
    for (const role of ['anon','authenticated','service_role']) {
      await db.exec('reset role; set role ' + role);
      if (role === 'service_role') {
        assert.equal((await readDisplay(db)).revision, 1);
        assert.equal((await db.query('select id,client_version,content_hash from public.deadlock_asset_snapshots')).rows.length, 1);
      } else {
        await assert.rejects(readDisplay(db), /permission denied/);
        await assert.rejects(db.query('select * from public.deadlock_display_projections'), /permission denied/);
      }
      await assert.rejects(readActive(db), /permission denied/);
      await assert.rejects(publishDisplay(db, next, 1), /permission denied/);
      await assert.rejects(publish(db, next, 1), /permission denied/);
      await assert.rejects(db.query('select snapshot_json from public.deadlock_asset_snapshots'), /permission denied/);
      await assert.rejects(db.query('select normalized_json from public.deadlock_normalized_snapshots'), /permission denied/);
      await assert.rejects(db.query('update public.deadlock_active_asset_release set revision = revision'), /permission denied/);
      await assert.rejects(db.query('delete from public.deadlock_display_projections'), /permission denied/);
    }
  } finally { await db.close(); }
});
