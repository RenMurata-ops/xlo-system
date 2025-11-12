-- XLO System - Complete Schema Deployment (Safe for Dashboard)
-- Created: 2025-11-12
-- Purpose: Deploy remaining 18 tables safely (idempotent)
-- Usage: Run in Supabase Dashboard SQL Editor

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. profiles - ユーザープロフィール設定
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  notification_settings JSONB DEFAULT '{"email_notifications_enabled": true, "sound_notifications_enabled": true, "desktop_notifications_enabled": false, "realtime_notifications_enabled": true, "notify_on_errors": true, "notify_on_suspensions": true, "notify_on_rate_limits": true, "notify_on_completions": false, "email_frequency": "realtime", "email_types": ["error", "urgent"]}'::JSONB,
  security_settings JSONB DEFAULT '{"two_factor_enabled": false, "session_timeout_minutes": 480, "ip_whitelist": [], "allowed_origins": []}'::JSONB,
  automation_settings JSONB DEFAULT '{"auto_token_refresh_enabled": true, "auto_unfollow_enabled": false, "auto_cleanup_enabled": true, "default_jitter_min": 1, "default_jitter_max": 5, "default_retry_count": 3, "default_timeout_seconds": 30}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_user_id') THEN
    CREATE INDEX idx_profiles_user_id ON profiles(user_id);
  END IF;
END $$;

-- ============================================================================
-- 2-18. Other Tables (following same pattern)
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

CREATE TABLE IF NOT EXISTS account_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  requests_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS bulk_post_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  min_interval_minutes INTEGER DEFAULT 5,
  max_interval_minutes INTEGER DEFAULT 15,
  active_days INTEGER[] DEFAULT '{1,2,3,4,5,6,0}',
  start_time TIME DEFAULT '06:00',
  end_time TIME DEFAULT '23:00',
  target_accounts UUID[] DEFAULT '{}',
  account_selection_mode TEXT DEFAULT 'random' CHECK (account_selection_mode IN ('random', 'sequential')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS url_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  tweet_id TEXT,
  likes_count INTEGER DEFAULT 0,
  reply_template_id UUID,
  executor_account_ids UUID[] DEFAULT '{}',
  account_filter_tags TEXT[] DEFAULT '{}',
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

CREATE TABLE IF NOT EXISTS tweet_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  tweet_url TEXT NOT NULL,
  like_enabled BOOLEAN DEFAULT true,
  reply_template_id UUID,
  executor_account_ids UUID[] DEFAULT '{}',
  account_filter_tags TEXT[] DEFAULT '{}',
  tweet_preview JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  completed_likes_count INTEGER DEFAULT 0,
  completed_replies_count INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  target_user_id TEXT NOT NULL,
  target_username TEXT NOT NULL,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  unfollowed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'following' CHECK (status IN ('following', 'unfollowed', 'failed')),
  auto_unfollow_enabled BOOLEAN DEFAULT false,
  unfollow_after_days INTEGER DEFAULT 7,
  scheduled_unfollow_at TIMESTAMPTZ,
  engagement_rule_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proxy_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  app_id UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proxy_assignments_account_id_proxy_id_key'
  ) THEN
    ALTER TABLE proxy_assignments ADD CONSTRAINT proxy_assignments_account_id_proxy_id_key UNIQUE(account_id, proxy_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS proxy_usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requests_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, proxy_id, date)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'account', 'execution', 'rate_limit')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('standard', 'custom')),
  config JSONB NOT NULL,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_config JSONB,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

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

CREATE TABLE IF NOT EXISTS scheduler_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_refresh_enabled BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ,
  engagement_scheduler_config JSONB DEFAULT '{"enabled": true, "active_hours": {"start": "06:00", "end": "23:00"}, "active_days": [1,2,3,4,5], "min_interval_minutes": 30, "max_interval_minutes": 60, "max_concurrent_rules": 5}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS app_pool_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy', 'error')),
  os_version TEXT,
  app_version TEXT DEFAULT '2.1.4',
  ip_address TEXT,
  device_fingerprint JSONB,
  cpu_usage INTEGER DEFAULT 0,
  memory_usage INTEGER DEFAULT 0,
  active_accounts_count INTEGER DEFAULT 0,
  max_accounts INTEGER DEFAULT 10,
  last_ping_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_name)
);

CREATE TABLE IF NOT EXISTS app_pool_device_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES app_pool_devices(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'active', 'suspended')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, account_id)
);

-- ============================================================================
-- Create Indexes (if not exists)
-- ============================================================================

DO $$ BEGIN
  -- account_groups indexes
  CREATE INDEX IF NOT EXISTS idx_account_groups_user_id ON account_groups(user_id);
  CREATE INDEX IF NOT EXISTS idx_account_groups_tags ON account_groups USING GIN(tags);

  -- account_sessions indexes
  CREATE INDEX IF NOT EXISTS idx_account_sessions_user_id ON account_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_account_sessions_account_id ON account_sessions(account_id);
  CREATE INDEX IF NOT EXISTS idx_account_sessions_is_active ON account_sessions(is_active);

  -- account_performance indexes
  CREATE INDEX IF NOT EXISTS idx_account_performance_user_id ON account_performance(user_id);
  CREATE INDEX IF NOT EXISTS idx_account_performance_date ON account_performance(date DESC);

  -- notifications indexes
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

  -- analytics indexes
  CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date DESC);

  -- follow_history indexes
  CREATE INDEX IF NOT EXISTS idx_follow_history_user_id ON follow_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_follow_history_account_id ON follow_history(account_id);

  -- proxy_usage_stats indexes
  CREATE INDEX IF NOT EXISTS idx_proxy_usage_stats_user_id ON proxy_usage_stats(user_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_usage_stats_date ON proxy_usage_stats(date DESC);
END $$;

-- ============================================================================
-- Enable RLS
-- ============================================================================

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

-- ============================================================================
-- Create RLS Policies (if not exists)
-- ============================================================================

DO $$ BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can manage their own profile') THEN
    CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- account_groups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_groups' AND policyname = 'Users can manage their own account groups') THEN
    CREATE POLICY "Users can manage their own account groups" ON account_groups FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- account_sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_sessions' AND policyname = 'Users can manage their own account sessions') THEN
    CREATE POLICY "Users can manage their own account sessions" ON account_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- account_performance
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_performance' AND policyname = 'Users can view their own account performance') THEN
    CREATE POLICY "Users can view their own account performance" ON account_performance FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- bulk_post_settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bulk_post_settings' AND policyname = 'Users can manage their own bulk post settings') THEN
    CREATE POLICY "Users can manage their own bulk post settings" ON bulk_post_settings FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- url_engagements
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'url_engagements' AND policyname = 'Users can manage their own url engagements') THEN
    CREATE POLICY "Users can manage their own url engagements" ON url_engagements FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- tweet_engagements
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tweet_engagements' AND policyname = 'Users can manage their own tweet engagements') THEN
    CREATE POLICY "Users can manage their own tweet engagements" ON tweet_engagements FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- follow_history
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follow_history' AND policyname = 'Users can manage their own follow history') THEN
    CREATE POLICY "Users can manage their own follow history" ON follow_history FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- proxy_assignments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proxy_assignments' AND policyname = 'Users can manage their own proxy assignments') THEN
    CREATE POLICY "Users can manage their own proxy assignments" ON proxy_assignments FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- proxy_usage_stats
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proxy_usage_stats' AND policyname = 'Users can view their own proxy usage stats') THEN
    CREATE POLICY "Users can view their own proxy usage stats" ON proxy_usage_stats FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- notifications
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can manage their own notifications') THEN
    CREATE POLICY "Users can manage their own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- analytics
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analytics' AND policyname = 'Users can view their own analytics') THEN
    CREATE POLICY "Users can view their own analytics" ON analytics FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can manage their own reports') THEN
    CREATE POLICY "Users can manage their own reports" ON reports FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- blacklist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blacklist' AND policyname = 'Users can manage their own blacklist') THEN
    CREATE POLICY "Users can manage their own blacklist" ON blacklist FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- tag_settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tag_settings' AND policyname = 'Users can manage their own tag settings') THEN
    CREATE POLICY "Users can manage their own tag settings" ON tag_settings FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- scheduler_settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scheduler_settings' AND policyname = 'Users can manage their own scheduler settings') THEN
    CREATE POLICY "Users can manage their own scheduler settings" ON scheduler_settings FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- app_pool_devices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_pool_devices' AND policyname = 'Users can manage their own app pool devices') THEN
    CREATE POLICY "Users can manage their own app pool devices" ON app_pool_devices FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- app_pool_device_accounts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_pool_device_accounts' AND policyname = 'Users can manage their own app pool device accounts') THEN
    CREATE POLICY "Users can manage their own app pool device accounts" ON app_pool_device_accounts FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, user_id, email)
  VALUES (NEW.id, NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Notification helper functions
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE v_updated INTEGER;
BEGIN
  UPDATE notifications SET is_read = true, read_at = NOW()
  WHERE user_id = p_user_id AND is_read = false;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Cleanup functions
CREATE OR REPLACE FUNCTION cleanup_old_notifications(p_days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM notifications WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM account_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify all tables exist
SELECT
  'profiles' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='profiles') as exists
UNION ALL SELECT 'account_groups', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='account_groups')
UNION ALL SELECT 'account_sessions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='account_sessions')
UNION ALL SELECT 'account_performance', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='account_performance')
UNION ALL SELECT 'bulk_post_settings', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='bulk_post_settings')
UNION ALL SELECT 'url_engagements', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='url_engagements')
UNION ALL SELECT 'tweet_engagements', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='tweet_engagements')
UNION ALL SELECT 'follow_history', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='follow_history')
UNION ALL SELECT 'proxy_assignments', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='proxy_assignments')
UNION ALL SELECT 'proxy_usage_stats', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='proxy_usage_stats')
UNION ALL SELECT 'notifications', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='notifications')
UNION ALL SELECT 'analytics', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='analytics')
UNION ALL SELECT 'reports', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='reports')
UNION ALL SELECT 'blacklist', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='blacklist')
UNION ALL SELECT 'tag_settings', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='tag_settings')
UNION ALL SELECT 'scheduler_settings', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='scheduler_settings')
UNION ALL SELECT 'app_pool_devices', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='app_pool_devices')
UNION ALL SELECT 'app_pool_device_accounts', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='app_pool_device_accounts');
