-- Migration: Scale to 500 Accounts with NordVPN Integration
-- Purpose: Enable simultaneous operation of up to 500 accounts with NordVPN proxy support

-- ============================================================================
-- 1. Extend Proxies Table for NordVPN Integration
-- ============================================================================

-- Add NordVPN specific columns
ALTER TABLE proxies
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'manual' CHECK (provider_type IN ('manual', 'nordvpn', 'other')),
ADD COLUMN IF NOT EXISTS nordvpn_server TEXT,
ADD COLUMN IF NOT EXISTS nordvpn_country TEXT,
ADD COLUMN IF NOT EXISTS nordvpn_city TEXT,
ADD COLUMN IF NOT EXISTS nordvpn_username TEXT,
ADD COLUMN IF NOT EXISTS nordvpn_password TEXT,
ADD COLUMN IF NOT EXISTS max_accounts INTEGER DEFAULT 10 CHECK (max_accounts > 0),
ADD COLUMN IF NOT EXISTS current_accounts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown'));

-- Add comment
COMMENT ON COLUMN proxies.provider_type IS 'Proxy provider type: manual (user-configured), nordvpn (NordVPN integration), other';
COMMENT ON COLUMN proxies.max_accounts IS 'Maximum number of accounts that can use this proxy';
COMMENT ON COLUMN proxies.current_accounts IS 'Current number of accounts assigned to this proxy';

-- ============================================================================
-- 2. Add Proxy Assignment to Account Tables
-- ============================================================================

-- Add proxy_id to main_accounts
ALTER TABLE main_accounts
ADD COLUMN IF NOT EXISTS proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL;

-- Add proxy_id to spam_accounts
ALTER TABLE spam_accounts
ADD COLUMN IF NOT EXISTS proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL;

-- Add indexes for proxy lookups
CREATE INDEX IF NOT EXISTS idx_main_accounts_proxy ON main_accounts(proxy_id) WHERE proxy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spam_accounts_proxy ON spam_accounts(proxy_id) WHERE proxy_id IS NOT NULL;

-- ============================================================================
-- 3. Performance Optimization Indexes for 500-Account Scale
-- ============================================================================

-- Health-based account selection (critical for mass operations)
CREATE INDEX IF NOT EXISTS idx_main_accounts_health_active
ON main_accounts(health_score DESC, is_active)
WHERE is_active = TRUE AND health_score >= 20;

CREATE INDEX IF NOT EXISTS idx_spam_accounts_health_active
ON spam_accounts(health_score DESC, is_active)
WHERE is_active = TRUE AND health_score >= 20;

-- Daily request count tracking (for rate limiting)
CREATE INDEX IF NOT EXISTS idx_main_accounts_daily_requests
ON main_accounts(daily_request_count, is_active)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_spam_accounts_daily_requests
ON spam_accounts(daily_request_count, is_active)
WHERE is_active = TRUE;

-- Request log optimization (for monitoring and analytics)
CREATE INDEX IF NOT EXISTS idx_account_request_log_account_time
ON account_request_log(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_request_log_daily_stats
ON account_request_log(account_id, DATE(created_at), is_error);

CREATE INDEX IF NOT EXISTS idx_account_request_log_user_time
ON account_request_log(user_id, created_at DESC);

-- Proxy usage tracking
CREATE INDEX IF NOT EXISTS idx_account_request_log_proxy
ON account_request_log(proxy_id, created_at DESC)
WHERE proxy_id IS NOT NULL;

-- Account tokens optimization
CREATE INDEX IF NOT EXISTS idx_account_tokens_expiry
ON account_tokens(expires_at)
WHERE is_valid = TRUE;

-- ============================================================================
-- 4. Update Rate Limiting Functions for 500-Account Scale
-- ============================================================================

-- Drop and recreate with higher limits
DROP FUNCTION IF EXISTS can_account_make_request(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION can_account_make_request(
  p_account_id UUID,
  p_account_type TEXT,
  p_max_daily_requests INTEGER DEFAULT 5000
)
RETURNS BOOLEAN AS $$
DECLARE
  v_table_name TEXT;
  v_is_active BOOLEAN;
  v_daily_count INTEGER;
  v_health_score INTEGER;
  v_auto_suspended_at TIMESTAMPTZ;
BEGIN
  -- Determine table name
  IF p_account_type = 'main' THEN
    v_table_name := 'main_accounts';
  ELSIF p_account_type = 'spam' THEN
    v_table_name := 'spam_accounts';
  ELSE
    RAISE EXCEPTION 'Invalid account type: %', p_account_type;
  END IF;

  -- Get account status
  EXECUTE format('
    SELECT is_active, daily_request_count, health_score, auto_suspended_at
    FROM %I
    WHERE id = $1
  ', v_table_name)
  USING p_account_id
  INTO v_is_active, v_daily_count, v_health_score, v_auto_suspended_at;

  -- Check if account exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check conditions
  IF NOT v_is_active THEN RETURN FALSE; END IF;
  IF v_auto_suspended_at IS NOT NULL THEN RETURN FALSE; END IF;
  IF v_health_score < 20 THEN RETURN FALSE; END IF;
  IF v_daily_count >= p_max_daily_requests THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Proxy Management Functions
-- ============================================================================

-- Function to assign proxy to account automatically
CREATE OR REPLACE FUNCTION assign_proxy_to_account(
  p_account_id UUID,
  p_account_type TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_proxy_id UUID;
  v_table_name TEXT;
BEGIN
  -- Determine table name
  IF p_account_type = 'main' THEN
    v_table_name := 'main_accounts';
  ELSIF p_account_type = 'spam' THEN
    v_table_name := 'spam_accounts';
  ELSE
    RAISE EXCEPTION 'Invalid account type: %', p_account_type;
  END IF;

  -- Find best available proxy (least loaded, healthy)
  SELECT id INTO v_proxy_id
  FROM proxies
  WHERE user_id = p_user_id
    AND is_active = TRUE
    AND (health_status = 'healthy' OR health_status = 'unknown')
    AND current_accounts < max_accounts
  ORDER BY
    CASE health_status
      WHEN 'healthy' THEN 1
      WHEN 'unknown' THEN 2
      WHEN 'degraded' THEN 3
      ELSE 4
    END,
    current_accounts ASC,
    last_used_at ASC NULLS FIRST
  LIMIT 1;

  -- If no proxy found, return NULL
  IF v_proxy_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign proxy to account
  EXECUTE format('
    UPDATE %I
    SET proxy_id = $1
    WHERE id = $2
  ', v_table_name)
  USING v_proxy_id, p_account_id;

  -- Update proxy current_accounts count
  UPDATE proxies
  SET
    current_accounts = (
      SELECT COUNT(*)
      FROM (
        SELECT proxy_id FROM main_accounts WHERE proxy_id = v_proxy_id
        UNION ALL
        SELECT proxy_id FROM spam_accounts WHERE proxy_id = v_proxy_id
      ) AS combined
    ),
    last_used_at = NOW()
  WHERE id = v_proxy_id;

  RETURN v_proxy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unassign proxy from account
CREATE OR REPLACE FUNCTION unassign_proxy_from_account(
  p_account_id UUID,
  p_account_type TEXT
)
RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
  v_old_proxy_id UUID;
BEGIN
  -- Determine table name
  IF p_account_type = 'main' THEN
    v_table_name := 'main_accounts';
  ELSIF p_account_type = 'spam' THEN
    v_table_name := 'spam_accounts';
  ELSE
    RAISE EXCEPTION 'Invalid account type: %', p_account_type;
  END IF;

  -- Get current proxy_id
  EXECUTE format('
    SELECT proxy_id FROM %I WHERE id = $1
  ', v_table_name)
  USING p_account_id
  INTO v_old_proxy_id;

  -- Unassign proxy
  EXECUTE format('
    UPDATE %I
    SET proxy_id = NULL
    WHERE id = $1
  ', v_table_name)
  USING p_account_id;

  -- Update proxy current_accounts count
  IF v_old_proxy_id IS NOT NULL THEN
    UPDATE proxies
    SET current_accounts = (
      SELECT COUNT(*)
      FROM (
        SELECT proxy_id FROM main_accounts WHERE proxy_id = v_old_proxy_id
        UNION ALL
        SELECT proxy_id FROM spam_accounts WHERE proxy_id = v_old_proxy_id
      ) AS combined
    )
    WHERE id = v_old_proxy_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rebalance proxies across accounts
CREATE OR REPLACE FUNCTION rebalance_proxy_assignments(
  p_user_id UUID
)
RETURNS TABLE(
  account_id UUID,
  account_type TEXT,
  old_proxy_id UUID,
  new_proxy_id UUID
) AS $$
DECLARE
  v_account RECORD;
BEGIN
  -- Iterate through all accounts without proxies
  FOR v_account IN
    SELECT id, 'main' AS type FROM main_accounts WHERE user_id = p_user_id AND proxy_id IS NULL AND is_active = TRUE
    UNION ALL
    SELECT id, 'spam' AS type FROM spam_accounts WHERE user_id = p_user_id AND proxy_id IS NULL AND is_active = TRUE
  LOOP
    -- Try to assign proxy
    SELECT v_account.id, v_account.type, NULL, assign_proxy_to_account(v_account.id, v_account.type, p_user_id)
    INTO account_id, account_type, old_proxy_id, new_proxy_id;

    IF new_proxy_id IS NOT NULL THEN
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Mass Operation Analytics Functions
-- ============================================================================

-- Function to get account health summary
CREATE OR REPLACE FUNCTION get_account_health_summary(
  p_user_id UUID
)
RETURNS TABLE(
  total_accounts BIGINT,
  healthy_accounts BIGINT,
  degraded_accounts BIGINT,
  suspended_accounts BIGINT,
  avg_health_score NUMERIC,
  total_requests_today BIGINT,
  total_errors_today BIGINT,
  accounts_near_limit BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH combined_accounts AS (
    SELECT
      id,
      health_score,
      is_active,
      auto_suspended_at,
      daily_request_count,
      'main' AS account_type,
      5000 AS max_daily_requests
    FROM main_accounts
    WHERE user_id = p_user_id
    UNION ALL
    SELECT
      id,
      health_score,
      is_active,
      auto_suspended_at,
      daily_request_count,
      'spam' AS account_type,
      3000 AS max_daily_requests
    FROM spam_accounts
    WHERE user_id = p_user_id
  ),
  request_stats AS (
    SELECT
      COUNT(*) AS total_requests,
      SUM(CASE WHEN is_error THEN 1 ELSE 0 END) AS total_errors
    FROM account_request_log
    WHERE user_id = p_user_id
      AND created_at >= CURRENT_DATE
  )
  SELECT
    COUNT(*)::BIGINT AS total_accounts,
    COUNT(*) FILTER (WHERE health_score >= 70 AND is_active AND auto_suspended_at IS NULL)::BIGINT AS healthy_accounts,
    COUNT(*) FILTER (WHERE health_score >= 20 AND health_score < 70 AND is_active AND auto_suspended_at IS NULL)::BIGINT AS degraded_accounts,
    COUNT(*) FILTER (WHERE auto_suspended_at IS NOT NULL OR NOT is_active OR health_score < 20)::BIGINT AS suspended_accounts,
    COALESCE(AVG(health_score), 0)::NUMERIC AS avg_health_score,
    COALESCE((SELECT total_requests FROM request_stats), 0)::BIGINT AS total_requests_today,
    COALESCE((SELECT total_errors FROM request_stats), 0)::BIGINT AS total_errors_today,
    COUNT(*) FILTER (WHERE daily_request_count >= max_daily_requests * 0.8)::BIGINT AS accounts_near_limit
  FROM combined_accounts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get proxy usage summary
CREATE OR REPLACE FUNCTION get_proxy_usage_summary(
  p_user_id UUID
)
RETURNS TABLE(
  proxy_id UUID,
  proxy_name TEXT,
  provider_type TEXT,
  nordvpn_server TEXT,
  nordvpn_country TEXT,
  current_accounts INTEGER,
  max_accounts INTEGER,
  utilization_percent NUMERIC,
  health_status TEXT,
  requests_today BIGINT,
  errors_today BIGINT,
  error_rate_percent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.provider_type,
    p.nordvpn_server,
    p.nordvpn_country,
    p.current_accounts,
    p.max_accounts,
    ROUND((p.current_accounts::NUMERIC / NULLIF(p.max_accounts, 0)) * 100, 2) AS utilization_percent,
    p.health_status,
    COALESCE(COUNT(arl.id) FILTER (WHERE arl.created_at >= CURRENT_DATE), 0)::BIGINT AS requests_today,
    COALESCE(COUNT(arl.id) FILTER (WHERE arl.created_at >= CURRENT_DATE AND arl.is_error), 0)::BIGINT AS errors_today,
    CASE
      WHEN COUNT(arl.id) FILTER (WHERE arl.created_at >= CURRENT_DATE) > 0 THEN
        ROUND((COUNT(arl.id) FILTER (WHERE arl.created_at >= CURRENT_DATE AND arl.is_error)::NUMERIC /
               COUNT(arl.id) FILTER (WHERE arl.created_at >= CURRENT_DATE)) * 100, 2)
      ELSE 0
    END AS error_rate_percent
  FROM proxies p
  LEFT JOIN account_request_log arl ON arl.proxy_id = p.id
  WHERE p.user_id = p_user_id
  GROUP BY p.id, p.name, p.provider_type, p.nordvpn_server, p.nordvpn_country,
           p.current_accounts, p.max_accounts, p.health_status
  ORDER BY p.current_accounts DESC, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Add RLS Policies for New Columns
-- ============================================================================

-- Policies already exist for proxies table from previous migration
-- No additional policies needed as new columns are part of existing table

-- ============================================================================
-- 8. Update Current Proxy Counts
-- ============================================================================

-- Recalculate current_accounts for all proxies
UPDATE proxies p
SET current_accounts = (
  SELECT COUNT(*)
  FROM (
    SELECT proxy_id FROM main_accounts WHERE proxy_id = p.id
    UNION ALL
    SELECT proxy_id FROM spam_accounts WHERE proxy_id = p.id
  ) AS combined
);

-- Add comment for migration
COMMENT ON TABLE proxies IS 'Proxy configurations including NordVPN integration for 500-account scale operation';
