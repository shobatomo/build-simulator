import { NextResponse } from 'next/server';
import { loadSupabaseHeroes } from '../_lib/supabaseDeadlock';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadSupabaseHeroes());
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
