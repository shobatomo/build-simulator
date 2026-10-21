import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const routeUrl = new URL('../src/app/api/sync/deadlock-data-first/route.ts', import.meta.url);
const routeCode = ts.transpileModule(readFileSync(routeUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fixtureData = { heroes: [{ id: 'hero' }], items: [{ id: 'item' }], assets: {} };
// This is a public fixture string, not a generated or configured credential.
const fixtureSecret = 'test-only-sync-authorization';

function loadRoute({ secret, fresh = fixtureData, stored = fixtureData, syncError } = {}) {
  const calls = { fresh: 0, stored: 0, sync: 0 };
  const resolve = (value) => {
    if (value instanceof Error) throw value;
    return value;
  };
  const modules = {
    'node:buffer': { Buffer },
    'node:crypto': { timingSafeEqual },
    'next/server': { NextResponse: { json: (...args) => globalThis.Response.json(...args) } },
    '../../_lib/deadlockData': {
      loadDeadlockData: async () => { calls.fresh++; return resolve(fresh); },
    },
    '../../_lib/supabaseDeadlock': {
      loadDeadlockDataFromSupabase: async () => { calls.stored++; return resolve(stored); },
      syncDeadlockDataToSupabase: async () => {
        calls.sync++;
        if (syncError) throw syncError;
        return fixtureData;
      },
    },
  };
  const module = { exports: {} };
  // Real data modules and the host environment are deliberately inaccessible.
  runInNewContext(routeCode, {
    exports: module.exports,
    module,
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`);
      return modules[name];
    },
    process: { env: secret === undefined ? {} : { DEADLOCK_SYNC_SECRET: secret } },
    console: { error() {} },
    fetch() { throw new Error('Network access is forbidden in this test'); },
  }, { filename: routeUrl.pathname });
  return { ...module.exports, calls };
}

const postRequest = (authorization) => new globalThis.Request('https://example.invalid/api/sync/deadlock-data-first', {
  method: 'POST',
  headers: authorization === undefined ? {} : { authorization },
});

test('GET serves upstream data without reading or writing the database', async () => {
  const route = loadRoute();
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), fixtureData);
  assert.deepEqual(route.calls, { fresh: 1, stored: 0, sync: 0 });
});

test('GET falls back to saved data without synchronizing', async () => {
  const route = loadRoute({ fresh: new Error('upstream unavailable') });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), fixtureData);
  assert.deepEqual(route.calls, { fresh: 1, stored: 1, sync: 0 });
});

for (const [name, stored] of [
  ['both collections empty', { heroes: [], items: [] }],
  ['heroes missing', { heroes: [], items: fixtureData.items }],
  ['items missing', { heroes: fixtureData.heroes, items: [] }],
]) {
  test(`GET returns 503 without synchronizing when ${name}`, async () => {
    const route = loadRoute({ secret: fixtureSecret, fresh: new Error('upstream unavailable'), stored });
    const response = await route.GET();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'DATA_UNAVAILABLE');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(route.calls, { fresh: 1, stored: 1, sync: 0 });
  });
}

test('GET returns an error without synchronizing when both reads fail', async () => {
  const route = loadRoute({ fresh: new Error('upstream unavailable'), stored: new Error('database unavailable') });
  assert.equal((await route.GET()).status, 502);
  assert.deepEqual(route.calls, { fresh: 1, stored: 1, sync: 0 });
});

for (const [name, secret] of [['missing', undefined], ['empty', ''], ['whitespace only', '   '], ['containing whitespace', 'test secret']]) {
  test(`POST fails closed with ${name} configuration`, async () => {
    const route = loadRoute({ secret });
    const response = await route.POST(postRequest(`Bearer ${fixtureSecret}`));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'SYNC_NOT_CONFIGURED');
    assert.deepEqual(route.calls, { fresh: 0, stored: 0, sync: 0 });
  });
}

for (const [name, authorization] of [
  ['missing header', undefined],
  ['empty header', ''],
  ['wrong scheme', `Basic ${fixtureSecret}`],
  ['wrong token of equal length', `Bearer ${'x'.repeat(fixtureSecret.length)}`],
  ['wrong token of different length', 'Bearer wrong'],
  ['empty token', 'Bearer'],
  ['extra token', `Bearer ${fixtureSecret} extra`],
]) {
  test(`POST rejects ${name} without any data access`, async () => {
    const route = loadRoute({ secret: fixtureSecret });
    const response = await route.POST(postRequest(authorization));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(route.calls, { fresh: 0, stored: 0, sync: 0 });
  });
}

test('POST calls the mocked sync exactly once for a valid bearer token', async () => {
  const route = loadRoute({ secret: fixtureSecret });
  const response = await route.POST(postRequest(`bEaReR ${fixtureSecret}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), fixtureData);
  assert.deepEqual(route.calls, { fresh: 0, stored: 0, sync: 1 });
});

test('POST handles a mocked synchronization failure after authentication', async () => {
  const route = loadRoute({ secret: fixtureSecret, syncError: new Error('mock sync failed') });
  assert.equal((await route.POST(postRequest(`Bearer ${fixtureSecret}`))).status, 502);
  assert.deepEqual(route.calls, { fresh: 0, stored: 0, sync: 1 });
});
