import { NextResponse } from 'next/server';
import { loadSupabaseItems } from '../_lib/supabaseDeadlock';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadSupabaseItems());
  } catch (error) {
    console.error('Deadlock API item fetch failed:', error);
    return NextResponse.json(
      {
        error: `Deadlock APIからのアイテムデータ取得に失敗しました。${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 502 },
    );
  }
}
