-- XLO System - Complete Schema (Remaining 18 Tables)
-- Created: 2025-11-12
-- Purpose: Add all remaining tables to complete the full 36-table schema

-- ============================================================================
-- 1. profiles - ユーザープロフィール設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  avatar_url TEXT,

  -- Notification Settings
  notification_settings JSONB DEFAULT '{
    "email_notifications_enabled": true,
    "sound_notifications_enabled": true,
    "desktop_notifications_enabled": false,
    "realtime_notifications_enabled": true,
    "notify_on_errors": true,
    "notify_on_suspensions": true,
    "notify_on_rate_limits": true,
    "notify_on_completions": false,
    "email_frequency": "realtime",
    "email_types": ["error", "urgent"]
  }'::JSONB,

  -- Security Settings
  security_settings JSONB DEFAULT '{
    "two_factor_enabled": false,
    "session_timeout_minutes": 480,
    "ip_whitelist": [],
    "allowed_origins": []
  }'::JSONB,

  -- Automation Settings
  automation_settings JSONB DEFAULT '{
    "auto_token_refresh_enabled": true,
    "auto_unfollow_enabled": false,
    "auto_cleanup_enabled": true,
    "default_jitter_min": 1,
    "default_jitter_max": 5,
    "default_retry_count": 3,
    "default_timeout_seconds": 30
  }'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- ============================================================================
-- 2. account_groups - アカウントグループ
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  account_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_account_groups_user_id ON account_groups(user_id);
CREATE INDEX idx_account_groups_tags ON account_groups USING GIN(tags);

-- ============================================================================
-- 3. account_sessions - アカウントセッション管理
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  proxy_id UUID,
  fingerprint JSONB,
  cookies JSONB,
  headers JSONB,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_sessions_user_id ON account_sessions(user_id);
CREATE INDEX idx_account_sessions_account_id ON account_sessions(account_id);
CREATE INDEX idx_account_sessions_is_active ON account_sessions(is_active);
CREATE INDEX idx_account_sessions_expires_at ON account_sessions(expires_at);

-- ============================================================================
-- 4. account_performance - アカウントパフォーマンス
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  date DATE NOT NULL,

  -- Performance Metrics
  requests_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,

  -- Action-specific Stats
  posts_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,

  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, account_id, date)
);

CREATE INDEX idx_account_performance_user_id ON account_performance(user_id);
CREATE INDEX idx_account_performance_account_id ON account_performance(account_id);
CREATE INDEX idx_account_performance_date ON account_performance(date DESC);

-- ============================================================================
-- 5. bulk_post_settings - 一括投稿設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_post_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Execution Settings
  min_interval_minutes INTEGER DEFAULT 5,
  max_interval_minutes INTEGER DEFAULT 15,
  active_days INTEGER[] DEFAULT '{1,2,3,4,5,6,0}',
  start_time TIME DEFAULT '06:00',
  end_time TIME DEFAULT '23:00',

  -- Account Settings
  target_accounts UUID[] DEFAULT '{}',
  account_selection_mode TEXT DEFAULT 'random' CHECK (account_selection_mode IN ('random', 'sequential')),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_bulk_post_settings_user_id ON bulk_post_settings(user_id);
CREATE INDEX idx_bulk_post_settings_is_active ON bulk_post_settings(is_active);

-- ============================================================================
-- 6. url_engagements - URL エンゲージメント
-- ============================================================================
CREATE TABLE IF NOT EXISTS url_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  tweet_id TEXT,

  -- Action Settings
  likes_count INTEGER DEFAULT 0,
  reply_template_id UUID REFERENCES cta_templates(id) ON DELETE SET NULL,

  -- Execution Accounts
  executor_account_ids UUID[] DEFAULT '{}',
  account_filter_tags TEXT[] DEFAULT '{}',

  -- Progress Management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  completed_likes_count INTEGER DEFAULT 0,
  completed_replies_count INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_url_engagements_user_id ON url_engagements(user_id);
CREATE INDEX idx_url_engagements_status ON url_engagements(status);
CREATE INDEX idx_url_engagements_tweet_id ON url_engagements(tweet_id);

-- ============================================================================
-- 7. tweet_engagements - ツイートエンゲージメント
-- ============================================================================
CREATE TABLE IF NOT EXISTS tweet_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  tweet_url TEXT NOT NULL,

  -- Action Settings
  like_enabled BOOLEAN DEFAULT true,
  reply_template_id UUID REFERENCES cta_templates(id) ON DELETE SET NULL,

  -- Execution Settings
  executor_account_ids UUID[] DEFAULT '{}',
  account_filter_tags TEXT[] DEFAULT '{}',

  -- Preview
  tweet_preview JSONB,

  -- Progress Management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  completed_likes_count INTEGER DEFAULT 0,
  completed_replies_count INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tweet_engagements_user_id ON tweet_engagements(user_id);
CREATE INDEX idx_tweet_engagements_status ON tweet_engagements(status);
CREATE INDEX idx_tweet_engagements_tweet_id ON tweet_engagements(tweet_id);

-- ============================================================================
-- 8. follow_history - フォロー履歴
-- ============================================================================
CREATE TABLE IF NOT EXISTS follow_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  target_user_id TEXT NOT NULL,
  target_username TEXT NOT NULL,

  -- Dates
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  unfollowed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'following' CHECK (status IN ('following', 'unfollowed', 'failed')),

  -- Auto Unfollow Settings
  auto_unfollow_enabled BOOLEAN DEFAULT false,
  unfollow_after_days INTEGER DEFAULT 7,
  scheduled_unfollow_at TIMESTAMPTZ,

  -- Related Info
  engagement_rule_id UUID,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_history_user_id ON follow_history(user_id);
CREATE INDEX idx_follow_history_account_id ON follow_history(account_id);
CREATE INDEX idx_follow_history_status ON follow_history(status);
CREATE INDEX idx_follow_history_scheduled_unfollow_at ON follow_history(scheduled_unfollow_at)
  WHERE status = 'following' AND auto_unfollow_enabled = true;

-- ============================================================================
-- 9. proxy_assignments - プロキシ割り当て
-- ============================================================================
CREATE TABLE IF NOT EXISTS proxy_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  app_id UUID REFERENCES twitter_apps(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id, proxy_id)
);

CREATE INDEX idx_proxy_assignments_user_id ON proxy_assignments(user_id);
CREATE INDEX idx_proxy_assignments_account_id ON proxy_assignments(account_id);
CREATE INDEX idx_proxy_assignments_proxy_id ON proxy_assignments(proxy_id);

-- ============================================================================
-- 10. proxy_usage_stats - プロキシ使用統計
-- ============================================================================
CREATE TABLE IF NOT EXISTS proxy_usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Statistics
  requests_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,

  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, proxy_id, date)
);

CREATE INDEX idx_proxy_usage_stats_user_id ON proxy_usage_stats(user_id);
CREATE INDEX idx_proxy_usage_stats_proxy_id ON proxy_usage_stats(proxy_id);
CREATE INDEX idx_proxy_usage_stats_date ON proxy_usage_stats(date DESC);

-- ============================================================================
-- 11. notifications - 通知
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'account', 'execution', 'rate_limit')),

  -- Read Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Action
  action_url TEXT,
  action_label TEXT,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_priority ON notifications(priority);

-- ============================================================================
-- 12. analytics - 分析データ
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, metric_type, metric_name, date)
);

CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_metric_type ON analytics(metric_type);
CREATE INDEX idx_analytics_date ON analytics(date DESC);

-- ============================================================================
-- 13. reports - レポート設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('standard', 'custom')),

  -- Report Configuration
  config JSONB NOT NULL,

  -- Schedule
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_config JSONB,

  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_report_type ON reports(report_type);
CREATE INDEX idx_reports_schedule_enabled ON reports(schedule_enabled);

-- ============================================================================
-- 14. blacklist - ブラックリスト
-- ============================================================================
CREATE TABLE IF NOT EXISTS blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, keyword)
);

CREATE INDEX idx_blacklist_user_id ON blacklist(user_id);
CREATE INDEX idx_blacklist_category ON blacklist(category);
CREATE INDEX idx_blacklist_is_active ON blacklist(is_active);

-- ============================================================================
-- 15. tag_settings - タグ設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS tag_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  description TEXT,
  default_account_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, tag_name)
);

CREATE INDEX idx_tag_settings_user_id ON tag_settings(user_id);
CREATE INDEX idx_tag_settings_tag_name ON tag_settings(tag_name);

-- ============================================================================
-- 16. scheduler_settings - スケジューラー設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduler_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Auto Refresh
  auto_refresh_enabled BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ,

  -- Engagement Scheduler Config
  engagement_scheduler_config JSONB DEFAULT '{
    "enabled": true,
    "active_hours": {"start": "06:00", "end": "23:00"},
    "active_days": [1,2,3,4,5],
    "min_interval_minutes": 30,
    "max_interval_minutes": 60,
    "max_concurrent_rules": 5
  }'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_scheduler_settings_user_id ON scheduler_settings(user_id);

-- ============================================================================
-- 17. app_pool_devices - デバイス管理
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_pool_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device Info
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy', 'error')),
  os_version TEXT,
  app_version TEXT DEFAULT '2.1.4',
  ip_address TEXT,
  device_fingerprint JSONB,

  -- Resource Info
  cpu_usage INTEGER DEFAULT 0,
  memory_usage INTEGER DEFAULT 0,
  active_accounts_count INTEGER DEFAULT 0,
  max_accounts INTEGER DEFAULT 10,

  -- Connection Info
  last_ping_at TIMESTAMPTZ,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, device_name)
);

CREATE INDEX idx_app_pool_devices_user_id ON app_pool_devices(user_id);
CREATE INDEX idx_app_pool_devices_status ON app_pool_devices(status);
CREATE INDEX idx_app_pool_devices_last_ping_at ON app_pool_devices(last_ping_at);

-- ============================================================================
-- 18. app_pool_device_accounts - デバイスアカウント割り当て
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_pool_device_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES app_pool_devices(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'active', 'suspended')),

  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(device_id, account_id)
);

CREATE INDEX idx_app_pool_device_accounts_user_id ON app_pool_device_accounts(user_id);
CREATE INDEX idx_app_pool_device_accounts_device_id ON app_pool_device_accounts(device_id);
CREATE INDEX idx_app_pool_device_accounts_account_id ON app_pool_device_accounts(account_id);
CREATE INDEX idx_app_pool_device_accounts_status ON app_pool_device_accounts(status);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_post_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_pool_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_pool_device_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for each table (users can only access their own data)
CREATE POLICY "Users can manage their own profile"
  ON profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own account groups"
  ON account_groups FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own account sessions"
  ON account_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own account performance"
  ON account_performance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own account performance"
  ON account_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own bulk post settings"
  ON bulk_post_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own url engagements"
  ON url_engagements FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tweet engagements"
  ON tweet_engagements FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own follow history"
  ON follow_history FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own proxy assignments"
  ON proxy_assignments FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own proxy usage stats"
  ON proxy_usage_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proxy usage stats"
  ON proxy_usage_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics"
  ON analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reports"
  ON reports FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own blacklist"
  ON blacklist FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tag settings"
  ON tag_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own scheduler settings"
  ON scheduler_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own app pool devices"
  ON app_pool_devices FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own app pool device accounts"
  ON app_pool_device_accounts FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at Triggers
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_groups_updated_at BEFORE UPDATE ON account_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_sessions_updated_at BEFORE UPDATE ON account_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_performance_updated_at BEFORE UPDATE ON account_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_post_settings_updated_at BEFORE UPDATE ON bulk_post_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_url_engagements_updated_at BEFORE UPDATE ON url_engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tweet_engagements_updated_at BEFORE UPDATE ON tweet_engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_history_updated_at BEFORE UPDATE ON follow_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proxy_usage_stats_updated_at BEFORE UPDATE ON proxy_usage_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blacklist_updated_at BEFORE UPDATE ON blacklist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tag_settings_updated_at BEFORE UPDATE ON tag_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduler_settings_updated_at BEFORE UPDATE ON scheduler_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_pool_devices_updated_at BEFORE UPDATE ON app_pool_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_pool_device_accounts_updated_at BEFORE UPDATE ON app_pool_device_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, user_id, email)
  VALUES (NEW.id, NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notifications
    WHERE user_id = p_user_id AND is_read = false
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = NOW()
  WHERE user_id = p_user_id AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup old notifications (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(p_days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM account_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View: Account Health Summary
CREATE OR REPLACE VIEW v_account_health_summary AS
SELECT
  at.user_id,
  at.account_type,
  COUNT(*) as total_accounts,
  SUM(CASE WHEN at.is_active THEN 1 ELSE 0 END) as active_accounts,
  SUM(CASE WHEN at.is_suspended THEN 1 ELSE 0 END) as suspended_accounts,
  SUM(CASE WHEN at.expires_at < NOW() THEN 1 ELSE 0 END) as expired_tokens,
  SUM(CASE WHEN at.expires_at < NOW() + INTERVAL '1 hour' THEN 1 ELSE 0 END) as expiring_soon
FROM account_tokens at
GROUP BY at.user_id, at.account_type;

-- View: Daily Performance Summary
CREATE OR REPLACE VIEW v_daily_performance_summary AS
SELECT
  ap.user_id,
  ap.date,
  COUNT(DISTINCT ap.account_id) as active_accounts,
  SUM(ap.requests_count) as total_requests,
  SUM(ap.success_count) as total_success,
  SUM(ap.error_count) as total_errors,
  ROUND(SUM(ap.success_count)::numeric / NULLIF(SUM(ap.requests_count), 0) * 100, 2) as success_rate,
  AVG(ap.avg_response_time_ms)::integer as avg_response_time_ms
FROM account_performance ap
GROUP BY ap.user_id, ap.date
ORDER BY ap.date DESC;

-- View: Proxy Health Status
CREATE OR REPLACE VIEW v_proxy_health_status AS
SELECT
  p.id,
  p.user_id,
  p.proxy_type,
  p.country,
  p.is_active,
  p.response_time_ms,
  p.last_checked_at,
  COUNT(pa.id) as assigned_accounts_count,
  COALESCE(pus.success_count, 0) as today_success_count,
  COALESCE(pus.error_count, 0) as today_error_count,
  CASE
    WHEN pus.requests_count > 0 THEN
      ROUND((pus.success_count::numeric / pus.requests_count) * 100, 2)
    ELSE 0
  END as today_success_rate
FROM proxies p
LEFT JOIN proxy_assignments pa ON pa.proxy_id = p.id
LEFT JOIN proxy_usage_stats pus ON pus.proxy_id = p.id AND pus.date = CURRENT_DATE
GROUP BY p.id, p.user_id, p.proxy_type, p.country, p.is_active,
         p.response_time_ms, p.last_checked_at, pus.success_count,
         pus.error_count, pus.requests_count;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profile and settings';
COMMENT ON TABLE account_groups IS 'Logical grouping of accounts for management';
COMMENT ON TABLE account_sessions IS 'Session management for each account';
COMMENT ON TABLE account_performance IS 'Daily performance metrics per account';
COMMENT ON TABLE bulk_post_settings IS 'Preset configurations for bulk posting';
COMMENT ON TABLE url_engagements IS 'URL-based engagement campaigns';
COMMENT ON TABLE tweet_engagements IS 'Tweet-specific engagement campaigns';
COMMENT ON TABLE follow_history IS 'Follow/unfollow tracking with auto-unfollow support';
COMMENT ON TABLE proxy_assignments IS 'Account-to-proxy assignments';
COMMENT ON TABLE proxy_usage_stats IS 'Daily proxy usage statistics';
COMMENT ON TABLE notifications IS 'User notifications for events and alerts';
COMMENT ON TABLE analytics IS 'Time-series analytics data';
COMMENT ON TABLE reports IS 'Custom and scheduled report configurations';
COMMENT ON TABLE blacklist IS 'Keyword blacklist for content filtering';
COMMENT ON TABLE tag_settings IS 'Tag management and configuration';
COMMENT ON TABLE scheduler_settings IS 'User-specific scheduler configurations';
COMMENT ON TABLE app_pool_devices IS 'Physical devices for app-based automation';
COMMENT ON TABLE app_pool_device_accounts IS 'Device-to-account assignments';
