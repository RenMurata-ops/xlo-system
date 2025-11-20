-- Add engagement tracking fields to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS twitter_id TEXT,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retweet_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impression_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_updated_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_posts_twitter_id ON posts(twitter_id) WHERE twitter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_engagement_updated ON posts(engagement_updated_at) WHERE status = 'posted';

-- Table to store engagement history for tracking over time
CREATE TABLE IF NOT EXISTS post_engagement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_engagement_history_post ON post_engagement_history(post_id);
CREATE INDEX idx_post_engagement_history_recorded ON post_engagement_history(recorded_at);

ALTER TABLE post_engagement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own post engagement history"
ON post_engagement_history FOR SELECT
TO authenticated
USING (
  post_id IN (SELECT id FROM posts WHERE user_id = auth.uid())
);

CREATE POLICY "System can insert engagement history"
ON post_engagement_history FOR INSERT
TO authenticated
WITH CHECK (
  post_id IN (SELECT id FROM posts WHERE user_id = auth.uid())
);
