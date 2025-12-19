-- ============================================================================
-- XLO System - Missing Tables and Views Fix
-- Purpose: Create rate_limits and other missing tables, then create views
-- ============================================================================

-- ============================================================================
-- Part 1: Create rate_limits table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID,
  endpoint TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('oauth1a', 'oauth2', 'bearer')),
  used_requests INTEGER DEFAULT 0,
  limit_total INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  window_started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint, token_type, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rate_limits' AND policyname = 'Users can manage their own rate limits'
  ) THEN
    CREATE POLICY "Users can manage their own rate limits"
      ON rate_limits FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- Part 2: Add missing columns to existing tables
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

-- Add warning_threshold to rate_limits
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS warning_threshold NUMERIC DEFAULT 0.2;

-- Add is_warning to rate_limits (generated column)
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

CREATE INDEX IF NOT EXISTS idx_rate_limits_is_warning ON rate_limits(is_warning) WHERE is_warning = true;

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
  (remaining::numeric / NULLIF(limit_total, 0) * 100)::numeric(5,2) as remaining_percent,
  reset_at,
  updated_at
FROM rate_limits
WHERE is_warning = true
ORDER BY remaining_percent ASC;

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

SELECT 'rate_limits table' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits')
  THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_rate_limit_warnings view' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_rate_limit_warnings')
  THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_active_loop_locks view' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_active_loop_locks')
  THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT 'v_recent_duplicate_attempts view' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_recent_duplicate_attempts')
  THEN '✅ Exists' ELSE '❌ Missing' END as status;

SELECT '✅ All missing tables and views created successfully!' as result;
