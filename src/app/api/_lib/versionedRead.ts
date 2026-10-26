import { NextResponse } from 'next/server';
import { createAssetRepository } from '../../../server/versionedAssetStore';
import { loadVersionedDisplayData } from '../../../server/versionedDisplayData';
import { getSupabaseServerClient } from './supabaseDeadlock';

// Server-only, non-secret rollout switch. This change does not set it anywhere.
// Missing configuration preserves existing behavior; invalid values fail closed.
export function assetReadMode(): 'legacy' | 'versioned' | 'invalid' {
  const mode = process.env.DEADLOCK_ASSET_READ_MODE;
  if (mode === undefined || mode === 'legacy') return 'legacy';
  return mode === 'versioned' ? 'versioned' : 'invalid';
}

export async function versionedGetResponse(collection: 'all' | 'heroes' | 'items' = 'all') {
  const mode = assetReadMode();
  if (mode === 'legacy') return null;
  const options = { status: 503, headers: { 'Cache-Control': 'no-store' } };
  if (mode === 'invalid') return NextResponse.json({ code: 'ASSET_READ_MODE_INVALID', error: 'ゲームデータの読み取り設定を確認してください。' }, options);
  try {
    const repository = createAssetRepository(getSupabaseServerClient());
    const data = await loadVersionedDisplayData({ readActive: repository.readActive });
    const body = collection === 'all' ? data : { data: data[collection], source: data.metadata.source, metadata: data.metadata };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // No secrets, raw RPC errors, upstream fetch, legacy fallback or writes.
    return NextResponse.json({ code: 'VERSIONED_DATA_UNAVAILABLE', error: '保存済みゲームデータを利用できません。' }, options);
  }
}
