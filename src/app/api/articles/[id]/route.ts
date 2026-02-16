import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { Article } from '@/types/article';

/**
 * GET /api/articles/[id]
 * Fetch a single article by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Article ID is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        );
      }
      console.error('[api/articles/[id]] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch article' },
        { status: 500 }
      );
    }

    // Increment view count (fire and forget - don't block response)
    // Note: This requires a separate update with service role to bypass RLS
    // For now, we'll skip auto-increment to keep the API simple
    // View count can be incremented via a separate PATCH endpoint if needed

    return NextResponse.json(data as Article);
  } catch (error) {
    console.error('[api/articles/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to fetch article. Please try again.' },
      { status: 500 }
    );
  }
}
