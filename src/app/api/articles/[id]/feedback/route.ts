import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * PATCH /api/articles/[id]/feedback
 * Increment helpful or not_helpful count
 */
export async function PATCH(
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

  let body: { type?: unknown };
  try {
    body = (await request.json()) as { type?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  const feedbackType = body.type;
  if (feedbackType !== 'helpful' && feedbackType !== 'not_helpful') {
    return NextResponse.json(
      { error: 'Feedback type must be "helpful" or "not_helpful"' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();

    // Increment the appropriate counter using Postgres RPC function
    const columnToIncrement = feedbackType === 'helpful' ? 'helpful_count' : 'not_helpful_count';

    const { error } = await supabase.rpc('increment_article_feedback', {
      article_id: id,
      feedback_column: columnToIncrement,
    });

    if (error) {
      console.error('[api/articles/[id]/feedback] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to record feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/articles/[id]/feedback] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to record feedback. Please try again.' },
      { status: 500 }
    );
  }
}
