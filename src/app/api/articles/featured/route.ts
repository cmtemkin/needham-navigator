import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { Article } from '@/types/article';

/**
 * GET /api/articles/featured
 * Fetch featured articles for homepage hero
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const town = searchParams.get('town') || 'needham';
  const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 10);

  try {
    const supabase = getSupabaseClient({ townId: town });

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .eq('town', town)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/articles/featured] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch featured articles' },
        { status: 500 }
      );
    }

    return NextResponse.json({ articles: (data as Article[]) || [] });
  } catch (error) {
    console.error('[api/articles/featured] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to fetch featured articles. Please try again.' },
      { status: 500 }
    );
  }
}
