/**
 * POST /api/articles/generate
 * Admin endpoint to trigger article generation on demand.
 * Protected by admin auth (same as other admin routes).
 */

import { isAdminAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  generateFromMeetingMinutes,
  generateFromPublicRecord,
  summarizeExternalArticle,
  generateDailyBrief,
} from '@/lib/article-generator';

type GenerateType = 'meeting_minutes' | 'public_record' | 'external' | 'daily_brief' | 'all';
const VALID_TYPES: GenerateType[] = ['meeting_minutes', 'public_record', 'external', 'daily_brief', 'all'];

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  let body: { type?: unknown } = {};
  try {
    body = (await request.json()) as { type?: unknown };
  } catch {
    body = {};
  }

  const type = (typeof body.type === 'string' ? body.type : 'all') as GenerateType;

  if (!VALID_TYPES.includes(type)) {
    return Response.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    if (type === 'meeting_minutes' || type === 'all') {
      const articles = await generateFromMeetingMinutes();
      generated += articles.length;
    }

    if (type === 'public_record' || type === 'all') {
      const articles = await generateFromPublicRecord();
      generated += articles.length;
    }

    if (type === 'external' || type === 'all') {
      const articles = await summarizeExternalArticle();
      generated += articles.length;
    }

    if (type === 'daily_brief' || type === 'all') {
      const brief = await generateDailyBrief();
      if (brief) {
        generated += 1;
      } else {
        skipped += 1;
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error during generation';
    errors.push(msg);
    return Response.json({ generated, skipped, errors }, { status: 500 });
  }

  return Response.json({ generated, skipped, errors });
}
