-- XLO System - Hardening (Stage5)
-- Created: 2025-11-12
-- Purpose: Add duplicate prevention, double execution lock, rate limit protection

-- ============================================================================
-- 1. Duplicate Post Prevention (24h)
-- ============================================================================

-- Add text_hash column to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS text_hash TEXT;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_posts_text_hash_created_at
  ON posts(text_hash, created_at DESC);

-- Function to prevent duplicate posts within 24 hours
CREATE OR REPLACE FUNCTION prevent_duplicate_posts_24h()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate text_hash if not provided
  NEW.text_hash := COALESCE(NEW.text_hash, encode(digest(NEW.content, 'sha256'), 'hex'));

  -- Check for duplicates within 24 hours
  IF EXISTS (
    SELECT 1 FROM posts
    WHERE text_hash = NEW.text_hash
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Duplicate post within 24h blocked: %', NEW.content
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_prevent_duplicate_posts_24h ON posts;
CREATE TRIGGER trg_prevent_duplicate_posts_24h
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_posts_24h();

-- ============================================================================
-- 2. Double Execution Lock (Loops)
-- ============================================================================

-- Add lock column to loops
ALTER TABLE loops
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_loops_locked_until ON loops(locked_until);

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

-- ============================================================================
-- 3. Rate Limit Tracking Enhancement
-- ============================================================================

-- Add warning_threshold column to rate_limits
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS warning_threshold NUMERIC DEFAULT 0.2;

-- Add is_warning flag
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS is_warning BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN limit_total > 0 AND remaining::numeric / limit_total < warning_threshold
      THEN true
      ELSE false
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_rate_limits_is_warning ON rate_limits(is_warning) WHERE is_warning = true;

-- ============================================================================
-- 4. Trace ID Support
-- ============================================================================

-- Add trace_id to loop_executions
ALTER TABLE loop_executions
  ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_loop_executions_trace_id ON loop_executions(trace_id);

-- ============================================================================
-- 5. Error Tracking Enhancement
-- ============================================================================

-- Add error tracking to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS error_json JSONB;

-- Create index for error queries
CREATE INDEX IF NOT EXISTS idx_posts_error_json ON posts USING GIN(error_json)
  WHERE error_json IS NOT NULL;

-- ============================================================================
-- 6. Validation Queries (for debugging)
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
-- 7. Maintenance Functions
-- ============================================================================

-- Function to cleanup old locks (in case of crashed processes)
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

-- Function to reset failed bulk posts for retry
CREATE OR REPLACE FUNCTION reset_failed_bulk_posts(
  p_user_id UUID DEFAULT NULL,
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  v_reset INTEGER;
BEGIN
  UPDATE bulk_post_queue
  SET
    status = 'pending',
    retry_count = 0,
    next_retry_at = NULL,
    error_message = NULL,
    error_json = NULL
  WHERE status = 'failed'
    AND created_at >= NOW() - (p_hours_ago || ' hours')::INTERVAL
    AND (p_user_id IS NULL OR user_id = p_user_id);

  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN v_reset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Comments for documentation
-- ============================================================================

COMMENT ON COLUMN posts.text_hash IS 'SHA256 hash of content for duplicate detection';
COMMENT ON COLUMN loops.locked_until IS 'Lock timestamp to prevent double execution';
COMMENT ON COLUMN rate_limits.is_warning IS 'Auto-computed flag when remaining < 20%';
COMMENT ON COLUMN loop_executions.trace_id IS 'Unique identifier for debugging and log correlation';

COMMENT ON FUNCTION prevent_duplicate_posts_24h() IS 'Prevents duplicate posts within 24 hours based on text_hash';
COMMENT ON FUNCTION acquire_loop_lock(UUID, INTEGER) IS 'Acquires exclusive lock on loop for execution';
COMMENT ON FUNCTION release_loop_lock(UUID) IS 'Releases loop lock after execution completes';
COMMENT ON FUNCTION cleanup_stale_loop_locks() IS 'Cleans up locks older than 10 minutes (for crashed processes)';
COMMENT ON FUNCTION reset_failed_bulk_posts(UUID, INTEGER) IS 'Resets failed bulk posts to pending for retry';
