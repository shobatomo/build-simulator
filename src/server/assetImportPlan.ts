import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { AssetBundle } from './versionedAssetStore';
import { prepareDisplayProjection, type DisplayProjection } from './displayProjection';

// Offline transport planning only. No client, credentials, DB or network access.
// This bound is a conservative planning value, NOT a verified connector limit.
const CHUNK_BYTES = 192 * 1024;
const MAX_IMPORT_BYTES = 128 * 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export interface ImportChunk { index: number; bytes: number; sha256: string; base64: string }
export interface AssetImportPlan {
  formatVersion: 1;
  sha256: string;
  bytes: number;
  chunkBytes: number;
  chunkCount: number;
  snapshotHash: string;
  clientVersion: number;
  normalizerVersion: string;
  projectionVersion: string;
  chunks: ImportChunk[];
}

export async function prepareAssetImportPlan(bundle: AssetBundle): Promise<AssetImportPlan> {
  const projection = await prepareDisplayProjection(bundle); // Full verification first.
  const content = Buffer.from(JSON.stringify({ bundle, projection }), 'utf8');
  if (content.length > MAX_IMPORT_BYTES) throw new Error('IMPORT_TOO_LARGE');
  const chunks: ImportChunk[] = [];
  for (let offset = 0; offset < content.length; offset += CHUNK_BYTES) {
    const bytes = content.subarray(offset, offset + CHUNK_BYTES);
    chunks.push({ index: chunks.length, bytes: bytes.length, sha256: hash(bytes), base64: bytes.toString('base64') });
  }
  return { formatVersion: 1, sha256: hash(content), bytes: content.length, chunkBytes: CHUNK_BYTES,
    chunkCount: chunks.length, snapshotHash: bundle.snapshot.contentHash, clientVersion: bundle.snapshot.clientVersion,
    normalizerVersion: bundle.catalog.normalizerVersion, projectionVersion: projection.projectionVersion, chunks };
}

// Test/local preflight boundary. A future owner staging implementation must
// enforce these checks server-side before publishing, not trust client flags.
export async function verifyAssetImportPlan(plan: AssetImportPlan): Promise<{ bundle: AssetBundle; projection: DisplayProjection }> {
  if (plan.formatVersion !== 1 || plan.chunkBytes !== CHUNK_BYTES || !Number.isSafeInteger(plan.bytes) ||
      plan.bytes < 1 || plan.bytes > MAX_IMPORT_BYTES || plan.chunkCount !== Math.ceil(plan.bytes / CHUNK_BYTES) ||
      plan.chunks.length !== plan.chunkCount) throw new Error('INVALID_IMPORT_MANIFEST');
  const chunks = plan.chunks.map((chunk, index) => {
    if (chunk.index !== index || chunk.base64.length > Math.ceil(CHUNK_BYTES / 3) * 4) throw new Error('INVALID_IMPORT_CHUNK');
    const bytes = Buffer.from(chunk.base64, 'base64');
    const length = Math.min(CHUNK_BYTES, plan.bytes - index * CHUNK_BYTES);
    if (bytes.length !== length || chunk.bytes !== length || bytes.toString('base64') !== chunk.base64 || hash(bytes) !== chunk.sha256) {
      throw new Error('IMPORT_CHUNK_CHECKSUM_MISMATCH');
    }
    return bytes;
  });
  const content = Buffer.concat(chunks);
  if (content.length !== plan.bytes || hash(content) !== plan.sha256) throw new Error('IMPORT_CHECKSUM_MISMATCH');
  const { bundle, projection } = JSON.parse(content.toString('utf8')) as { bundle: AssetBundle; projection: DisplayProjection };
  if (bundle.snapshot.contentHash !== plan.snapshotHash || bundle.snapshot.clientVersion !== plan.clientVersion ||
      bundle.catalog.normalizerVersion !== plan.normalizerVersion || projection.projectionVersion !== plan.projectionVersion) {
    throw new Error('IMPORT_PROVENANCE_MISMATCH');
  }
  const derived = await prepareDisplayProjection(bundle);
  if (JSON.stringify(derived) !== JSON.stringify(projection)) throw new Error('IMPORT_PROJECTION_MISMATCH');
  return { bundle, projection };
}
