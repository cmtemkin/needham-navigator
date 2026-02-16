/**
 * Article types for AI-generated news hub
 */

export type ContentType = 'ai_generated' | 'ai_summary' | 'external';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export type ArticleCategory =
  | 'government'
  | 'schools'
  | 'public_safety'
  | 'community'
  | 'development'
  | 'business';

export type SourceType =
  | 'meeting_minutes'
  | 'permit_log'
  | 'news_article'
  | 'public_record'
  | 'dpw_notice';

export interface Article {
  id: string;

  // Content
  title: string;
  subtitle?: string;
  body: string;
  summary?: string;

  // Classification
  content_type: ContentType;
  category: ArticleCategory;
  tags?: string[];

  // Source tracking
  source_urls?: string[];
  source_type?: SourceType;
  source_names?: string[];

  // Metadata
  town: string;
  author: string;
  published_at: string;
  updated_at: string;
  is_featured: boolean;
  is_daily_brief: boolean;

  // AI generation metadata
  model_used?: string;
  generation_prompt?: string;
  confidence_score?: number;

  // Engagement
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;

  // Status
  status: ArticleStatus;
}

export interface CreateArticleInput {
  title: string;
  subtitle?: string;
  body: string;
  summary?: string;
  content_type: ContentType;
  category: ArticleCategory;
  tags?: string[];
  source_urls?: string[];
  source_type?: SourceType;
  source_names?: string[];
  town?: string;
  author?: string;
  is_featured?: boolean;
  is_daily_brief?: boolean;
  model_used?: string;
  generation_prompt?: string;
  confidence_score?: number;
  status?: ArticleStatus;
}

export interface ArticleFilters {
  category?: ArticleCategory;
  content_type?: ContentType;
  tag?: string;
  featured?: boolean;
  town?: string;
  limit?: number;
  offset?: number;
}

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  limit: number;
  offset: number;
}
