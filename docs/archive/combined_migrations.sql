-- XLO System Database Migration
-- Phase 1: Core Tables (Day 1)
-- Created: 2025-11-10

-- Note: gen_random_uuid() is built-in for PostgreSQL 13+
-- No extension needed

-- ============================================================================
-- 1. account_tokens - アカウントトークン管理 (最重要)
-- ============================================================================
CREATE TABLE account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'follow', 'spam')),
  account_id UUID NOT NULL,
  
  -- OAuth Tokens
  access_token TEXT NOT NULL,
  access_token_secret TEXT,
  refresh_token TEXT,
  token_type TEXT NOT NULL CHECK (token_type IN ('oauth1a', 'oauth2')),
  expires_at TIMESTAMPTZ,
  scope TEXT,
  
  -- Twitter Profile
  x_user_id TEXT NOT NULL,
  x_username TEXT NOT NULL,
  display_name TEXT,
  twitter_display_name TEXT,
  profile_image_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  
  -- Token Management
  last_refreshed_at TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, x_user_id, account_type)
);

CREATE INDEX idx_account_tokens_user_id ON account_tokens(user_id);
CREATE INDEX idx_account_tokens_x_user_id ON account_tokens(x_user_id);
CREATE INDEX idx_account_tokens_account_type ON account_tokens(account_type);
CREATE INDEX idx_account_tokens_is_active ON account_tokens(is_active);

-- ============================================================================
-- 2. main_accounts - メインアカウント
-- ============================================================================
CREATE TABLE main_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, handle)
);

CREATE INDEX idx_main_accounts_user_id ON main_accounts(user_id);
CREATE INDEX idx_main_accounts_is_active ON main_accounts(is_active);
CREATE INDEX idx_main_accounts_tags ON main_accounts USING GIN(tags);

-- ============================================================================
-- 3. follow_accounts - フォローアカウント
-- ============================================================================
CREATE TABLE follow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_handle TEXT NOT NULL,
  target_name TEXT NOT NULL,
  followers_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, target_handle)
);

CREATE INDEX idx_follow_accounts_user_id ON follow_accounts(user_id);
CREATE INDEX idx_follow_accounts_is_active ON follow_accounts(is_active);
CREATE INDEX idx_follow_accounts_priority ON follow_accounts(priority);

-- ============================================================================
-- 4. spam_accounts - スパムアカウント
-- ============================================================================
CREATE TABLE spam_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  proxy_id UUID,
  last_used_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, handle)
);

CREATE INDEX idx_spam_accounts_user_id ON spam_accounts(user_id);
CREATE INDEX idx_spam_accounts_is_active ON spam_accounts(is_active);

-- ============================================================================
-- 5. posts - 投稿管理
-- ============================================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  tweet_id TEXT,
  engagement_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  error_message TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_account_id ON posts(account_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);

-- ============================================================================
-- 6. twitter_apps - Twitter アプリ管理 (複数App対応)
-- ============================================================================
CREATE TABLE twitter_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  
  -- OAuth 1.0a
  consumer_key TEXT,
  consumer_secret TEXT,
  
  -- OAuth 2.0
  client_id TEXT,
  client_secret TEXT,
  
  oauth_version TEXT NOT NULL CHECK (oauth_version IN ('1.0a', '2.0')),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, app_name)
);

CREATE INDEX idx_twitter_apps_user_id ON twitter_apps(user_id);
CREATE INDEX idx_twitter_apps_is_active ON twitter_apps(is_active);

-- ============================================================================
-- 7. auto_engagement_rules - 自動エンゲージメントルール
-- ============================================================================
CREATE TABLE auto_engagement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'url', 'user')),
  is_active BOOLEAN DEFAULT true,
  
  -- Search Settings
  search_keywords TEXT[],
  exclude_keywords TEXT[],
  target_urls TEXT[],
  target_user_ids TEXT[],
  
  -- Filters
  min_followers INTEGER DEFAULT 0,
  max_followers INTEGER,
  account_age_days INTEGER DEFAULT 0,
  
  -- Actions
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet')),
  like_strategy TEXT DEFAULT 'latest' CHECK (like_strategy IN ('latest', 'popular', 'random')),
  likes_per_follower INTEGER DEFAULT 1,
  reply_template_id UUID,
  
  -- Execution
  executor_account_ids UUID[],
  account_selection_mode TEXT DEFAULT 'random' CHECK (account_selection_mode IN ('random', 'sequential', 'distributed')),
  max_accounts_per_run INTEGER DEFAULT 1,
  
  -- Schedule
  execution_frequency_minutes INTEGER DEFAULT 60,
  detection_delay_minutes INTEGER DEFAULT 5,
  max_executions_per_hour INTEGER DEFAULT 10,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_days_of_week INTEGER[],
  schedule_hours INTEGER[],
  
  -- Auto Unfollow
  auto_unfollow_enabled BOOLEAN DEFAULT false,
  unfollow_after_days INTEGER DEFAULT 7,
  
  -- Stats
  last_execution_at TIMESTAMPTZ,
  total_executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_engagement_rules_user_id ON auto_engagement_rules(user_id);
CREATE INDEX idx_auto_engagement_rules_is_active ON auto_engagement_rules(is_active);
CREATE INDEX idx_auto_engagement_rules_rule_type ON auto_engagement_rules(rule_type);

-- ============================================================================
-- 8. loops - ループ実行システム
-- ============================================================================
CREATE TABLE loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loop_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Execution Settings
  execution_interval_hours INTEGER NOT NULL DEFAULT 24,
  min_account_count INTEGER DEFAULT 1,
  max_account_count INTEGER DEFAULT 5,
  executor_account_ids UUID[],
  allowed_account_tags TEXT[],
  
  -- Reply Settings
  reply_template_id UUID,
  reply_delay_min_minutes INTEGER DEFAULT 5,
  reply_delay_max_minutes INTEGER DEFAULT 30,
  jitter_min_minutes INTEGER DEFAULT 0,
  jitter_max_minutes INTEGER DEFAULT 10,
  
  -- Status
  last_execution_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  post_count INTEGER DEFAULT 0,
  
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loops_user_id ON loops(user_id);
CREATE INDEX idx_loops_is_active ON loops(is_active);
CREATE INDEX idx_loops_next_execution_at ON loops(next_execution_at);

-- ============================================================================
-- 9. proxies - プロキシ管理
-- ============================================================================
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proxy_type TEXT NOT NULL CHECK (proxy_type IN ('nordvpn', 'http', 'https', 'socks5')),
  proxy_url TEXT NOT NULL,
  username TEXT,
  password TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  response_time_ms INTEGER,
  last_checked_at TIMESTAMPTZ,
  error_message TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proxies_user_id ON proxies(user_id);
CREATE INDEX idx_proxies_is_active ON proxies(is_active);
CREATE INDEX idx_proxies_proxy_type ON proxies(proxy_type);

-- ============================================================================
-- 10. nordvpn_accounts - NordVPN アカウント管理
-- ============================================================================
CREATE TABLE nordvpn_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, username)
);

CREATE INDEX idx_nordvpn_accounts_user_id ON nordvpn_accounts(user_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_engagement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE nordvpn_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for each table
CREATE POLICY "Users can view their own account tokens"
  ON account_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own account tokens"
  ON account_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account tokens"
  ON account_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own account tokens"
  ON account_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Apply similar policies to other tables
CREATE POLICY "Users can manage their own main accounts"
  ON main_accounts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own follow accounts"
  ON follow_accounts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own spam accounts"
  ON spam_accounts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own posts"
  ON posts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own twitter apps"
  ON twitter_apps FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own engagement rules"
  ON auto_engagement_rules FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own loops"
  ON loops FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own proxies"
  ON proxies FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own nordvpn accounts"
  ON nordvpn_accounts FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_account_tokens_updated_at BEFORE UPDATE ON account_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_main_accounts_updated_at BEFORE UPDATE ON main_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_accounts_updated_at BEFORE UPDATE ON follow_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spam_accounts_updated_at BEFORE UPDATE ON spam_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_apps_updated_at BEFORE UPDATE ON twitter_apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_engagement_rules_updated_at BEFORE UPDATE ON auto_engagement_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loops_updated_at BEFORE UPDATE ON loops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proxies_updated_at BEFORE UPDATE ON proxies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nordvpn_accounts_updated_at BEFORE UPDATE ON nordvpn_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ========================================
-- Migration 2: Add Missing Tables
-- ========================================


-- XLO System - Additional Tables (Requirements-Compliant)
-- Created: 2025-11-12
-- Purpose: Add missing tables and align schema with official requirements

-- ============================================================================
-- Fix twitter_apps table schema to match UI expectations
-- ============================================================================
DROP TABLE IF EXISTS twitter_apps CASCADE;

CREATE TABLE twitter_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,

  -- Twitter API Credentials (UI expects these exact names)
  api_key TEXT NOT NULL,           -- Client ID or API Key
  api_secret TEXT NOT NULL,        -- Client Secret
  bearer_token TEXT,               -- Optional Bearer Token

  -- OAuth Configuration
  permissions TEXT[] DEFAULT '{}', -- Scopes/Permissions
  callback_url TEXT,               -- OAuth Callback URL
  description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, app_name)
);

CREATE INDEX idx_twitter_apps_user_id ON twitter_apps(user_id);
CREATE INDEX idx_twitter_apps_is_active ON twitter_apps(is_active);

-- ============================================================================
-- post_templates - 投稿テンプレート（要件準拠）
-- ============================================================================
CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  loop_config JSONB,               -- Loop-specific configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, title)
);

CREATE INDEX idx_post_templates_user_id ON post_templates(user_id);
CREATE INDEX idx_post_templates_is_active ON post_templates(is_active);
CREATE INDEX idx_post_templates_tags ON post_templates USING GIN(tags);

-- ============================================================================
-- post_template_items - 投稿テンプレートアイテム（重み付き）
-- ============================================================================
CREATE TABLE post_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES post_templates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  weight INTEGER DEFAULT 1 CHECK (weight >= 1 AND weight <= 100),
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_template_items_user_id ON post_template_items(user_id);
CREATE INDEX idx_post_template_items_template_id ON post_template_items(template_id);
CREATE INDEX idx_post_template_items_is_active ON post_template_items(is_active);

-- ============================================================================
-- cta_templates - CTA テンプレート
-- ============================================================================
CREATE TABLE cta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_cta_templates_user_id ON cta_templates(user_id);
CREATE INDEX idx_cta_templates_category ON cta_templates(category);
CREATE INDEX idx_cta_templates_is_active ON cta_templates(is_active);

-- ============================================================================
-- auto_engagement_executions - エンゲージメント実行ログ
-- ============================================================================
CREATE TABLE auto_engagement_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES auto_engagement_rules(id) ON DELETE CASCADE,
  executor_account_id UUID,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet')),
  target_tweet_id TEXT,
  target_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')) DEFAULT 'success',
  error_message TEXT,
  response_data JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_engagement_executions_user_id ON auto_engagement_executions(user_id);
CREATE INDEX idx_auto_engagement_executions_rule_id ON auto_engagement_executions(rule_id);
CREATE INDEX idx_auto_engagement_executions_status ON auto_engagement_executions(status);
CREATE INDEX idx_auto_engagement_executions_executed_at ON auto_engagement_executions(executed_at);

-- ============================================================================
-- loop_executions - ループ実行ログ（要件準拠名）
-- ============================================================================
CREATE TABLE loop_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  executor_account_id UUID,

  -- Execution Results
  created_posts_count INTEGER DEFAULT 0,
  sent_replies_count INTEGER DEFAULT 0,
  used_account_ids JSONB,          -- Array of account IDs used

  -- Status
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')) DEFAULT 'success',
  exec_data JSONB,                 -- Detailed execution data
  error_message TEXT,

  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loop_executions_user_id ON loop_executions(user_id);
CREATE INDEX idx_loop_executions_loop_id ON loop_executions(loop_id);
CREATE INDEX idx_loop_executions_status ON loop_executions(status);
CREATE INDEX idx_loop_executions_executed_at ON loop_executions(executed_at);

-- ============================================================================
-- oauth_sessions - OAuth セッション管理（PKCE対応）
-- ============================================================================
CREATE TABLE oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Index for quick state lookup
  UNIQUE(state)
);

CREATE INDEX idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

-- ============================================================================
-- rate_limits - API レート制限記録
-- ============================================================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES twitter_apps(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('oauth1a', 'oauth2', 'bearer')),

  -- Rate Limit Data
  used_requests INTEGER DEFAULT 0,
  limit_total INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  window_started_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, endpoint, token_type, window_started_at)
);

CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX idx_rate_limits_reset_at ON rate_limits(reset_at);

-- ============================================================================
-- Update spam_accounts to add total_engagements field
-- ============================================================================
ALTER TABLE spam_accounts ADD COLUMN IF NOT EXISTS total_engagements INTEGER DEFAULT 0;

-- ============================================================================
-- Update proxies table to add test_status field
-- ============================================================================
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS test_status TEXT CHECK (test_status IN ('success', 'failed', 'pending')) DEFAULT 'pending';
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_engagement_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Twitter Apps policies (recreated after DROP)
ALTER TABLE twitter_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own twitter apps"
  ON twitter_apps FOR ALL
  USING (auth.uid() = user_id);

-- Post Templates policies
CREATE POLICY "Users can manage their own post templates"
  ON post_templates FOR ALL
  USING (auth.uid() = user_id);

-- Post Template Items policies
CREATE POLICY "Users can manage their own post template items"
  ON post_template_items FOR ALL
  USING (auth.uid() = user_id);

-- CTA Templates policies
CREATE POLICY "Users can manage their own cta templates"
  ON cta_templates FOR ALL
  USING (auth.uid() = user_id);

-- Auto Engagement Executions policies
CREATE POLICY "Users can view their own engagement executions"
  ON auto_engagement_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own engagement executions"
  ON auto_engagement_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Loop Executions policies
CREATE POLICY "Users can view their own loop executions"
  ON loop_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loop executions"
  ON loop_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- OAuth Sessions policies
CREATE POLICY "Users can manage their own oauth sessions"
  ON oauth_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Rate Limits policies
CREATE POLICY "Users can view their own rate limits"
  ON rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own rate limits"
  ON rate_limits FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at Triggers
-- ============================================================================

-- Apply triggers to new tables
CREATE TRIGGER update_post_templates_updated_at BEFORE UPDATE ON post_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_template_items_updated_at BEFORE UPDATE ON post_template_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_templates_updated_at BEFORE UPDATE ON cta_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Recreate twitter_apps trigger since we dropped the table
CREATE TRIGGER update_twitter_apps_updated_at BEFORE UPDATE ON twitter_apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Cleanup: Auto-expire old oauth_sessions (optional)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- You can call this periodically via cron or pg_cron extension


-- ========================================
-- Migration 3: Bulk Post Queue
-- ========================================


-- XLO System - Bulk Post Queue Table
-- Created: 2025-11-12
-- Purpose: Add bulk_post_queue table for Stage3 implementation

-- ============================================================================
-- bulk_post_queue - 一括投稿キュー
-- ============================================================================
CREATE TABLE bulk_post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template Reference
  template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL,

  -- Content Configuration
  use_template_items BOOLEAN DEFAULT true,
  use_cta BOOLEAN DEFAULT false,
  cta_template_id UUID REFERENCES cta_templates(id) ON DELETE SET NULL,

  -- Generated Content (after generation)
  generated_content TEXT,

  -- Execution Target
  target_account_id UUID,
  target_x_user_id TEXT,

  -- Status Management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  -- Error Handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  error_json JSONB,

  -- Twitter Response
  tweet_id TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_post_queue_user_id ON bulk_post_queue(user_id);
CREATE INDEX idx_bulk_post_queue_status ON bulk_post_queue(status);
CREATE INDEX idx_bulk_post_queue_scheduled_at ON bulk_post_queue(scheduled_at);
CREATE INDEX idx_bulk_post_queue_next_retry_at ON bulk_post_queue(next_retry_at);
CREATE INDEX idx_bulk_post_queue_template_id ON bulk_post_queue(template_id);
CREATE INDEX idx_bulk_post_queue_priority ON bulk_post_queue(priority DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE bulk_post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bulk post queue"
  ON bulk_post_queue FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at Trigger
-- ============================================================================

CREATE TRIGGER update_bulk_post_queue_updated_at BEFORE UPDATE ON bulk_post_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Function: Get next pending posts with lock
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_bulk_posts(
  p_user_id UUID,
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF bulk_post_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM bulk_post_queue
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  ORDER BY priority DESC, created_at ASC
  LIMIT p_batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- Migration 4: Hardening
-- ========================================


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
