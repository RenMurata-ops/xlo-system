-- XLO System - Safety Constraints Migration
-- Created: 2025-12-17
-- Purpose: Add comprehensive safety constraints to prevent data integrity issues

-- ============================================================================
-- 1. Add CHECK constraints for non-negative counts
-- ============================================================================

-- account_tokens table
ALTER TABLE account_tokens
  ADD CONSTRAINT check_followers_count_non_negative
  CHECK (followers_count >= 0);

ALTER TABLE account_tokens
  ADD CONSTRAINT check_following_count_non_negative
  CHECK (following_count >= 0);

ALTER TABLE account_tokens
  ADD CONSTRAINT check_refresh_count_non_negative
  CHECK (refresh_count >= 0);

-- main_accounts table
ALTER TABLE main_accounts
  ADD CONSTRAINT check_followers_count_non_negative
  CHECK (followers_count >= 0);

ALTER TABLE main_accounts
  ADD CONSTRAINT check_following_count_non_negative
  CHECK (following_count >= 0);

-- follow_accounts table
ALTER TABLE follow_accounts
  ADD CONSTRAINT check_followers_count_non_negative
  CHECK (followers_count >= 0);

-- loops table
ALTER TABLE loops
  ADD CONSTRAINT check_post_count_non_negative
  CHECK (post_count >= 0);

ALTER TABLE loops
  ADD CONSTRAINT check_execution_interval_positive
  CHECK (execution_interval_hours > 0);

ALTER TABLE loops
  ADD CONSTRAINT check_min_max_accounts_valid
  CHECK (min_accounts >= 0 AND max_accounts >= min_accounts);

-- templates table
ALTER TABLE templates
  ADD CONSTRAINT check_usage_count_non_negative
  CHECK (usage_count >= 0);

-- proxies table
ALTER TABLE proxies
  ADD CONSTRAINT check_response_time_non_negative
  CHECK (response_time_ms IS NULL OR response_time_ms >= 0);

-- ============================================================================
-- 2. Add trigger to clean up orphaned template references
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_template_refs()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove deleted template from loops.template_ids
  UPDATE loops
  SET template_ids = array_remove(template_ids, OLD.id::text::uuid)
  WHERE template_ids @> ARRAY[OLD.id];

  -- Disable auto engagement rules that reference deleted template
  UPDATE auto_engagement_rules
  SET is_active = false,
      error_message = CONCAT('Reply template "', OLD.template_name, '" was deleted on ', NOW()::date)
  WHERE reply_template_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_cleanup_template_refs ON templates;

CREATE TRIGGER trg_cleanup_template_refs
BEFORE DELETE ON templates
FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_template_refs();

-- ============================================================================
-- 3. Add trigger to prevent deletion of templates in use
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_template_deletion_if_in_use()
RETURNS TRIGGER AS $$
DECLARE
  v_loop_count INTEGER;
  v_rule_count INTEGER;
BEGIN
  -- Check if template is used in active loops
  SELECT COUNT(*) INTO v_loop_count
  FROM loops
  WHERE is_active = true
    AND template_ids @> ARRAY[OLD.id];

  -- Check if template is used in active engagement rules
  SELECT COUNT(*) INTO v_rule_count
  FROM auto_engagement_rules
  WHERE is_active = true
    AND reply_template_id = OLD.id;

  IF v_loop_count > 0 OR v_rule_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete template "%" as it is currently used by % active loop(s) and % active engagement rule(s). Please deactivate them first.',
      OLD.template_name, v_loop_count, v_rule_count;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_prevent_template_deletion ON templates;

CREATE TRIGGER trg_prevent_template_deletion
BEFORE DELETE ON templates
FOR EACH ROW EXECUTE FUNCTION prevent_template_deletion_if_in_use();

-- ============================================================================
-- 4. Add function to find and report orphaned records
-- ============================================================================

CREATE OR REPLACE FUNCTION find_orphaned_records()
RETURNS TABLE(
  table_name TEXT,
  record_id UUID,
  issue TEXT
) AS $$
BEGIN
  -- Find account_tokens with invalid account_ids
  RETURN QUERY
  SELECT
    'account_tokens'::TEXT,
    at.id,
    'account_id does not exist in any account table'::TEXT
  FROM account_tokens at
  WHERE at.account_type = 'main'
    AND NOT EXISTS (SELECT 1 FROM main_accounts WHERE id = at.account_id)
  UNION ALL
  SELECT
    'account_tokens'::TEXT,
    at.id,
    'account_id does not exist in any account table'::TEXT
  FROM account_tokens at
  WHERE at.account_type = 'follow'
    AND NOT EXISTS (SELECT 1 FROM follow_accounts WHERE id = at.account_id)
  UNION ALL
  SELECT
    'account_tokens'::TEXT,
    at.id,
    'account_id does not exist in any account table'::TEXT
  FROM account_tokens at
  WHERE at.account_type = 'spam'
    AND NOT EXISTS (SELECT 1 FROM spam_accounts WHERE id = at.account_id);

  -- Find spam_accounts with invalid proxy_id
  RETURN QUERY
  SELECT
    'spam_accounts'::TEXT,
    sa.id,
    'proxy_id does not exist'::TEXT
  FROM spam_accounts sa
  WHERE sa.proxy_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM proxies WHERE id = sa.proxy_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Add rate limit pre-check function
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit_before_request(
  p_user_id UUID,
  p_endpoint TEXT,
  p_token_type TEXT DEFAULT 'oauth2'
)
RETURNS TABLE(
  can_proceed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  wait_seconds INTEGER
) AS $$
DECLARE
  v_rate_limit RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get latest rate limit info for this endpoint
  SELECT * INTO v_rate_limit
  FROM rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND token_type = p_token_type
  ORDER BY window_started_at DESC
  LIMIT 1;

  -- If no rate limit record exists, allow request
  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE, 9999, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  -- Check if rate limit has reset
  IF v_rate_limit.reset_at <= v_now THEN
    RETURN QUERY SELECT TRUE, v_rate_limit.limit_total, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  -- Check if rate limit is exceeded
  IF v_rate_limit.remaining <= 0 THEN
    RETURN QUERY SELECT
      FALSE,
      0,
      v_rate_limit.reset_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_rate_limit.reset_at - v_now))::INTEGER);
    RETURN;
  END IF;

  -- Check if rate limit is low (less than 10% remaining)
  IF v_rate_limit.remaining::FLOAT / v_rate_limit.limit_total < 0.1 THEN
    -- Log warning
    RAISE NOTICE 'Rate limit for % is low: % remaining out of %',
      p_endpoint, v_rate_limit.remaining, v_rate_limit.limit_total;
  END IF;

  -- Allow request
  RETURN QUERY SELECT TRUE, v_rate_limit.remaining, v_rate_limit.reset_at, 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Add index for rate limit checks (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint
  ON rate_limits(user_id, endpoint, token_type, window_started_at DESC);

-- ============================================================================
-- 7. Comments
-- ============================================================================

COMMENT ON FUNCTION cleanup_orphaned_template_refs() IS 'Automatically clean up references to deleted templates';
COMMENT ON FUNCTION prevent_template_deletion_if_in_use() IS 'Prevent deletion of templates that are actively used';
COMMENT ON FUNCTION find_orphaned_records() IS 'Find orphaned records across all tables for maintenance';
COMMENT ON FUNCTION check_rate_limit_before_request(UUID, TEXT, TEXT) IS 'Check if request can proceed based on rate limits';
