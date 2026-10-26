import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { loadDeadlockData } from '../../_lib/deadlockData';
import { assetReadMode, versionedGetResponse } from '../../_lib/versionedRead';
import {
  loadDeadlockDataFromSupabase,
  syncDeadlockDataToSupabase,
} from '../../_lib/supabaseDeadlock';

export const dynamic = 'force-dynamic';

const errorResponse = (error: unknown) => {
  console.error('Deadlock API data fetch failed:', error);
  return NextResponse.json(
    {
      error: `Deadlock APIからのデータ取得に失敗しました。${
        error instanceof Error ? error.message : String(error)
      }`,
    },
    { status: 502 },
  );
};

export async function GET() {
  const versioned = await versionedGetResponse();
  if (versioned) return versioned;
  try {
    const freshData = await loadDeadlockData();
    return NextResponse.json(freshData);
  } catch {
    try {
      const data = await loadDeadlockDataFromSupabase();
      if (data.heroes.length > 0 && data.items.length > 0) {
        return NextResponse.json(data);
      }
      // Public reads must never trigger ingestion or database writes.
      return NextResponse.json(
        { error: '利用可能なゲームデータがありません。', code: 'DATA_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (fallbackError) {
      return errorResponse(fallbackError);
    }
  }
}

export async function POST(request: Request) {
  // The legacy writer cannot update the versioned store. Keep it disabled
  // during rollout, even if legacy sync authorization was already configured.
  if (assetReadMode() !== 'legacy') {
    return NextResponse.json(
      { error: 'データ更新は現在利用できません。', code: 'VERSIONED_SYNC_DISABLED' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const secret = process.env.DEADLOCK_SYNC_SECRET;
  // Fail closed before contacting the upstream API or Supabase.
  if (!secret || /\s/.test(secret)) {
    return NextResponse.json(
      { error: 'データ更新は現在利用できません。', code: 'SYNC_NOT_CONFIGURED' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(token ?? '');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json(
      { error: 'データ更新の認証に失敗しました。', code: 'UNAUTHORIZED' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' },
      },
    );
  }

  try {
    return NextResponse.json(await syncDeadlockDataToSupabase());
  } catch (error) {
    return errorResponse(error);
  }
}
