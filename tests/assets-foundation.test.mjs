import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { loadTs, plain } from './helpers/load-ts.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/assets-6807.synthetic.json', import.meta.url), 'utf8'));
const adapter = loadTs('server/deadlockSnapshot.ts');
const { normalizeSnapshot, NORMALIZER_VERSION } = loadTs('domain/assets/normalize.ts');
const { parseAssetValue } = loadTs('domain/assets/values.ts');

function mockFetch({ manifestVersion = 6807, failJapanese = false, malformedItems = false } = {}) {
  const calls = [];
  return {
    calls,
    fetcher: async (input, init) => {
      const url = new URL(input);
      calls.push({ url, init });
      const endpoint = url.pathname.split('/').pop();
      const japanese = url.searchParams.get('language') === 'japanese';
      if (japanese && failJapanese) return globalThis.Response.json({ error: 'fixture failure' }, { status: 503 });
      const payload = endpoint === 'steam-info' ? { ...fixture.steamInfo, client_version: manifestVersion }
        : endpoint === 'client-versions' ? [6807, 6711, 6807]
        : endpoint === 'heroes' ? (japanese ? fixture.heroesJapanese : fixture.heroesEnglish)
        : malformedItems ? { invalid: true } : (japanese ? fixture.itemsJapanese : fixture.itemsEnglish);
      return globalThis.Response.json(payload);
    },
  };
}

const capture = (mock = mockFetch()) => adapter.captureRawSnapshot({
  clientVersion: 6807, fetcher: mock.fetcher, now: () => new Date('2026-10-21T00:00:00Z'),
});

test('normalization is stable when jsonb reorders every object key', async () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().reverse().map(key => [key, reorder(value[key])])) : value;
  const snapshot = await capture();
  assert.deepEqual(plain(normalizeSnapshot(reorder(snapshot))), plain(normalizeSnapshot(snapshot)));
});

test('adapter pins one version and makes only credential-free public GET requests', async () => {
  const mock = mockFetch();
  const snapshot = await capture(mock);
  assert.equal(snapshot.clientVersion, 6807);
  assert.equal(snapshot.documents.length, 5);
  assert.match(snapshot.contentHash, /^[a-f0-9]{64}$/);
  for (const { url, init } of mock.calls) {
    assert.equal(url.origin, 'https://api.deadlock-api.com');
    assert.equal(url.searchParams.get('client_version'), '6807');
    assert.equal(init.method, 'GET');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(Object.hasOwn(init.headers, 'Authorization'), false);
    if (url.pathname.endsWith('/heroes')) assert.equal(url.searchParams.get('only_active'), 'false');
  }
  adapter.verifySnapshot(snapshot);
});

test('version listing is explicit, deduplicated and sorted; latest is not silently selected', async () => {
  assert.deepEqual(plain(await adapter.listClientVersions({ fetcher: mockFetch().fetcher })), [6711, 6807]);
  await assert.rejects(adapter.captureRawSnapshot({ clientVersion: 0, fetcher: mockFetch().fetcher }), /explicit positive/);
});

test('adapter rejects non-official sources before fetching', async () => {
  const mock = mockFetch();
  for (const baseUrl of ['https://example.com/v1/assets', 'https://127.0.0.1/v1/assets', 'http://api.deadlock-api.com/v1/assets']) {
    await assert.rejects(adapter.captureRawSnapshot({ clientVersion: 6807, baseUrl, fetcher: mock.fetcher }), /official public|HTTPS/);
    await assert.rejects(adapter.listClientVersions({ baseUrl, fetcher: mock.fetcher }), /official public|HTTPS/);
  }
  assert.equal(mock.calls.length, 0);
});

test('adapter refuses a mismatched manifest or incomplete/malformed response set', async () => {
  await assert.rejects(capture(mockFetch({ manifestVersion: 6711 })), /manifest client version mismatch/);
  await assert.rejects(capture(mockFetch({ failJapanese: true })), /request failed/);
  await assert.rejects(capture(mockFetch({ malformedItems: true })), /must be an array/);
});

test('snapshot checksum ignores capture time but detects payload or source tampering', async () => {
  const snapshot = await capture();
  const later = await adapter.captureRawSnapshot({ clientVersion: 6807, fetcher: mockFetch().fetcher, now: () => new Date('2026-10-22T00:00:00Z') });
  assert.equal(later.contentHash, snapshot.contentHash);
  const altered = plain(snapshot);
  altered.documents[1].payload[0].name = 'tampered';
  assert.throws(() => adapter.verifySnapshot(altered), /checksum mismatch/);
  const wrongUrl = plain(snapshot);
  wrongUrl.documents[1].sourceUrl = wrongUrl.documents[1].sourceUrl.replace('6807', '6711');
  assert.throws(() => adapter.verifySnapshot(wrongUrl), /source URL/);
});

test('stored-snapshot boundary verifies integrity before normalizing', async () => {
  const snapshot = plain(await capture());
  assert.equal(adapter.normalizeVerifiedSnapshot(snapshot).sourceSnapshotHash, snapshot.contentHash);
  snapshot.documents[1].payload[0].name = 'tampered';
  assert.throws(() => adapter.normalizeVerifiedSnapshot(snapshot), /checksum mismatch/);
});

test('normalization preserves all entity types, Japanese-only identities, growth and cost bonus tables', async () => {
  const snapshot = await capture();
  const before = JSON.stringify(snapshot);
  const catalog = normalizeSnapshot(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(catalog.normalizerVersion, NORMALIZER_VERSION);
  assert.equal(catalog.sourceSnapshotHash, snapshot.contentHash);
  assert.equal(catalog.heroes.length, 2);
  assert.equal(catalog.items.length, 4);
  const hero = catalog.heroes.find((entry) => entry.id === '1');
  assert.deepEqual(plain(hero.costBonuses), fixture.heroesEnglish[0].cost_bonuses);
  assert.deepEqual(plain(hero.legacyPurchaseBonuses), {});
  assert.deepEqual(plain(hero.levelInfo), fixture.heroesEnglish[0].level_info);
  assert.deepEqual(plain(hero.scalingStats), fixture.heroesEnglish[0].scaling_stats);
  assert.deepEqual(plain(hero.boundItems), fixture.heroesEnglish[0].items);
  assert.equal(hero.standardLevelUpUpgrades.UnknownGrowth.status, 'unknown');
  assert.equal(catalog.heroes.find((entry) => entry.id === '2').name.english, null);
  assert.deepEqual(plain(hero.raw.english), fixture.heroesEnglish[0]);
});

test('weapons, component identities, conditions, scale functions, upgrades and original localization survive', async () => {
  const catalog = normalizeSnapshot(await capture());
  const weapon = catalog.items.find((entry) => entry.type === 'weapon');
  assert.deepEqual(plain(weapon.weaponInfo), fixture.itemsEnglish[0].weapon_info);
  const upgrade = catalog.items.find((entry) => entry.id === '21');
  assert.deepEqual(plain(upgrade.componentClassNames), ['item_component']);
  assert.equal(upgrade.className, 'item_upgrade');
  assert.equal(upgrade.disabled, true);
  assert.equal(upgrade.cost.unit, 'souls');
  assert.deepEqual(plain(upgrade.heroIds), ['1', '2']);
  assert.deepEqual(plain(upgrade.properties.find((entry) => entry.key === 'EnemyEffect').usageFlags), ['ConditionallyEnemyApplied']);
  assert.equal(upgrade.properties.find((entry) => entry.key === 'BonusFireRate').condition.english, 'While active');
  const ability = catalog.items.find((entry) => entry.type === 'ability');
  assert.deepEqual(plain(ability.properties.find((entry) => entry.key === 'Damage').scaleFunction), fixture.itemsEnglish[3].properties.Damage.scale_function);
  assert.equal(ability.properties.find((entry) => entry.key === 'JapaneseOnly').sourceLocale, 'japanese');
  assert.equal(ability.upgrades[0].properties[0].bonus.value, 25);
  assert.equal(ability.upgrades[1].properties[0].bonus.unit, 's');
  assert.equal(ability.upgrades[2].properties[0].bonus.status, 'unknown');
  assert.equal(ability.raw.english.description.t3_desc, 'Rank three');
  assert.deepEqual(plain(ability.raw.english), fixture.itemsEnglish[3]);
});

test('normalization rejects mixed versions and duplicate identities instead of merging incompatible data', async () => {
  const snapshot = plain(await capture());
  snapshot.documents[1].clientVersion = 6711;
  assert.throws(() => normalizeSnapshot(snapshot), /Mixed client versions/);
  const duplicate = plain(await capture());
  duplicate.documents[1].payload.push(duplicate.documents[1].payload[0]);
  assert.throws(() => normalizeSnapshot(duplicate), /Duplicate/);
});

for (const [raw, value, unit] of [[12, 12, null], ['1e3', 1000, null], ['12%', 12, '%'], ['-0.5s', -0.5, 's'], ['4m/s', 4, 'm/s']]) {
  test(`scalar interpretation preserves ${JSON.stringify(raw)}`, () => {
    assert.deepEqual(plain(parseAssetValue(raw)), { status: 'known', raw, value, unit });
  });
}

for (const raw of [null, '', '1/2/3', '10-20', '1,000', 'special behavior', { unknown: true }]) {
  test(`unsupported scalar stays unknown: ${JSON.stringify(raw)}`, () => {
    const parsed = parseAssetValue(raw);
    assert.equal(parsed.status, 'unknown');
    assert.equal(Object.hasOwn(parsed, 'value'), false);
    assert.deepEqual(plain(parsed.raw), raw);
  });
}
