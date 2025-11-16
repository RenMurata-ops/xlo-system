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
