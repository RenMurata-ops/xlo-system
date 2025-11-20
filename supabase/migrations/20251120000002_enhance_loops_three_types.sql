-- Enhance loops table to support 3 types: post, reply, CTA
-- 投稿ループ、リプライループ、CTAループの3種類に対応

-- Add loop_type column
ALTER TABLE loops ADD COLUMN IF NOT EXISTS loop_type TEXT NOT NULL DEFAULT 'post';
ALTER TABLE loops ADD CONSTRAINT loops_loop_type_check CHECK (loop_type IN ('post', 'reply', 'cta'));

-- Change single template_id to array template_ids
ALTER TABLE loops ADD COLUMN IF NOT EXISTS template_ids UUID[] DEFAULT '{}';

-- Migrate existing reply_template_id to template_ids array
UPDATE loops
SET template_ids = ARRAY[reply_template_id]::UUID[]
WHERE reply_template_id IS NOT NULL AND (template_ids IS NULL OR template_ids = '{}');

-- Add selection mode for post loops
ALTER TABLE loops ADD COLUMN IF NOT EXISTS selection_mode TEXT DEFAULT 'random';
ALTER TABLE loops ADD CONSTRAINT loops_selection_mode_check CHECK (selection_mode IN ('random', 'sequential'));

-- Add last_used_template_index for sequential selection
ALTER TABLE loops ADD COLUMN IF NOT EXISTS last_used_template_index INTEGER DEFAULT 0;

-- Add target settings for reply loops
ALTER TABLE loops ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE loops ADD CONSTRAINT loops_target_type_check CHECK (target_type IS NULL OR target_type IN ('search', 'account_url', 'tweet_url'));

ALTER TABLE loops ADD COLUMN IF NOT EXISTS target_value TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 1;

-- Add monitor settings for CTA loops
ALTER TABLE loops ADD COLUMN IF NOT EXISTS monitor_account_handle TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS last_processed_tweet_id TEXT;

-- Rename min/max_account_count to min/max_accounts for consistency
ALTER TABLE loops RENAME COLUMN min_account_count TO min_accounts;
ALTER TABLE loops RENAME COLUMN max_account_count TO max_accounts;

-- Add comments
COMMENT ON COLUMN loops.loop_type IS 'Type of loop: post (投稿ループ), reply (リプライループ), cta (CTAループ)';
COMMENT ON COLUMN loops.template_ids IS 'Array of template IDs to use (multiple selection supported)';
COMMENT ON COLUMN loops.selection_mode IS 'Template selection mode: random or sequential';
COMMENT ON COLUMN loops.target_type IS 'Target type for reply loops: search, account_url, tweet_url';
COMMENT ON COLUMN loops.target_value IS 'Target value for reply loops (search query, account URL, or tweet URL)';
COMMENT ON COLUMN loops.execution_count IS 'Number of executions per interval for reply loops';
COMMENT ON COLUMN loops.monitor_account_handle IS 'Account handle to monitor for CTA loops (e.g., "elonmusk")';
COMMENT ON COLUMN loops.last_processed_tweet_id IS 'Last processed tweet ID for CTA loops to avoid duplicates';

-- Create index for CTA loop monitoring
CREATE INDEX IF NOT EXISTS idx_loops_monitor_account ON loops(monitor_account_handle) WHERE loop_type = 'cta' AND is_active = true;

-- Update function to get pending loops with new structure
CREATE OR REPLACE FUNCTION get_pending_loops(
  p_user_id UUID DEFAULT NULL,
  p_loop_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  loop_name TEXT,
  loop_type TEXT,
  description TEXT,
  is_active BOOLEAN,
  template_ids UUID[],
  selection_mode TEXT,
  last_used_template_index INT,
  execution_interval_hours INT,
  execution_interval_minutes INT,
  min_accounts INT,
  max_accounts INT,
  executor_account_ids UUID[],
  allowed_account_tags TEXT[],
  target_type TEXT,
  target_value TEXT,
  execution_count INT,
  monitor_account_handle TEXT,
  last_processed_tweet_id TEXT,
  last_execution_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  post_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.loop_name,
    l.loop_type,
    l.description,
    l.is_active,
    l.template_ids,
    l.selection_mode,
    l.last_used_template_index,
    l.execution_interval_hours,
    l.execution_interval_minutes,
    l.min_accounts,
    l.max_accounts,
    l.executor_account_ids,
    l.allowed_account_tags,
    l.target_type,
    l.target_value,
    l.execution_count,
    l.monitor_account_handle,
    l.last_processed_tweet_id,
    l.last_execution_at,
    l.next_execution_at,
    l.post_count
  FROM loops l
  WHERE
    l.is_active = true
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_loop_type IS NULL OR l.loop_type = p_loop_type)
    AND (l.loop_type != 'cta') -- CTA loops are event-driven, not scheduled
    AND (l.next_execution_at IS NULL OR l.next_execution_at <= NOW())
  ORDER BY l.last_execution_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get active CTA loops for monitoring
CREATE OR REPLACE FUNCTION get_active_cta_loops(
  p_account_handle TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  loop_name TEXT,
  template_ids UUID[],
  monitor_account_handle TEXT,
  last_processed_tweet_id TEXT,
  executor_account_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.loop_name,
    l.template_ids,
    l.monitor_account_handle,
    l.last_processed_tweet_id,
    l.executor_account_ids
  FROM loops l
  WHERE
    l.is_active = true
    AND l.loop_type = 'cta'
    AND (p_account_handle IS NULL OR l.monitor_account_handle = p_account_handle);
END;
$$ LANGUAGE plpgsql;

-- Function to update loop stats and template index
CREATE OR REPLACE FUNCTION update_loop_execution_stats(
  p_loop_id UUID,
  p_post_count INT DEFAULT 1,
  p_next_template_index INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE loops
  SET
    last_execution_at = NOW(),
    next_execution_at = CASE
      WHEN execution_interval_minutes IS NOT NULL THEN
        NOW() + (execution_interval_minutes || ' minutes')::INTERVAL
      ELSE
        NOW() + (execution_interval_hours || ' hours')::INTERVAL
    END,
    post_count = post_count + p_post_count,
    last_used_template_index = COALESCE(p_next_template_index, last_used_template_index),
    updated_at = NOW()
  WHERE id = p_loop_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update CTA loop's last processed tweet
CREATE OR REPLACE FUNCTION update_cta_loop_last_tweet(
  p_loop_id UUID,
  p_tweet_id TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE loops
  SET
    last_processed_tweet_id = p_tweet_id,
    last_execution_at = NOW(),
    post_count = post_count + 1,
    updated_at = NOW()
  WHERE id = p_loop_id;
END;
$$ LANGUAGE plpgsql;
