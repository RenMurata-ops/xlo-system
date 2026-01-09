-- ============================================================================
-- XLO System Database Enhancements
-- Comprehensive database improvements for better performance and functionality
-- ============================================================================

-- ============================================================================
-- 1. Missing Foreign Key Constraints
-- ============================================================================

-- Add foreign key for spam_accounts.proxy_id
ALTER TABLE spam_accounts
DROP CONSTRAINT IF EXISTS spam_accounts_proxy_id_fkey;

ALTER TABLE spam_accounts
ADD CONSTRAINT spam_accounts_proxy_id_fkey
FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE SET NULL;

-- Add last_used_at to proxies for round-robin
ALTER TABLE proxies
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Execution Logs Table - Comprehensive logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What was executed
  execution_type TEXT NOT NULL CHECK (execution_type IN (
    'post', 'engagement', 'loop', 'cta', 'unfollow', 'token_refresh'
  )),
  rule_id UUID, -- Reference to the rule/loop/trigger that was executed

  -- Which accounts were involved
  account_ids UUID[],
  account_type TEXT,

  -- Results
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
  items_processed INTEGER DEFAULT 0,
  items_succeeded INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,

  -- Details
  target_data JSONB DEFAULT '{}'::jsonb, -- Tweet IDs, user IDs, etc.
  result_data JSONB DEFAULT '{}'::jsonb, -- Response data
  error_message TEXT,
  error_details JSONB,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Metadata
  ip_address TEXT,
  proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_user_id ON execution_logs(user_id);
CREATE INDEX idx_execution_logs_type ON execution_logs(execution_type);
CREATE INDEX idx_execution_logs_status ON execution_logs(status);
CREATE INDEX idx_execution_logs_created_at ON execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_rule_id ON execution_logs(rule_id) WHERE rule_id IS NOT NULL;

ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own execution logs"
ON execution_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert execution logs"
ON execution_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. System Settings Table - User preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- General Settings
  timezone TEXT DEFAULT 'Asia/Tokyo',
  language TEXT DEFAULT 'ja',

  -- Notification Settings
  email_notifications BOOLEAN DEFAULT true,
  notification_on_error BOOLEAN DEFAULT true,
  notification_on_completion BOOLEAN DEFAULT false,

  -- Rate Limiting
  global_rate_limit_per_hour INTEGER DEFAULT 100,
  concurrent_operations INTEGER DEFAULT 3,

  -- Default Values
  default_post_interval_hours INTEGER DEFAULT 1,
  default_engagement_delay_minutes INTEGER DEFAULT 5,
  default_unfollow_delay_weeks INTEGER DEFAULT 2,

  -- Auto Features
  auto_refresh_tokens BOOLEAN DEFAULT true,
  auto_retry_failed BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
ON user_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Daily Statistics Table - Track daily metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Post Stats
  posts_scheduled INTEGER DEFAULT 0,
  posts_sent INTEGER DEFAULT 0,
  posts_failed INTEGER DEFAULT 0,

  -- Engagement Stats
  likes_given INTEGER DEFAULT 0,
  replies_sent INTEGER DEFAULT 0,
  follows_made INTEGER DEFAULT 0,
  unfollows_made INTEGER DEFAULT 0,
  retweets_made INTEGER DEFAULT 0,

  -- Engagement Received
  likes_received INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  follows_received INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,

  -- Error Stats
  api_errors INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, stat_date)
);

CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, stat_date DESC);

ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily stats"
ON daily_stats FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own daily stats"
ON daily_stats FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own daily stats"
ON daily_stats FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- 5. Useful Views
-- ============================================================================

-- Account Overview with token status
CREATE OR REPLACE VIEW v_account_overview AS
SELECT
  ma.id,
  ma.user_id,
  'main' as account_type,
  ma.account_handle as handle,
  ma.account_name as name,
  ma.follower_count,
  ma.following_count,
  ma.is_active,
  ma.tags,
  at.access_token IS NOT NULL as has_token,
  at.expires_at,
  CASE
    WHEN at.expires_at IS NULL THEN false
    WHEN at.expires_at < NOW() THEN true
    ELSE false
  END as token_expired,
  ma.created_at
FROM main_accounts ma
LEFT JOIN account_tokens at ON at.account_id = ma.id AND at.account_type = 'main'

UNION ALL

SELECT
  fa.id,
  fa.user_id,
  'follow' as account_type,
  fa.target_handle as handle,
  fa.target_name as name,
  fa.followers_count as follower_count,
  0 as following_count,
  fa.is_active,
  fa.tags,
  at.access_token IS NOT NULL as has_token,
  at.expires_at,
  CASE
    WHEN at.expires_at IS NULL THEN false
    WHEN at.expires_at < NOW() THEN true
    ELSE false
  END as token_expired,
  fa.created_at
FROM follow_accounts fa
LEFT JOIN account_tokens at ON at.account_id = fa.id AND at.account_type = 'follow'

UNION ALL

SELECT
  sa.id,
  sa.user_id,
  'spam' as account_type,
  sa.account_handle as handle,
  sa.account_name as name,
  0 as follower_count,
  0 as following_count,
  sa.is_active,
  sa.tags,
  at.access_token IS NOT NULL as has_token,
  at.expires_at,
  CASE
    WHEN at.expires_at IS NULL THEN false
    WHEN at.expires_at < NOW() THEN true
    ELSE false
  END as token_expired,
  sa.created_at
FROM spam_accounts sa
LEFT JOIN account_tokens at ON at.account_id = sa.id AND at.account_type = 'spam';

-- Post Performance View
CREATE OR REPLACE VIEW v_post_performance AS
SELECT
  p.id,
  p.user_id,
  p.content,
  p.status,
  p.posted_at,
  p.like_count,
  p.retweet_count,
  p.reply_count,
  p.quote_count,
  p.impression_count,
  COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) +
  COALESCE(p.reply_count, 0) + COALESCE(p.quote_count, 0) as total_engagement,
  CASE
    WHEN p.impression_count > 0
    THEN ROUND(
      ((COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) +
        COALESCE(p.reply_count, 0) + COALESCE(p.quote_count, 0))::NUMERIC /
       p.impression_count) * 100, 2
    )
    ELSE 0
  END as engagement_rate,
  ma.account_handle,
  p.tags
FROM posts p
LEFT JOIN main_accounts ma ON ma.id = p.account_id
WHERE p.status = 'posted';

-- Dashboard Summary View
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  u.id as user_id,
  -- Account counts
  (SELECT COUNT(*) FROM main_accounts WHERE user_id = u.id AND is_active = true) as active_main_accounts,
  (SELECT COUNT(*) FROM follow_accounts WHERE user_id = u.id AND is_active = true) as active_follow_accounts,
  (SELECT COUNT(*) FROM spam_accounts WHERE user_id = u.id AND is_active = true) as active_spam_accounts,
  -- Post stats
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'scheduled') as scheduled_posts,
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'posted' AND posted_at >= CURRENT_DATE) as posts_today,
  -- Engagement rules
  (SELECT COUNT(*) FROM auto_engagement_rules WHERE user_id = u.id AND is_active = true) as active_rules,
  (SELECT COUNT(*) FROM loops WHERE user_id = u.id AND is_active = true) as active_loops,
  -- Pending actions
  (SELECT COUNT(*) FROM follow_relationships WHERE user_id = u.id AND status = 'pending') as pending_unfollows,
  (SELECT COUNT(*) FROM cta_executions ce
   JOIN cta_triggers ct ON ct.id = ce.trigger_id
   WHERE ct.user_id = u.id AND ce.status = 'scheduled') as pending_cta
FROM auth.users u;

-- Engagement Rule Performance
CREATE OR REPLACE VIEW v_rule_performance AS
SELECT
  aer.id,
  aer.user_id,
  aer.name as name,
  aer.search_type as search_type,
  aer.action_type,
  aer.is_active,
  aer.total_actions_count as total_actions_count,
  aer.success_count,
  aer.failure_count as failure_count,
  CASE
    WHEN aer.total_actions_count > 0
    THEN ROUND((aer.success_count::NUMERIC / aer.total_actions_count) * 100, 1)
    ELSE 0
  END as success_rate,
  0 as actions_today,
  aer.daily_limit as daily_limit,
  aer.last_execution_at,
  NULL::TIMESTAMPTZ as next_execution_at
FROM auto_engagement_rules aer;

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function to get or create daily stats
CREATE OR REPLACE FUNCTION get_or_create_daily_stats(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_stat_id UUID;
BEGIN
  SELECT id INTO v_stat_id
  FROM daily_stats
  WHERE user_id = p_user_id AND stat_date = CURRENT_DATE;

  IF v_stat_id IS NULL THEN
    INSERT INTO daily_stats (user_id, stat_date)
    VALUES (p_user_id, CURRENT_DATE)
    RETURNING id INTO v_stat_id;
  END IF;

  RETURN v_stat_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment daily stat
CREATE OR REPLACE FUNCTION increment_daily_stat(
  p_user_id UUID,
  p_stat_name TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Ensure stats row exists
  PERFORM get_or_create_daily_stats(p_user_id);

  -- Update the specific stat
  EXECUTE format(
    'UPDATE daily_stats SET %I = %I + $1, updated_at = NOW() WHERE user_id = $2 AND stat_date = CURRENT_DATE',
    p_stat_name, p_stat_name
  ) USING p_increment, p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to select accounts using round-robin
CREATE OR REPLACE FUNCTION select_accounts_round_robin(
  p_user_id UUID,
  p_account_type TEXT,
  p_limit INTEGER DEFAULT 1,
  p_tag_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE(account_id UUID, account_handle TEXT) AS $$
BEGIN
  IF p_account_type = 'main' THEN
    RETURN QUERY
    SELECT ma.id, ma.account_handle
    FROM main_accounts ma
    JOIN account_tokens at ON at.account_id = ma.id AND at.account_type = 'main'
    WHERE ma.user_id = p_user_id
      AND ma.is_active = true
      AND at.access_token IS NOT NULL
      AND (at.expires_at IS NULL OR at.expires_at > NOW())
      AND (p_tag_filter IS NULL OR ma.tags && p_tag_filter)
    ORDER BY ma.updated_at NULLS FIRST, ma.created_at
    LIMIT p_limit;
  ELSIF p_account_type = 'spam' THEN
    RETURN QUERY
    SELECT sa.id, sa.account_handle
    FROM spam_accounts sa
    JOIN account_tokens at ON at.account_id = sa.id AND at.account_type = 'spam'
    WHERE sa.user_id = p_user_id
      AND sa.is_active = true
      AND at.access_token IS NOT NULL
      AND (at.expires_at IS NULL OR at.expires_at > NOW())
      AND (p_tag_filter IS NULL OR sa.tags && p_tag_filter)
    ORDER BY sa.last_used_at NULLS FIRST, sa.created_at
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to build X search query
CREATE OR REPLACE FUNCTION build_x_search_query(
  p_base_query TEXT,
  p_since DATE DEFAULT NULL,
  p_until DATE DEFAULT NULL,
  p_min_retweets INTEGER DEFAULT NULL,
  p_min_faves INTEGER DEFAULT NULL,
  p_min_replies INTEGER DEFAULT NULL,
  p_has_engagement BOOLEAN DEFAULT FALSE,
  p_exclude_keywords TEXT[] DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_query TEXT;
  v_keyword TEXT;
BEGIN
  v_query := p_base_query;

  IF p_since IS NOT NULL THEN
    v_query := v_query || ' since:' || p_since::TEXT;
  END IF;

  IF p_until IS NOT NULL THEN
    v_query := v_query || ' until:' || p_until::TEXT;
  END IF;

  IF p_min_retweets IS NOT NULL AND p_min_retweets > 0 THEN
    v_query := v_query || ' min_retweets:' || p_min_retweets::TEXT;
  END IF;

  IF p_min_faves IS NOT NULL AND p_min_faves > 0 THEN
    v_query := v_query || ' min_faves:' || p_min_faves::TEXT;
  END IF;

  IF p_min_replies IS NOT NULL AND p_min_replies > 0 THEN
    v_query := v_query || ' min_replies:' || p_min_replies::TEXT;
  END IF;

  IF p_has_engagement THEN
    v_query := v_query || ' filter:has_engagement';
  END IF;

  IF p_exclude_keywords IS NOT NULL THEN
    FOREACH v_keyword IN ARRAY p_exclude_keywords LOOP
      v_query := v_query || ' -' || v_keyword;
    END LOOP;
  END IF;

  RETURN v_query;
END;
$$ LANGUAGE plpgsql;

-- Function to log execution
CREATE OR REPLACE FUNCTION log_execution(
  p_user_id UUID,
  p_execution_type TEXT,
  p_status TEXT,
  p_items_processed INTEGER DEFAULT 0,
  p_items_succeeded INTEGER DEFAULT 0,
  p_items_failed INTEGER DEFAULT 0,
  p_rule_id UUID DEFAULT NULL,
  p_account_ids UUID[] DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_target_data JSONB DEFAULT NULL,
  p_result_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO execution_logs (
    user_id, execution_type, status, rule_id, account_ids,
    items_processed, items_succeeded, items_failed,
    error_message, target_data, result_data, completed_at
  ) VALUES (
    p_user_id, p_execution_type, p_status, p_rule_id, p_account_ids,
    p_items_processed, p_items_succeeded, p_items_failed,
    p_error_message, COALESCE(p_target_data, '{}'::jsonb),
    COALESCE(p_result_data, '{}'::jsonb), NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Additional Indexes for Performance
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_user_status_scheduled
ON posts(user_id, status, scheduled_at)
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_account_tokens_account_active
ON account_tokens(account_id, account_type)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_execution_logs_user_type_date
ON execution_logs(user_id, execution_type, created_at DESC);

-- Index for tag searches
CREATE INDEX IF NOT EXISTS idx_follow_accounts_tags ON follow_accounts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_spam_accounts_tags ON spam_accounts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);

-- ============================================================================
-- 8. Triggers for Auto-Updates
-- ============================================================================

-- Update main_accounts last_activity_at when posting
CREATE OR REPLACE FUNCTION update_account_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
    UPDATE main_accounts
    SET last_activity_at = NOW()
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_account_activity ON posts;
CREATE TRIGGER trigger_update_account_activity
AFTER UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_account_last_activity();

-- Update spam_accounts last_used_at
CREATE OR REPLACE FUNCTION update_spam_account_last_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_type = 'spam' THEN
    UPDATE spam_accounts
    SET last_used_at = NOW()
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_spam_last_used ON execution_logs;
CREATE TRIGGER trigger_update_spam_last_used
AFTER INSERT ON execution_logs
FOR EACH ROW
WHEN (NEW.account_ids IS NOT NULL)
EXECUTE FUNCTION update_spam_account_last_used();

-- ============================================================================
-- 9. Service Role Policies for Edge Functions
-- ============================================================================

-- Allow service role to insert/update execution logs
CREATE POLICY "Service role can manage execution logs"
ON execution_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to update daily stats
CREATE POLICY "Service role can manage daily stats"
ON daily_stats FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to insert CTA executions
DROP POLICY IF EXISTS "Service role can insert cta executions" ON cta_executions;
CREATE POLICY "Service role can insert cta executions"
ON cta_executions FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update cta executions"
ON cta_executions FOR UPDATE
TO service_role
USING (true);

-- Allow service role to update follow relationships
CREATE POLICY "Service role can update follow relationships"
ON follow_relationships FOR UPDATE
TO service_role
USING (true);

-- ============================================================================
-- 10. Initial Data Setup
-- ============================================================================

-- Create default settings for existing users
INSERT INTO user_settings (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;
