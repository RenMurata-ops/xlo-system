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
