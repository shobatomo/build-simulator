import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
const { prepareAssetBundle } = loadTs('server/versionedAssetStore.ts');
const { prepareAssetImportPlan, verifyAssetImportPlan } = loadTs('server/assetImportPlan.ts');
const bundle = plain(prepareAssetBundle(await snapshotFixture(f => { f.itemsJapanese[0].import_test_note = '公開テスト🌱'.repeat(20000); })));
const plan = plain(await prepareAssetImportPlan(bundle));

test('offline import plan preserves full Unicode raw/catalog and bounded chunks without any connection', async () => {
  assert.ok(plan.chunkCount > 1);
  assert.ok(plan.chunks.every(chunk => Buffer.byteLength(JSON.stringify(chunk)) < 263000));
  const restored = await verifyAssetImportPlan(plan);
  assert.deepEqual(plain(restored.bundle), bundle);
});
test('missing, duplicate, reordered, changed or cross-import chunks fail before publication', async () => {
  const missing = plain(plan); missing.chunks.pop();
  const duplicate = plain(plan); duplicate.chunks[1] = duplicate.chunks[0];
  const reordered = plain(plan); reordered.chunks.reverse();
  const corrupt = plain(plan); corrupt.chunks[0].base64 = 'AAAA' + corrupt.chunks[0].base64.slice(4);
  const mixed = plain(plan); mixed.sha256 = 'f'.repeat(64);
  const provenance = plain(plan); provenance.clientVersion++;
  for (const candidate of [missing, duplicate, reordered, corrupt, mixed, provenance]) {
    await assert.rejects(verifyAssetImportPlan(candidate));
  }
});
test('forged catalog cannot enter even the offline import manifest', async () => {
  const candidate = plain(bundle); candidate.catalog.heroes[0].name.english = 'forged';
  await assert.rejects(prepareAssetImportPlan(candidate), /NORMALIZED_CONTENT_MISMATCH/);
});
