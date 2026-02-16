-- Articles table for AI-generated news hub
CREATE TABLE IF NOT EXISTS articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Content
  title text NOT NULL,
  subtitle text,
  body text NOT NULL,
  summary text,                    -- 2-3 sentence summary for cards

  -- Classification
  content_type text NOT NULL CHECK (content_type IN ('ai_generated', 'ai_summary', 'external')),
  -- ai_generated: written entirely by AI from public records
  -- ai_summary: AI summary of external content with link to original
  -- external: curated link to external article with AI-added context

  category text NOT NULL,           -- e.g., 'government', 'schools', 'public_safety', 'community', 'development', 'business'
  tags text[],                      -- flexible tagging

  -- Source tracking
  source_urls text[],               -- original sources used to generate/summarize
  source_type text,                 -- 'meeting_minutes', 'permit_log', 'news_article', 'public_record', 'dpw_notice'
  source_names text[],              -- human-readable source names

  -- Metadata
  town text DEFAULT 'needham',
  author text DEFAULT 'Needham Navigator AI',
  published_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_featured boolean DEFAULT false,
  is_daily_brief boolean DEFAULT false,

  -- AI generation metadata
  model_used text,                  -- which model generated it
  generation_prompt text,           -- the prompt used (for reproducibility)
  confidence_score float,           -- how confident the AI is in accuracy

  -- Engagement
  view_count int DEFAULT 0,
  helpful_count int DEFAULT 0,
  not_helpful_count int DEFAULT 0,

  -- Status
  status text DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived'))
);

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read published articles"
  ON articles FOR SELECT
  USING (status = 'published');

CREATE POLICY "Allow inserts for service role"
  ON articles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updates for service role"
  ON articles FOR UPDATE
  USING (true);

-- Indexes for performance
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_type ON articles(content_type);
CREATE INDEX idx_articles_town ON articles(town);
CREATE INDEX idx_articles_featured ON articles(is_featured) WHERE is_featured = true;
CREATE INDEX idx_articles_daily ON articles(is_daily_brief, published_at DESC) WHERE is_daily_brief = true;
CREATE INDEX idx_articles_tags ON articles USING GIN(tags);
CREATE INDEX idx_articles_status ON articles(status);

-- Function to increment feedback counts atomically
CREATE OR REPLACE FUNCTION increment_article_feedback(
  article_id uuid,
  feedback_column text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF feedback_column = 'helpful_count' THEN
    UPDATE articles
    SET helpful_count = helpful_count + 1
    WHERE id = article_id;
  ELSIF feedback_column = 'not_helpful_count' THEN
    UPDATE articles
    SET not_helpful_count = not_helpful_count + 1
    WHERE id = article_id;
  ELSE
    RAISE EXCEPTION 'Invalid feedback column: %', feedback_column;
  END IF;
END;
$$;
