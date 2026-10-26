import type { JsonValue, NormalizedCatalog, RawAssetSnapshot } from '../domain/assets/types';
import { NORMALIZER_VERSION } from '../domain/assets/normalize';
import { captureRawSnapshot, hashJson, normalizeVerifiedSnapshot } from './deadlockSnapshot';

export interface AssetBundle { snapshot: RawAssetSnapshot; catalog: NormalizedCatalog }
export interface ActiveAssets extends AssetBundle { revision: number }
export interface AssetRepository {
  readActive(): Promise<ActiveAssets | null>;
  // Implementations MUST commit the immutable bundle and pointer in one transaction.
  publish(bundle: AssetBundle, expectedRevision: number | null): Promise<ActiveAssets>;
}

const json = (value: unknown) => value as JsonValue;
export function prepareAssetBundle(snapshot: RawAssetSnapshot): AssetBundle {
  // Detach caller-owned objects before validating/persisting them.
  const copy: RawAssetSnapshot = JSON.parse(JSON.stringify(snapshot));
  const catalog = normalizeVerifiedSnapshot(copy);
  if (!catalog.heroes.length || !catalog.items.length) throw new Error('EMPTY_COLLECTION');
  const fatal = new Set(['INVALID_ID', 'MISSING_LOCALE', 'LOCALE_IDENTITY_MISMATCH']);
  if (catalog.issues.some((issue) => fatal.has(issue.code))) throw new Error('INCOMPLETE_IDENTITIES');
  for (const collection of [catalog.heroes, catalog.items]) {
    const classes = new Set<string>();
    for (const entity of collection) {
      if (!entity.className || classes.has(entity.className)) throw new Error('AMBIGUOUS_IDENTITY');
      classes.add(entity.className);
    }
  }
  return { snapshot: copy, catalog };
}

export function verifyAssetBundle(bundle: AssetBundle): void {
  if (bundle.catalog.normalizerVersion !== NORMALIZER_VERSION) throw new Error('UNSUPPORTED_NORMALIZER');
  const derived = prepareAssetBundle(bundle.snapshot);
  if (hashJson(json(derived.catalog)) !== hashJson(json(bundle.catalog))) throw new Error('NORMALIZED_CONTENT_MISMATCH');
}

function validateActive(value: ActiveAssets | null): ActiveAssets | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('INVALID_REVISION');
  verifyAssetBundle(value);
  return value;
}

function sameBundle(left: AssetBundle, right: AssetBundle) {
  return left.snapshot.clientVersion === right.snapshot.clientVersion &&
    left.snapshot.contentHash === right.snapshot.contentHash &&
    left.catalog.normalizerVersion === right.catalog.normalizerVersion;
}

export interface SyncAssetsResult {
  status: 'published' | 'unchanged' | 'failed' | 'conflict' | 'uncertain';
  phase: 'read' | 'capture' | 'validate' | 'publish';
  observedActive: ActiveAssets | null;
  code: string | null;
  // A transport failure after a commit is resolved by one read, never a blind retry.
  recoveredAfterWriteError: boolean;
}

export async function syncVersionedAssets(options: {
  repository: AssetRepository;
  clientVersion: number;
  capture?: (version: number) => Promise<RawAssetSnapshot>;
}): Promise<SyncAssetsResult> {
  let previous: ActiveAssets | null;
  const result = (status: SyncAssetsResult['status'], phase: SyncAssetsResult['phase'], observedActive: ActiveAssets | null,
    code: string | null = null, recoveredAfterWriteError = false): SyncAssetsResult =>
    ({ status, phase, observedActive, code, recoveredAfterWriteError });
  try { previous = validateActive(await options.repository.readActive()); }
  catch { return result('failed', 'read', null, 'ACTIVE_READ_FAILED'); }
  if (!Number.isSafeInteger(options.clientVersion) || options.clientVersion <= 0) return result('failed', 'validate', previous, 'INVALID_CLIENT_VERSION');
  if (previous && options.clientVersion < previous.snapshot.clientVersion) return result('failed', 'validate', previous, 'VERSION_REGRESSION');
  let snapshot: RawAssetSnapshot;
  try { snapshot = await (options.capture ?? ((clientVersion) => captureRawSnapshot({ clientVersion })))(options.clientVersion); }
  catch { return result('failed', 'capture', previous, 'CAPTURE_FAILED'); }
  let bundle: AssetBundle;
  try {
    if (snapshot.clientVersion !== options.clientVersion) throw new Error('Requested version mismatch');
    bundle = prepareAssetBundle(snapshot);
    // A valid but truncated array must not silently replace the last good catalog.
    // Legitimate removals require a separately reviewed publication workflow.
    if (previous) {
      for (const key of ['heroes', 'items'] as const) {
        const ids = new Set(bundle.catalog[key].map((entity) => entity.id));
        if (previous.catalog[key].some((entity) => !ids.has(entity.id))) throw new Error('Entity removal requires review');
      }
      if (sameBundle(previous, bundle)) return result('unchanged', 'validate', previous);
    }
  } catch { return result('failed', 'validate', previous, 'CANDIDATE_REJECTED'); }
  try {
    const published = validateActive(await options.repository.publish(bundle, previous?.revision ?? null));
    if (!published || !sameBundle(published, bundle)) throw new Error('Unexpected publication response');
    return result('published', 'publish', published);
  } catch {
    try {
      const observed = validateActive(await options.repository.readActive());
      if (observed && sameBundle(observed, bundle)) return result('published', 'publish', observed, null, true);
      const unchanged = observed?.revision === previous?.revision;
      return result(unchanged ? 'failed' : 'conflict', 'publish', observed, unchanged ? 'PUBLICATION_FAILED' : 'REVISION_CONFLICT');
    } catch { return result('uncertain', 'publish', null, 'PUBLICATION_OUTCOME_UNKNOWN'); }
  }
}

// Inject an already-authorized server client. This module never loads environment
// files, credentials, creates a client, or registers a network endpoint/scheduler.
export interface AssetRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
export function createAssetRepository(client: AssetRpcClient): AssetRepository {
  const call = async (name: string, args?: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('ASSET_REPOSITORY_RPC_FAILED');
    return validateActive(data as ActiveAssets | null);
  };
  return {
    readActive: () => call('read_deadlock_asset_release'),
    async publish(bundle, expectedRevision) {
      verifyAssetBundle(bundle);
      if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) throw new Error('INVALID_REVISION');
      const active = await call('publish_deadlock_asset_release', {
        p_snapshot: bundle.snapshot, p_catalog: bundle.catalog, p_expected_revision: expectedRevision,
      });
      if (!active) throw new Error('EMPTY_PUBLICATION_RESPONSE');
      return active;
    },
  };
}
