-- ============================================================================
-- XLO System - Complete Schema Fix
-- Date: 2025-12-17
-- Purpose: Add ALL missing columns to ALL tables (Idempotent)
-- ============================================================================
-- This SQL is safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ============================================================================

-- ============================================================================
-- Part 1: Fix auto_engagement_rules table
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Fixing auto_engagement_rules table ==========';
END $$;

-- Add columns from 20251116_auto_engagement.sql
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_type TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_query TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS allowed_account_tags TEXT[];

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_actions_per_execution INTEGER DEFAULT 10;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS execution_interval_hours INTEGER DEFAULT 1;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 100;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS actions_today INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMPTZ;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS total_actions_count INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS exclude_verified BOOLEAN DEFAULT false;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS require_verified BOOLEAN DEFAULT false;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_account_age_days INTEGER DEFAULT 0;

-- Add columns from 20251119000003_add_advanced_search_filters.sql
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_since TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_until TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_retweets INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_retweets INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_faves INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_faves INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_replies INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_replies INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS has_engagement BOOLEAN DEFAULT false;

-- Add columns from 20251120000001_modify_engagement_actions.sql
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS action_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate action_type to action_types if needed
UPDATE auto_engagement_rules
SET action_types = ARRAY[action_type]::TEXT[]
WHERE action_type IS NOT NULL
  AND (action_types IS NULL OR action_types = ARRAY[]::TEXT[]);

-- Drop old constraint if exists
ALTER TABLE auto_engagement_rules
DROP CONSTRAINT IF EXISTS auto_engagement_rules_action_type_check;

-- Add new constraint for action_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auto_engagement_rules_action_types_check'
  ) THEN
    ALTER TABLE auto_engagement_rules ADD CONSTRAINT auto_engagement_rules_action_types_check
      CHECK (
        action_types IS NULL OR
        (action_types <@ ARRAY['like', 'reply', 'retweet', 'follow']::TEXT[] AND
         array_length(action_types, 1) > 0)
      );
  END IF;
END $$;

-- ============================================================================
-- Part 2: Fix loops table
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Fixing loops table ==========';
END $$;

-- Add columns from 20251120000002_enhance_loops_three_types.sql
ALTER TABLE loops
ADD COLUMN IF NOT EXISTS loop_type TEXT DEFAULT 'post';

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS template_ids UUID[] DEFAULT '{}';

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS selection_mode TEXT DEFAULT 'random';

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS last_used_template_index INTEGER DEFAULT 0;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS target_type TEXT;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS target_value TEXT;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 1;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS monitor_account_handle TEXT;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS last_processed_tweet_id TEXT;

-- Rename columns if old names exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loops' AND column_name = 'min_account_count'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loops' AND column_name = 'min_accounts'
  ) THEN
    ALTER TABLE loops RENAME COLUMN min_account_count TO min_accounts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loops' AND column_name = 'max_account_count'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loops' AND column_name = 'max_accounts'
  ) THEN
    ALTER TABLE loops RENAME COLUMN max_account_count TO max_accounts;
  END IF;
END $$;

-- Add min_accounts and max_accounts if they don't exist
ALTER TABLE loops
ADD COLUMN IF NOT EXISTS min_accounts INTEGER DEFAULT 1;

ALTER TABLE loops
ADD COLUMN IF NOT EXISTS max_accounts INTEGER DEFAULT 5;

-- Drop old constraints and add new ones
ALTER TABLE loops
DROP CONSTRAINT IF EXISTS loops_loop_type_check;

ALTER TABLE loops
DROP CONSTRAINT IF EXISTS loops_selection_mode_check;

ALTER TABLE loops
DROP CONSTRAINT IF EXISTS loops_target_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loops_loop_type_check'
  ) THEN
    ALTER TABLE loops ADD CONSTRAINT loops_loop_type_check
      CHECK (loop_type IN ('post', 'reply', 'cta'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loops_selection_mode_check'
  ) THEN
    ALTER TABLE loops ADD CONSTRAINT loops_selection_mode_check
      CHECK (selection_mode IN ('random', 'sequential'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loops_target_type_check'
  ) THEN
    ALTER TABLE loops ADD CONSTRAINT loops_target_type_check
      CHECK (target_type IS NULL OR target_type IN ('search', 'account_url', 'tweet_url'));
  END IF;
END $$;

-- Add execution_interval_minutes from 20251119000008
ALTER TABLE loops
ADD COLUMN IF NOT EXISTS execution_interval_minutes INTEGER DEFAULT 60;

-- Migrate from hours to minutes if needed
UPDATE loops
SET execution_interval_minutes = execution_interval_hours * 60
WHERE execution_interval_minutes IS NULL
  AND execution_interval_hours IS NOT NULL;

-- ============================================================================
-- Part 3: Fix posts table
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Fixing posts table ==========';
END $$;

-- Add in_reply_to_tweet_id from 20251217_add_in_reply_to_tweet_id.sql
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS in_reply_to_tweet_id TEXT;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_posts_in_reply_to_tweet_id
ON posts(in_reply_to_tweet_id)
WHERE in_reply_to_tweet_id IS NOT NULL;

-- ============================================================================
-- Part 4: Ensure templates table exists
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Ensuring templates table exists ==========';
END $$;

-- Create templates table if it doesn't exist
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);

-- Enable RLS if not already enabled
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Create policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'templates' AND policyname = 'templates_user_policy'
  ) THEN
    CREATE POLICY templates_user_policy
      ON templates FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_templates_updated_at
      BEFORE UPDATE ON templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Part 5: Ensure auto_engagement_executions table exists
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Ensuring auto_engagement_executions table exists ==========';
END $$;

CREATE TABLE IF NOT EXISTS auto_engagement_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES auto_engagement_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  trace_id UUID DEFAULT gen_random_uuid(),
  searched_count INTEGER DEFAULT 0,
  filtered_count INTEGER DEFAULT 0,
  actions_attempted INTEGER DEFAULT 0,
  actions_succeeded INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  used_account_ids UUID[],
  target_tweet_ids TEXT[],
  target_user_ids TEXT[],
  exec_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_json JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_rule_id ON auto_engagement_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_user_id ON auto_engagement_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_executed_at ON auto_engagement_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_trace_id ON auto_engagement_executions(trace_id);

-- Enable RLS
ALTER TABLE auto_engagement_executions ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_engagement_executions'
      AND policyname = 'Users can view their own engagement executions'
  ) THEN
    CREATE POLICY "Users can view their own engagement executions"
      ON auto_engagement_executions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_engagement_executions'
      AND policyname = 'Service role can insert engagement executions'
  ) THEN
    CREATE POLICY "Service role can insert engagement executions"
      ON auto_engagement_executions FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Part 6: Add comments for documentation
-- ============================================================================
COMMENT ON COLUMN auto_engagement_rules.allowed_account_tags IS 'Filter executor accounts by tags (OR logic)';
COMMENT ON COLUMN auto_engagement_rules.action_types IS 'Array of action types to perform: like, reply, retweet, follow';
COMMENT ON COLUMN auto_engagement_rules.actions_today IS 'Number of actions performed today';
COMMENT ON COLUMN auto_engagement_rules.daily_limit IS 'Maximum actions allowed per day';
COMMENT ON COLUMN auto_engagement_rules.search_since IS 'X search: since:YYYY-MM-DD - Filter tweets from this date';
COMMENT ON COLUMN auto_engagement_rules.search_until IS 'X search: until:YYYY-MM-DD - Filter tweets until this date';

COMMENT ON COLUMN loops.loop_type IS 'Type of loop: post (投稿ループ), reply (リプライループ), cta (CTAループ)';
COMMENT ON COLUMN loops.template_ids IS 'Array of template IDs to use (multiple selection supported)';
COMMENT ON COLUMN loops.selection_mode IS 'Template selection mode: random or sequential';
COMMENT ON COLUMN loops.execution_interval_minutes IS 'Execution interval in minutes (1-10080)';

COMMENT ON COLUMN posts.in_reply_to_tweet_id IS 'Twitter/X tweet ID that this post is replying to (for reply loops)';

-- ============================================================================
-- Part 7: Verification - Show what was fixed
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========== Schema Fix Complete ==========';
  RAISE NOTICE 'Run COMPLETE_SCHEMA_VERIFICATION.sql to verify all columns are present';
END $$;

-- Quick verification of critical columns
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

SELECT '✅ Schema fix completed successfully!' as status;
