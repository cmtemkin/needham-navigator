import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase';
import type { Article, ArticleListResponse, CreateArticleInput } from '@/types/article';

/**
 * GET /api/articles
 * List articles with optional filtering
 * Query params: category, content_type, tag, featured, town, limit, offset
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get('category');
  const contentType = searchParams.get('content_type');
  const tag = searchParams.get('tag');
  const featured = searchParams.get('featured');
  const town = searchParams.get('town') || 'needham';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const supabase = getSupabaseClient({ townId: town });

    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .eq('town', town)
      .order('published_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[api/articles] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      );
    }

    const response: ArticleListResponse = {
      articles: (data as Article[]) || [],
      total: count || 0,
      limit,
      offset,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/articles] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to fetch articles. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles
 * Create a new article (for AI generation pipeline)
 */
export async function POST(request: Request): Promise<Response> {
  let body: CreateArticleInput;
  try {
    body = (await request.json()) as CreateArticleInput;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.title || !body.body || !body.content_type || !body.category) {
    return NextResponse.json(
      { error: 'Missing required fields: title, body, content_type, category' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('articles')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('[api/articles] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create article' },
        { status: 500 }
      );
    }

    return NextResponse.json(data as Article, { status: 201 });
  } catch (error) {
    console.error('[api/articles] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to create article. Please try again.' },
      { status: 500 }
    );
  }
}
