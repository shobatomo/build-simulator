import { NextResponse } from 'next/server';
import { loadDeadlockData } from '../../_lib/deadlockData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadDeadlockData());
  } catch (error) {
    console.error('Deadlock API data fetch failed:', error);
    return NextResponse.json(
      {
        error: `Deadlock APIからのデータ取得に失敗しました。${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 502 },
    );
  }
}
