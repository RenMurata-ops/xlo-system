-- Add advanced X search command fields to engagement_rules
-- Note: using auto_engagement_rules table as referenced in the form

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_since DATE,
ADD COLUMN IF NOT EXISTS search_until DATE,
ADD COLUMN IF NOT EXISTS min_retweets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retweets INTEGER,
ADD COLUMN IF NOT EXISTS min_faves INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_faves INTEGER,
ADD COLUMN IF NOT EXISTS min_replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_replies INTEGER,
ADD COLUMN IF NOT EXISTS has_engagement BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN auto_engagement_rules.search_since IS 'X search: since:YYYY-MM-DD - Filter tweets from this date';
COMMENT ON COLUMN auto_engagement_rules.search_until IS 'X search: until:YYYY-MM-DD - Filter tweets until this date';
COMMENT ON COLUMN auto_engagement_rules.min_retweets IS 'X search: min_retweets:N - Minimum retweet count';
COMMENT ON COLUMN auto_engagement_rules.max_retweets IS 'X search: -min_retweets:N - Maximum retweet count (upper limit)';
COMMENT ON COLUMN auto_engagement_rules.min_faves IS 'X search: min_faves:N - Minimum like/favorite count';
COMMENT ON COLUMN auto_engagement_rules.max_faves IS 'X search: -min_faves:N - Maximum like count (upper limit)';
COMMENT ON COLUMN auto_engagement_rules.min_replies IS 'X search: min_replies:N - Minimum reply count';
COMMENT ON COLUMN auto_engagement_rules.max_replies IS 'X search: -min_replies:N - Maximum reply count (upper limit)';
COMMENT ON COLUMN auto_engagement_rules.has_engagement IS 'X search: filter:has_engagement - Only tweets with some engagement';
