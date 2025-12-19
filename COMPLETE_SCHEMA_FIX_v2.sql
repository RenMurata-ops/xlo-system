-- ============================================================================
-- XLO System - Complete Schema Fix v2
-- Date: 2025-12-17
-- Purpose: Add ALL missing columns to ALL tables (Fixed version)
-- ============================================================================

-- ============================================================================
-- Part 1: Fix auto_engagement_rules table
-- ============================================================================
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS search_type TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS search_query TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS allowed_account_tags TEXT[];
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS max_actions_per_execution INTEGER DEFAULT 10;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS execution_interval_hours INTEGER DEFAULT 1;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 100;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS actions_today INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMPTZ;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS total_actions_count INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS exclude_verified BOOLEAN DEFAULT false;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS require_verified BOOLEAN DEFAULT false;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS min_account_age_days INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS search_since TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS search_until TEXT;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS min_retweets INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS max_retweets INTEGER;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS min_faves INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS max_faves INTEGER;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS min_replies INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS max_replies INTEGER;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS has_engagement BOOLEAN DEFAULT false;
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS action_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate action_type to action_types
UPDATE auto_engagement_rules
SET action_types = ARRAY[action_type]::TEXT[]
WHERE action_type IS NOT NULL
  AND (action_types IS NULL OR action_types = ARRAY[]::TEXT[]);

-- ============================================================================
-- Part 2: Fix loops table
-- ============================================================================
ALTER TABLE loops ADD COLUMN IF NOT EXISTS loop_type TEXT DEFAULT 'post';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS template_ids UUID[] DEFAULT '{}';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS selection_mode TEXT DEFAULT 'random';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS last_used_template_index INTEGER DEFAULT 0;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS target_value TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 1;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS monitor_account_handle TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS last_processed_tweet_id TEXT;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS min_accounts INTEGER DEFAULT 1;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS max_accounts INTEGER DEFAULT 5;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS execution_interval_minutes INTEGER DEFAULT 60;

-- Migrate from hours to minutes if needed
UPDATE loops
SET execution_interval_minutes = execution_interval_hours * 60
WHERE execution_interval_minutes IS NULL
  AND execution_interval_hours IS NOT NULL;

-- ============================================================================
-- Part 3: Fix posts table
-- ============================================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS in_reply_to_tweet_id TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_in_reply_to_tweet_id
ON posts(in_reply_to_tweet_id)
WHERE in_reply_to_tweet_id IS NOT NULL;

-- ============================================================================
-- Part 4: Ensure templates table exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('post', 'reply', 'cta')),
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Part 5: Fix auto_engagement_executions table
-- ============================================================================
-- First, add missing columns to existing table
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid();
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS searched_count INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS filtered_count INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS actions_attempted INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS actions_succeeded INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS actions_failed INTEGER DEFAULT 0;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS used_account_ids UUID[];
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS target_tweet_ids TEXT[];
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS target_user_ids TEXT[];
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS exec_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE auto_engagement_executions ADD COLUMN IF NOT EXISTS error_json JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_trace_id ON auto_engagement_executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_executed_at ON auto_engagement_executions(executed_at DESC);

-- ============================================================================
-- Part 6: Verification
-- ============================================================================
SELECT
  'auto_engagement_rules' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules';

SELECT
  'loops' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'loops';

SELECT
  'templates' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'templates';

SELECT
  'posts' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'posts';

SELECT
  'auto_engagement_executions' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'auto_engagement_executions';

SELECT '✅ Schema fix completed successfully!' as status;
