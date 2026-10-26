import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { snapshotFixture } from './helpers/bebop-fixture.mjs';
import { assetDatabase } from './helpers/asset-database.mjs';
import { publishDisplay, readDisplay } from './helpers/display-database.mjs';

const { prepareAssetBundle } = loadTs('server/versionedAssetStore.ts');
const { loadVersionedDisplayData } = loadTs('server/versionedDisplayData.ts');
const formatter = loadTs('app/api/_lib/deadlockData.ts');
const active = { ...plain(prepareAssetBundle(await snapshotFixture())), revision: 1 };
const { prepareDisplayProjection } = loadTs('server/displayProjection.ts');
const display = { ...plain(await prepareDisplayProjection(active)), revision: 1,
  snapshotHash: active.snapshot.contentHash, clientVersion: 6819, normalizerVersion: '0.2.0' };
const routePaths = ['sync/deadlock-data-first', 'heroes', 'items'];
const legacy = { heroes: [{ id: 'legacy-hero' }], items: [{ id: 'legacy-item' }], assets: {} };

function routeHarness(path, { mode, data = display, failure, read } = {}) {
  const calls = { clients: 0, rpc: [], legacy: 0, writes: 0 };
  const client = createClient('https://asset-fixture.invalid', 'fixture-only-not-a-credential', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      assert.equal(new URL(input).pathname, '/rest/v1/rpc/read_deadlock_display_release');
      assert.equal(init.method, 'POST'); // RPC transport; SQL function is read-only.
      const collection = path.startsWith('sync') ? 'all' : path;
      assert.deepEqual(JSON.parse(init.body), { p_collection: collection, p_projection_version: 'legacy-display-v1' });
      calls.rpc.push('read');
      if (failure) return globalThis.Response.json({ message: 'sensitive-test-detail', code: 'fixture-error' }, { status: failure });
      const result = read ? await read(collection) : data;
      return globalThis.Response.json(result?.parts ? { ...result,
        parts: result.parts.filter(part => collection === 'all' || [collection, 'metadata'].includes(part.section)) } : result);
    } },
  });
  const readLegacy = async () => { calls.legacy++; return legacy; };
  const route = loadTs(`app/api/${path}/route.ts`, {
    env: { ...(mode === undefined ? {} : { DEADLOCK_ASSET_READ_MODE: mode }), DEADLOCK_SYNC_SECRET: 'fixture-sync' },
    externals: { 'next/server': { NextResponse: { json: (...args) => globalThis.Response.json(...args) } } },
    overrides: {
      'app/api/_lib/deadlockData.ts': { ...formatter, loadDeadlockData: readLegacy },
      'app/api/_lib/supabaseDeadlock.ts': {
        getSupabaseServerClient() { calls.clients++; return client; },
        loadDeadlockDataFromSupabase: readLegacy,
        loadSupabaseHeroes: readLegacy, loadSupabaseItems: readLegacy,
        syncDeadlockDataToSupabase() { calls.writes++; assert.fail('No writer may run'); },
      },
    },
  });
  return { ...route, calls };
}

test('display projection keeps one verified version, localization and the existing screen contract', async () => {
  let reads = 0;
  const before = JSON.stringify(active);
  const data = await loadVersionedDisplayData({ readActive: async () => { reads++; return active; } });
  assert.equal(reads, 1);
  assert.equal(data.heroes[0].id, '15');
  assert.ok(data.heroes[0].name.ja);
  assert.ok(data.items.length > 0);
  assert.equal(data.metadata.clientVersion, 6819);
  assert.equal(data.metadata.normalizerVersion, '0.2.0');
  assert.equal(data.metadata.snapshotHash, active.snapshot.contentHash);
  assert.equal(data.metadata.displayModel, 'legacy-unverified');
  assert.deepEqual(plain(data.assets.icons), { categories: {}, stats: {} });
  assert.equal(JSON.stringify(active), before);
});

test('explicit visibility excludes disabled, unknown and unreleased heroes; hidden components still resolve', async () => {
  let baseId;
  const snapshot = await snapshotFixture(f => {
    for (const key of ['heroesEnglish', 'heroesJapanese']) {
      for (const [id, flags] of [[90001, { disabled: true }], [90002, { player_selectable: null }], [90003, { development_state: 'testing' }], [90006, { in_development: true }]]) {
        f[key].push({ ...f[key][0], id, class_name: `hero_fixture_${id}`, ...flags });
      }
    }
    for (const key of ['itemsEnglish', 'itemsJapanese']) {
      const base = f[key].find(item => item.type === 'upgrade' && item.shopable && item.disabled !== true);
      baseId = String(base.id);
      f[key].push({ ...plain(base), id: 90004, class_name: 'upgrade_fixture_parent', component_items: [base.class_name] });
      f[key].push({ ...plain(base), id: 90005, class_name: 'upgrade_fixture_unknown', disabled: null });
      base.disabled = true;
    }
  });
  const data = await loadVersionedDisplayData({ readActive: async () => ({ ...prepareAssetBundle(snapshot), revision: 2 }) });
  assert.deepEqual(plain(data.heroes.map(hero => hero.id)), ['15']);
  assert.equal(data.metadata.omitted.heroes, 4);
  assert.ok(!data.items.some(item => [baseId, '90005'].includes(item.id)));
  const parent = data.items.find(item => item.id === '90004');
  assert.ok(parent.upgradeRelations.componentIds.includes(baseId));
  assert.equal(parent.upgradeRelations.status, 'resolved');
});

test('missing active data, damaged catalog and unsupported normalizer cannot be displayed', async () => {
  const damaged = plain(active); damaged.catalog.heroes[0].name.english = 'forged';
  const unknown = plain(active); unknown.catalog.normalizerVersion = 'future';
  for (const data of [null, { ...active, revision: 0 }, damaged, unknown]) {
    await assert.rejects(loadVersionedDisplayData({ readActive: async () => data }));
  }
});

for (const path of routePaths) {
  test(`${path}: default and explicit legacy modes preserve existing reads without creating a new DB client`, async () => {
    for (const mode of [undefined, 'legacy']) {
      const route = routeHarness(path, { mode });
      assert.deepEqual(await (await route.GET()).json(), legacy);
      assert.equal(route.calls.clients, 0); assert.equal(route.calls.legacy, 1);
      assert.equal(route.calls.writes, 0);
    }
  });

  test(`${path}: versioned mode uses only the read RPC and returns version provenance`, async () => {
    const route = routeHarness(path, { mode: 'versioned' });
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.metadata.clientVersion, 6819);
    assert.equal(body.metadata.revision, 1);
    assert.ok(path.startsWith('sync') ? body.heroes.length && body.items.length : body.data.length);
    assert.deepEqual(route.calls, { clients: 1, rpc: ['read'], legacy: 0, writes: 0 });
  });

  test(`${path}: invalid mode does not touch any data source`, async () => {
    for (const mode of ['', 'VERSIONED', ' versioned ', 'unknown']) {
      const route = routeHarness(path, { mode });
      const response = await route.GET();
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'ASSET_READ_MODE_INVALID');
      assert.deepEqual(route.calls, { clients: 0, rpc: [], legacy: 0, writes: 0 });
    }
  });

  test(`${path}: missing RPC, permissions, server failures or no active release return sanitized 503 without fallback`, async () => {
    for (const options of [{ failure: 401 }, { failure: 403 }, { failure: 404 }, { failure: 500 }, { data: null }, { data: { revision: 1 } }]) {
      const route = routeHarness(path, { mode: 'versioned', ...options });
      const response = await route.GET();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.text();
      assert.ok(body.includes('VERSIONED_DATA_UNAVAILABLE'));
      assert.ok(!body.includes('sensitive-test-detail'));
      assert.equal(route.calls.legacy, 0); assert.equal(route.calls.writes, 0);
      assert.deepEqual(route.calls.rpc, ['read']);
    }
  });
}

test('versioned/invalid read modes refuse legacy sync POST even with valid fixture authorization', async () => {
  for (const mode of ['versioned', '', 'unknown']) {
    const route = routeHarness(routePaths[0], { mode });
    const response = await route.POST(new globalThis.Request('https://fixture.invalid', { method: 'POST', headers: { authorization: 'Bearer fixture-sync' } }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'VERSIONED_SYNC_DISABLED');
    assert.deepEqual(route.calls, { clients: 0, rpc: [], legacy: 0, writes: 0 });
  }
});

test('memory SQL publication -> real SDK with mock transport -> existing API response uses a single saved release', async () => {
  const db = await assetDatabase({ display: true });
  try {
    await publishDisplay(db, active, null);
    const route = routeHarness(routePaths[0], { mode: 'versioned', read: async (collection) => {
      await db.exec('set role service_role');
      return readDisplay(db, collection);
    } });
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).metadata.snapshotHash, active.snapshot.contentHash);
    assert.equal(route.calls.writes, 0);
    assert.equal((await db.query('select revision from public.deadlock_active_asset_release')).rows[0].revision, 1);
  } finally { await db.close(); }
});
