-- Enhance account tracking for mass operation safety
-- Add health monitoring, rate limit tracking, and suspension logic

-- ============================================================================
-- Add health tracking columns to accounts
-- ============================================================================

-- Main Accounts
ALTER TABLE main_accounts
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS daily_request_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_request_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN main_accounts.health_score IS 'Account health score (0-100), decreases with errors';
COMMENT ON COLUMN main_accounts.consecutive_errors IS 'Consecutive errors, triggers auto-suspension at 5';
COMMENT ON COLUMN main_accounts.daily_request_count IS 'Daily API request counter for rate limiting';

-- Spam Accounts
ALTER TABLE spam_accounts
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS daily_request_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_request_reset_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS proxy_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_proxy_failure_at TIMESTAMPTZ;

COMMENT ON COLUMN spam_accounts.health_score IS 'Account health score (0-100), decreases with errors';
COMMENT ON COLUMN spam_accounts.consecutive_errors IS 'Consecutive errors, triggers auto-suspension at 5';
COMMENT ON COLUMN spam_accounts.daily_request_count IS 'Daily API request counter for rate limiting';
COMMENT ON COLUMN spam_accounts.proxy_failures IS 'Proxy failure counter';

-- ============================================================================
-- Account Request Log for detailed rate tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_request_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'spam')),

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,

  -- Rate limit info
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMPTZ,

  -- Timing
  request_duration_ms INTEGER,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Error tracking
  error_message TEXT,
  is_rate_limited BOOLEAN DEFAULT FALSE,
  is_error BOOLEAN DEFAULT FALSE,

  -- Proxy info (for future use)
  proxy_id UUID REFERENCES proxies(id),
  proxy_used BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_request_log_user ON account_request_log(user_id, requested_at DESC);
CREATE INDEX idx_account_request_log_account ON account_request_log(account_id, requested_at DESC);
CREATE INDEX idx_account_request_log_endpoint ON account_request_log(endpoint, requested_at DESC);
CREATE INDEX idx_account_request_log_errors ON account_request_log(is_error, requested_at DESC) WHERE is_error = TRUE;

ALTER TABLE account_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own request logs"
  ON account_request_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own request logs"
  ON account_request_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Functions for account health management
-- ============================================================================

-- Function to record successful request
CREATE OR REPLACE FUNCTION record_account_success(
  p_account_id UUID,
  p_account_type TEXT
)
RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
BEGIN
  -- Determine table name
  v_table_name := CASE p_account_type
    WHEN 'main' THEN 'main_accounts'
    WHEN 'spam' THEN 'spam_accounts'
    ELSE NULL
  END;

  IF v_table_name IS NULL THEN
    RETURN;
  END IF;

  -- Update account health
  EXECUTE format('
    UPDATE %I
    SET
      consecutive_errors = 0,
      health_score = LEAST(100, health_score + 2),
      last_activity_at = NOW(),
      daily_request_count = daily_request_count + 1,
      updated_at = NOW()
    WHERE id = $1
  ', v_table_name)
  USING p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record failed request
CREATE OR REPLACE FUNCTION record_account_error(
  p_account_id UUID,
  p_account_type TEXT,
  p_error_message TEXT
)
RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
  v_consecutive_errors INTEGER;
BEGIN
  -- Determine table name
  v_table_name := CASE p_account_type
    WHEN 'main' THEN 'main_accounts'
    WHEN 'spam' THEN 'spam_accounts'
    ELSE NULL
  END;

  IF v_table_name IS NULL THEN
    RETURN;
  END IF;

  -- Update account health and error counters
  EXECUTE format('
    UPDATE %I
    SET
      consecutive_errors = consecutive_errors + 1,
      error_count = error_count + 1,
      health_score = GREATEST(0, health_score - 10),
      last_error_at = NOW(),
      daily_request_count = daily_request_count + 1,
      updated_at = NOW()
    WHERE id = $1
    RETURNING consecutive_errors
  ', v_table_name)
  USING p_account_id
  INTO v_consecutive_errors;

  -- Auto-suspend if too many consecutive errors
  IF v_consecutive_errors >= 5 THEN
    EXECUTE format('
      UPDATE %I
      SET
        is_active = FALSE,
        auto_suspended_at = NOW(),
        suspension_reason = $1
      WHERE id = $2
    ', v_table_name)
    USING 'Auto-suspended: ' || v_consecutive_errors || ' consecutive errors - ' || p_error_message,
          p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily counters
CREATE OR REPLACE FUNCTION reset_daily_request_counters()
RETURNS VOID AS $$
BEGIN
  -- Reset main accounts
  UPDATE main_accounts
  SET
    daily_request_count = 0,
    daily_request_reset_at = NOW()
  WHERE daily_request_reset_at < NOW() - INTERVAL '24 hours';

  -- Reset spam accounts
  UPDATE spam_accounts
  SET
    daily_request_count = 0,
    daily_request_reset_at = NOW()
  WHERE daily_request_reset_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to check if account can make request (rate limiting)
-- ============================================================================
CREATE OR REPLACE FUNCTION can_account_make_request(
  p_account_id UUID,
  p_account_type TEXT,
  p_max_daily_requests INTEGER DEFAULT 1000
)
RETURNS BOOLEAN AS $$
DECLARE
  v_table_name TEXT;
  v_is_active BOOLEAN;
  v_daily_count INTEGER;
  v_health_score INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Determine table name
  v_table_name := CASE p_account_type
    WHEN 'main' THEN 'main_accounts'
    WHEN 'spam' THEN 'spam_accounts'
    ELSE NULL
  END;

  IF v_table_name IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get account status
  EXECUTE format('
    SELECT is_active, daily_request_count, health_score, daily_request_reset_at
    FROM %I
    WHERE id = $1
  ', v_table_name)
  USING p_account_id
  INTO v_is_active, v_daily_count, v_health_score, v_reset_at;

  -- Check if needs daily reset
  IF v_reset_at < NOW() - INTERVAL '24 hours' THEN
    EXECUTE format('
      UPDATE %I
      SET
        daily_request_count = 0,
        daily_request_reset_at = NOW()
      WHERE id = $1
    ', v_table_name)
    USING p_account_id;
    v_daily_count := 0;
  END IF;

  -- Check conditions
  IF NOT v_is_active THEN
    RETURN FALSE;
  END IF;

  IF v_health_score < 20 THEN
    RETURN FALSE;
  END IF;

  IF v_daily_count >= p_max_daily_requests THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Cron job setup hint (run manually in Supabase Dashboard)
-- ============================================================================
-- SELECT cron.schedule(
--   'reset-daily-counters',
--   '0 0 * * *',  -- Daily at midnight
--   $$ SELECT reset_daily_request_counters(); $$
-- );
