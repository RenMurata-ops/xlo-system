-- XLO System - Proxy Auto-Assignment Functions
-- Created: 2025-11-17
-- Purpose: Automatic proxy assignment with round-robin and random strategies

-- ============================================================================
-- Step 1: Add missing columns to proxies table
-- ============================================================================

-- Add proxy_name column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS proxy_name TEXT;

-- Add host column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS host TEXT;

-- Add port column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS port INTEGER;

-- Add failure_count column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

-- Add last_used_at column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Add assigned_accounts_count column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS assigned_accounts_count INTEGER DEFAULT 0;

-- Add notes column if not exists
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- Function: get_available_proxy
-- Purpose: Get an available proxy based on strategy (round_robin or random)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_proxy(
  p_user_id UUID,
  p_strategy TEXT DEFAULT 'round_robin'
)
RETURNS proxies AS $$
DECLARE
  v_proxy proxies;
BEGIN
  -- Round-robin strategy: select least recently used proxy
  IF p_strategy = 'round_robin' THEN
    SELECT * INTO v_proxy
    FROM proxies
    WHERE user_id = p_user_id
      AND is_active = true
      AND (failure_count < 10 OR failure_count IS NULL)
    ORDER BY last_used_at ASC NULLS FIRST
    LIMIT 1;

    -- Update last_used_at timestamp
    IF v_proxy.id IS NOT NULL THEN
      UPDATE proxies
      SET last_used_at = NOW()
      WHERE id = v_proxy.id;
    END IF;

  -- Random strategy: select random proxy
  ELSIF p_strategy = 'random' THEN
    SELECT * INTO v_proxy
    FROM proxies
    WHERE user_id = p_user_id
      AND is_active = true
      AND (failure_count < 10 OR failure_count IS NULL)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Update last_used_at timestamp
    IF v_proxy.id IS NOT NULL THEN
      UPDATE proxies
      SET last_used_at = NOW()
      WHERE id = v_proxy.id;
    END IF;
  END IF;

  RETURN v_proxy;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: assign_proxy_to_account
-- Purpose: Automatically assign a proxy to an account
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_proxy_to_account(
  p_account_id UUID,
  p_account_table TEXT,
  p_user_id UUID,
  p_strategy TEXT DEFAULT 'round_robin'
)
RETURNS UUID AS $$
DECLARE
  v_proxy proxies;
  v_proxy_id UUID;
BEGIN
  -- Get available proxy
  SELECT * INTO v_proxy FROM get_available_proxy(p_user_id, p_strategy);

  IF v_proxy.id IS NULL THEN
    RAISE EXCEPTION 'No available proxies found for user %', p_user_id;
  END IF;

  v_proxy_id := v_proxy.id;

  -- Update account with proxy_id based on table type
  IF p_account_table = 'spam_accounts' THEN
    UPDATE spam_accounts
    SET proxy_id = v_proxy_id
    WHERE id = p_account_id AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid account table: % (only spam_accounts supported)', p_account_table;
  END IF;

  RETURN v_proxy_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: bulk_assign_proxies
-- Purpose: Assign proxies to multiple accounts at once
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_assign_proxies(
  p_account_ids UUID[],
  p_account_table TEXT,
  p_user_id UUID,
  p_strategy TEXT DEFAULT 'round_robin'
)
RETURNS TABLE(account_id UUID, proxy_id UUID, success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_account_id UUID;
  v_proxy_id UUID;
BEGIN
  FOREACH v_account_id IN ARRAY p_account_ids
  LOOP
    BEGIN
      -- Assign proxy to account
      v_proxy_id := assign_proxy_to_account(v_account_id, p_account_table, p_user_id, p_strategy);

      -- Return success
      RETURN QUERY SELECT v_account_id, v_proxy_id, true, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Return error
      RETURN QUERY SELECT v_account_id, NULL::UUID, false, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_proxy_health_stats
-- Purpose: Get health statistics for all proxies
-- ============================================================================

CREATE OR REPLACE FUNCTION get_proxy_health_stats(p_user_id UUID)
RETURNS TABLE(
  total_proxies BIGINT,
  active_proxies BIGINT,
  healthy_proxies BIGINT,
  unhealthy_proxies BIGINT,
  avg_failure_count NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_proxies,
    COUNT(*) FILTER (WHERE is_active = true) as active_proxies,
    COUNT(*) FILTER (WHERE is_active = true AND (failure_count < 10 OR failure_count IS NULL)) as healthy_proxies,
    COUNT(*) FILTER (WHERE failure_count >= 10) as unhealthy_proxies,
    AVG(COALESCE(failure_count, 0))::NUMERIC as avg_failure_count
  FROM proxies
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- View: v_proxy_assignment_status
-- Purpose: View proxy assignment status for accounts
-- ============================================================================

CREATE OR REPLACE VIEW v_proxy_assignment_status AS
SELECT
  'spam' as account_type,
  sa.id as account_id,
  sa.handle as account_handle,
  sa.proxy_id,
  p.host as proxy_host,
  p.port as proxy_port,
  p.country as proxy_country,
  p.is_active as proxy_is_active,
  p.failure_count as proxy_failure_count,
  p.last_used_at as proxy_last_used
FROM spam_accounts sa
LEFT JOIN proxies p ON sa.proxy_id = p.id;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION get_available_proxy IS 'Returns an available proxy based on strategy (round_robin or random)';
COMMENT ON FUNCTION assign_proxy_to_account IS 'Automatically assigns a proxy to an account';
COMMENT ON FUNCTION bulk_assign_proxies IS 'Assigns proxies to multiple accounts at once';
COMMENT ON FUNCTION get_proxy_health_stats IS 'Returns health statistics for all proxies';
COMMENT ON VIEW v_proxy_assignment_status IS 'Shows proxy assignment status for all accounts';
