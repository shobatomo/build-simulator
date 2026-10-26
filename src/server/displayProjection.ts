import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { AssetBundle, AssetRpcClient } from './versionedAssetStore';
import { loadVersionedDisplayData } from './versionedDisplayData';
import { NORMALIZER_VERSION } from '../domain/assets/normalize';

// Bump this whenever the compatibility formatter or visibility policy changes.
export const DISPLAY_PROJECTION_VERSION = 'legacy-display-v1';
export const MAX_DISPLAY_BYTES = 4_000_000;
export type DisplayCollection = 'all' | 'heroes' | 'items';
export type ProjectionSection = 'heroes' | 'items' | 'metadata';
export interface DisplayProjectionPart { section: ProjectionSection; payloadText: string; contentHash: string }
export interface DisplayProjection { projectionVersion: string; parts: DisplayProjectionPart[] }
type BaseDisplayData = Awaited<ReturnType<typeof loadVersionedDisplayData>>;
type DisplayData = Omit<BaseDisplayData, 'metadata'> & { metadata: BaseDisplayData['metadata'] & { projectionVersion?: string } };
const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_DISPLAY_PROJECTION');
  return value as Record<string, unknown>;
};

// Owner-only publication boundary: full snapshot hashes, normalization and
// derivation are verified BEFORE preparing this persisted read model. This is
// not a client-provided replacement for raw/catalog verification.
export async function prepareDisplayProjection(bundle: AssetBundle): Promise<DisplayProjection> {
  const data = await loadVersionedDisplayData({ readActive: async () => ({ ...bundle, revision: 1 }) });
  const { revision, ...metadata } = data.metadata;
  void revision;
  const values = { heroes: data.heroes, items: data.items, metadata: { metadata, assets: data.assets } };
  const parts = (['heroes', 'items', 'metadata'] as const).map(section => {
    const payloadText = JSON.stringify({ section, projectionVersion: DISPLAY_PROJECTION_VERSION,
      clientVersion: bundle.snapshot.clientVersion, normalizerVersion: bundle.catalog.normalizerVersion,
      snapshotHash: bundle.snapshot.contentHash, value: values[section] });
    if (Buffer.byteLength(payloadText, 'utf8') > MAX_DISPLAY_BYTES) throw new Error('DISPLAY_PROJECTION_TOO_LARGE');
    return { section, payloadText, contentHash: digest(payloadText) };
  });
  const projection = { projectionVersion: DISPLAY_PROJECTION_VERSION, parts };
  // The public all-data response also needs to remain under the response limit.
  decodeDisplayProjection({ ...projection, clientVersion: bundle.snapshot.clientVersion,
    normalizerVersion: bundle.catalog.normalizerVersion, snapshotHash: bundle.snapshot.contentHash, revision: 1 }, 'all');
  return projection;
}

// Normal requests validate ONLY the requested, stored, hash-bound projection.
// Trust boundary: owner-only verified publication + FK/immutable rows + HTTPS.
// This is integrity checking, not a signature against a malicious DB owner.
export function decodeDisplayProjection(input: unknown, collection: DisplayCollection): DisplayData {
  const envelope = object(input);
  if (!['all', 'heroes', 'items'].includes(collection) ||
      envelope.projectionVersion !== DISPLAY_PROJECTION_VERSION || envelope.normalizerVersion !== NORMALIZER_VERSION ||
      !Number.isSafeInteger(envelope.revision) || (envelope.revision as number) < 1 ||
      !Number.isSafeInteger(envelope.clientVersion) || (envelope.clientVersion as number) < 1 ||
      typeof envelope.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.snapshotHash) ||
      !Array.isArray(envelope.parts)) throw new Error('INVALID_DISPLAY_RELEASE');
  const expected = new Set(collection === 'all' ? ['heroes', 'items', 'metadata'] : [collection, 'metadata']);
  const values: Record<string, unknown> = {};
  for (const raw of envelope.parts) {
    const part = object(raw);
    if (typeof part.section !== 'string' || !expected.delete(part.section) || typeof part.payloadText !== 'string' ||
        Buffer.byteLength(part.payloadText, 'utf8') > MAX_DISPLAY_BYTES || digest(part.payloadText) !== part.contentHash) {
      throw new Error('DISPLAY_CHECKSUM_OR_SECTION_MISMATCH');
    }
    const parsed = object(JSON.parse(part.payloadText));
    if (parsed.section !== part.section || parsed.projectionVersion !== envelope.projectionVersion ||
        parsed.clientVersion !== envelope.clientVersion || parsed.normalizerVersion !== envelope.normalizerVersion ||
        parsed.snapshotHash !== envelope.snapshotHash) throw new Error('DISPLAY_RELEASE_MISMATCH');
    values[part.section] = parsed.value;
  }
  if (expected.size) throw new Error('INCOMPLETE_DISPLAY_PROJECTION');
  for (const section of ['heroes', 'items']) {
    if ((collection === 'all' || collection === section) && (!Array.isArray(values[section]) || !values[section].length)) {
      throw new Error('EMPTY_DISPLAY_COLLECTION');
    }
  }
  const common = object(values.metadata);
  const metadata = object(common.metadata);
  if (metadata.snapshotHash !== envelope.snapshotHash || metadata.clientVersion !== envelope.clientVersion ||
      metadata.normalizerVersion !== envelope.normalizerVersion || metadata.storage !== 'versioned' ||
      metadata.source !== 'https://api.deadlock-api.com/v1/assets') throw new Error('DISPLAY_METADATA_MISMATCH');
  object(common.assets);
  const data: DisplayData = { heroes: (values.heroes ?? []) as DisplayData['heroes'],
    items: (values.items ?? []) as DisplayData['items'], assets: common.assets as DisplayData['assets'],
    metadata: { ...(metadata as DisplayData['metadata']), revision: envelope.revision as number,
      projectionVersion: DISPLAY_PROJECTION_VERSION } };
  const response = collection === 'all' ? data : { data: data[collection], source: data.metadata.source, metadata: data.metadata };
  if (Buffer.byteLength(JSON.stringify(response), 'utf8') > MAX_DISPLAY_BYTES) throw new Error('DISPLAY_RESPONSE_TOO_LARGE');
  return data;
}

export async function readDisplayProjection(client: AssetRpcClient, collection: DisplayCollection): Promise<DisplayData> {
  const { data, error } = await client.rpc('read_deadlock_display_release', {
    p_collection: collection, p_projection_version: DISPLAY_PROJECTION_VERSION,
  });
  if (error) throw new Error('DISPLAY_READ_FAILED');
  return decodeDisplayProjection(data, collection);
}
