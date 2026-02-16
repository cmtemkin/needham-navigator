import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { Article } from '@/types/article';

/**
 * GET /api/articles/daily-brief
 * Fetch today's daily brief article(s)
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const town = searchParams.get('town') || 'needham';

  try {
    const supabase = getSupabaseClient({ townId: town });

    // Get today's date range (midnight to midnight)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .eq('town', town)
      .eq('is_daily_brief', true)
      .gte('published_at', startOfDay.toISOString())
      .lt('published_at', endOfDay.toISOString())
      .order('published_at', { ascending: false });

    if (error) {
      console.error('[api/articles/daily-brief] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch daily brief' },
        { status: 500 }
      );
    }

    // Return the most recent daily brief, or null if none today
    const article = data && data.length > 0 ? (data[0] as Article) : null;

    return NextResponse.json({ article });
  } catch (error) {
    console.error('[api/articles/daily-brief] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to fetch daily brief. Please try again.' },
      { status: 500 }
    );
  }
}
