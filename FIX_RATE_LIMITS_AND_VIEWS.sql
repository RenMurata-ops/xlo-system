-- ============================================================================
-- XLO System - Fix rate_limits table and create views
-- Purpose: Add missing columns to rate_limits and create missing views
-- ============================================================================

-- ============================================================================
-- Part 1: Fix rate_limits table (add missing columns)
-- ============================================================================

-- Add missing columns to rate_limits if they don't exist
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS token_type TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS used_requests INTEGER DEFAULT 0;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS limit_total INTEGER;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS remaining INTEGER;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS window_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS warning_threshold NUMERIC DEFAULT 0.2;

-- Add constraint for token_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rate_limits_token_type_check'
  ) THEN
    ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_token_type_check
      CHECK (token_type IN ('oauth1a', 'oauth2', 'bearer'));
  END IF;
END $$;

-- Add is_warning computed column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'is_warning'
  ) THEN
    ALTER TABLE rate_limits ADD COLUMN is_warning BOOLEAN GENERATED ALWAYS AS (
      CASE
        WHEN limit_total > 0 AND remaining::numeric / limit_total < warning_threshold
        THEN true
        ELSE false
      END
    ) STORED;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_is_warning ON rate_limits(is_warning) WHERE is_warning = true;

-- ============================================================================
-- Part 2: Add missing columns to other tables
-- ============================================================================

-- Add text_hash to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS text_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_text_hash_created_at ON posts(text_hash, created_at DESC);

-- Add error_json to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS error_json JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_error_json ON posts USING GIN(error_json) WHERE error_json IS NOT NULL;

-- Add locked_until to loops
ALTER TABLE loops ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_loops_locked_until ON loops(locked_until);

-- Add trace_id to loop_executions if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loop_executions') THEN
    ALTER TABLE loop_executions ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid();
    CREATE INDEX IF NOT EXISTS idx_loop_executions_trace_id ON loop_executions(trace_id);
  END IF;
END $$;

-- ============================================================================
-- Part 3: Create Views
-- ============================================================================

-- View: Recent duplicate attempts
CREATE OR REPLACE VIEW v_recent_duplicate_attempts AS
SELECT
  created_at,
  user_id,
  text_hash,
  content,
  error_message
FROM posts
WHERE error_json::text LIKE '%Duplicate post within 24h%'
ORDER BY created_at DESC
LIMIT 50;

-- View: Active loop locks
CREATE OR REPLACE VIEW v_active_loop_locks AS
SELECT
  id,
  loop_name,
  locked_until,
  (locked_until - NOW()) as time_remaining
FROM loops
WHERE locked_until IS NOT NULL
  AND locked_until > NOW()
ORDER BY locked_until ASC;

-- View: Rate limit warnings
CREATE OR REPLACE VIEW v_rate_limit_warnings AS
SELECT
  endpoint,
  token_type,
  remaining,
  limit_total,
  CASE
    WHEN limit_total > 0 THEN (remaining::numeric / NULLIF(limit_total, 0) * 100)::numeric(5,2)
    ELSE NULL
  END as remaining_percent,
  reset_at,
  updated_at
FROM rate_limits
WHERE is_warning = true
ORDER BY remaining_percent ASC NULLS LAST;

-- ============================================================================
-- Part 4: Helper Functions
-- ============================================================================

-- Function to acquire loop lock
CREATE OR REPLACE FUNCTION acquire_loop_lock(
  p_loop_id UUID,
  p_lock_duration_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE loops
  SET locked_until = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE id = p_loop_id
    AND (locked_until IS NULL OR locked_until < NOW());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to release loop lock
CREATE OR REPLACE FUNCTION release_loop_lock(p_loop_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE loops
  SET locked_until = NULL
  WHERE id = p_loop_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old locks
CREATE OR REPLACE FUNCTION cleanup_stale_loop_locks()
RETURNS INTEGER AS $$
DECLARE
  v_cleaned INTEGER;
BEGIN
  UPDATE loops
  SET locked_until = NULL
  WHERE locked_until < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS v_cleaned = ROW_COUNT;
  RETURN v_cleaned;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'rate_limits.endpoint' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'endpoint'
  ) THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_rate_limit_warnings view' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'v_rate_limit_warnings'
  ) THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_active_loop_locks view' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'v_active_loop_locks'
  ) THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_recent_duplicate_attempts view' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'v_recent_duplicate_attempts'
  ) THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT '✅ All missing columns and views created!' as result;
