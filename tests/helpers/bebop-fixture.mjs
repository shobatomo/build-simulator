import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadTs, plain } from './load-ts.mjs';
export const publicFixture = JSON.parse(readFileSync(new URL('../fixtures/bebop-6819.public.json', import.meta.url), 'utf8'));
export const adapter = loadTs('server/deadlockSnapshot.ts');
export async function snapshotFixture(change = () => {}) {
  const fixture = plain(publicFixture);
  change(fixture);
  return adapter.captureRawSnapshot({ clientVersion: fixture.steamInfo.client_version, now: () => new Date('2026-10-23T04:03:00.622Z'), fetcher: async input => {
    const url = new URL(input);
    const endpoint = url.pathname.split('/').pop();
    const suffix = url.searchParams.get('language') === 'japanese' ? 'Japanese' : 'English';
    return globalThis.Response.json(endpoint === 'steam-info' ? fixture.steamInfo : fixture[endpoint + suffix]);
  } });
}
export async function catalogFixture(change) { return adapter.normalizeVerifiedSnapshot(await snapshotFixture(change)); }
export const buildFixture = (catalog, overrides = {}) => ({ clientVersion: catalog.clientVersion, normalizerVersion: catalog.normalizerVersion, sourceSnapshotHash: catalog.sourceSnapshotHash, heroId: '15', level: 1, itemIds: [], abilityStages: { '2521902222': 0 }, ...overrides });
export const contextFixture = (ids = [], overrides = {}) => ({ baseSpiritPower: 0, baseResistancePercent: { bullet: 0, spirit: 0 }, shields: { bullet: 0, spirit: 0 }, healthState: 'full', itemUpgradeStages: Object.fromEntries(ids.map(id=>[id,0])), purchaseContributions: { healthFlat: 0, spiritFlat: 0, weaponDamageFlat: 0 }, ...overrides });
export const conditionsFixture = (overrides = {}) => ({ model: 'resolved-single-hit-v1', distanceMeters: 0, hitLocation: 'body', penetrationPercent: 0, amplificationPercent: 0, specialEffects: [], ...overrides });
