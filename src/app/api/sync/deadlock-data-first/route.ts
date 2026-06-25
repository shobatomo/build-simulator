import { NextResponse } from 'next/server';
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
  try {
    const data = await loadDeadlockDataFromSupabase();
    if (data.heroes.length > 0 && data.items.length > 0) {
      return NextResponse.json(data);
    }
    return NextResponse.json(await syncDeadlockDataToSupabase());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    return NextResponse.json(await syncDeadlockDataToSupabase());
  } catch (error) {
    return errorResponse(error);
  }
}
