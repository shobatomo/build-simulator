import { createHash } from 'node:crypto';
import type { AssetLocale, JsonValue, RawAssetSnapshot, SnapshotDocument } from '../domain/assets/types';
import { objectValue } from '../domain/assets/values';
import { normalizeSnapshot } from '../domain/assets/normalize';

export const PUBLIC_ASSETS_BASE_URL = 'https://api.deadlock-api.com/v1/assets';
type PublicFetch = typeof fetch;

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite JSON value');
  if (value === undefined) throw new Error('Undefined is not a JSON value');
  return JSON.stringify(value);
}

export const hashJson = (value: JsonValue) => createHash('sha256').update(canonicalJson(value)).digest('hex');

function publicBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Assets base URL must be HTTPS without credentials, query or fragment');
  }
  const canonical = url.href.replace(/\/$/, '');
  if (canonical !== PUBLIC_ASSETS_BASE_URL) throw new Error('Only the official public Assets API is supported');
  return canonical;
}

function requestUrl(base: string, endpoint: string, clientVersion?: number, locale?: AssetLocale) {
  const url = new URL(`${base}/${endpoint}`);
  if (clientVersion !== undefined) url.searchParams.set('client_version', String(clientVersion));
  if (locale) url.searchParams.set('language', locale);
  if (endpoint === 'heroes') url.searchParams.set('only_active', 'false');
  return url;
}

async function getJson(url: URL, fetcher: PublicFetch, timeoutMs: number): Promise<JsonValue> {
  const response = await fetcher(url, {
    method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
    headers: { Accept: 'application/json', 'X-App-Name': 'deadlock-build-simulator' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Assets ${url.pathname.split('/').pop()} request failed (${response.status})`);
  const value: JsonValue = await response.json();
  // Validate JSON-compatible content before calculating a content identity.
  canonicalJson(value);
  return value;
}

export async function listClientVersions(options: { fetcher?: PublicFetch; baseUrl?: string; timeoutMs?: number } = {}) {
  const base = publicBaseUrl(options.baseUrl ?? PUBLIC_ASSETS_BASE_URL);
  const payload = await getJson(requestUrl(base, 'client-versions'), options.fetcher ?? fetch, options.timeoutMs ?? 15_000);
  if (!Array.isArray(payload) || payload.some((value) => typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('Invalid client-versions response');
  }
  return [...new Set(payload as number[])].sort((a, b) => a - b);
}

export function snapshotContentHash(clientVersion: number, documents: SnapshotDocument[]) {
  const identities = documents.map((document) => ({
    endpoint: document.endpoint, locale: document.locale, contentHash: document.contentHash,
  })).sort((a, b) => `${a.endpoint}:${a.locale}`.localeCompare(`${b.endpoint}:${b.locale}`));
  return hashJson({ schemaVersion: 1, clientVersion, documents: identities });
}

export function verifySnapshot(snapshot: RawAssetSnapshot): void {
  if (snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.clientVersion) || snapshot.clientVersion <= 0) {
    throw new Error('Invalid snapshot version');
  }
  const expected = new Set(['steam-info:null', 'heroes:english', 'heroes:japanese', 'items:english', 'items:japanese']);
  const base = publicBaseUrl(snapshot.sourceBaseUrl);
  for (const document of snapshot.documents) {
    const identity = `${document.endpoint}:${document.locale}`;
    if (!expected.delete(identity) || document.clientVersion !== snapshot.clientVersion) throw new Error('Mixed, duplicate or unexpected snapshot document');
    const expectedUrl = requestUrl(base, document.endpoint, snapshot.clientVersion, document.locale ?? undefined).href;
    if (document.sourceUrl !== expectedUrl) throw new Error('Snapshot source URL does not match its requested version');
    if (hashJson(document.payload) !== document.contentHash) throw new Error('Snapshot document checksum mismatch');
    if (document.endpoint === 'steam-info') {
      if (objectValue(document.payload)?.client_version !== snapshot.clientVersion) throw new Error('Steam manifest client version mismatch');
    } else if (!Array.isArray(document.payload)) {
      throw new Error('Asset collection must be an array');
    }
  }
  if (expected.size > 0) throw new Error('Snapshot is missing documents');
  if (snapshotContentHash(snapshot.clientVersion, snapshot.documents) !== snapshot.contentHash) throw new Error('Snapshot checksum mismatch');
}

// Use this boundary for persisted input so validation cannot be accidentally
// skipped before deriving a catalog. The domain normalizer remains pure.
export function normalizeVerifiedSnapshot(snapshot: RawAssetSnapshot) {
  verifySnapshot(snapshot);
  return normalizeSnapshot(snapshot);
}

// Captures data in memory only. It does not read environment variables, persist,
// instantiate a Supabase client or call the application's synchronization routes.
export async function captureRawSnapshot(options: {
  clientVersion: number;
  fetcher?: PublicFetch;
  baseUrl?: string;
  now?: () => Date;
  timeoutMs?: number;
}): Promise<RawAssetSnapshot> {
  const { clientVersion } = options;
  if (!Number.isSafeInteger(clientVersion) || clientVersion <= 0) throw new Error('An explicit positive client version is required');
  const base = publicBaseUrl(options.baseUrl ?? PUBLIC_ASSETS_BASE_URL);
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 15_000;
  const targets: Array<[SnapshotDocument['endpoint'], AssetLocale | null]> = [
    ['steam-info', null], ['heroes', 'english'], ['heroes', 'japanese'], ['items', 'english'], ['items', 'japanese'],
  ];
  const documents = await Promise.all(targets.map(async ([endpoint, locale]): Promise<SnapshotDocument> => {
    const url = requestUrl(base, endpoint, clientVersion, locale ?? undefined);
    const payload = await getJson(url, fetcher, timeoutMs);
    return { endpoint, locale, clientVersion, sourceUrl: url.href, fetchedAt: now().toISOString(), contentHash: hashJson(payload), payload };
  }));
  const snapshot: RawAssetSnapshot = {
    schemaVersion: 1, clientVersion, sourceBaseUrl: base, capturedAt: now().toISOString(),
    contentHash: snapshotContentHash(clientVersion, documents), documents,
  };
  verifySnapshot(snapshot);
  return snapshot;
}
