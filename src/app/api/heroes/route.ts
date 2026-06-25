import { NextResponse } from 'next/server';
import { loadDeadlockData } from '../_lib/deadlockData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await loadDeadlockData();
    return NextResponse.json({ data: data.heroes, source: data.metadata.source });
  } catch (error) {
    console.error('Deadlock API hero fetch failed:', error);
    return NextResponse.json(
      {
        error: `Deadlock APIからのヒーローデータ取得に失敗しました。${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 502 },
    );
  }
}
