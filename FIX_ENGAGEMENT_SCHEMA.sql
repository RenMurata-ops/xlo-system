-- ============================================================================
-- Fix auto_engagement_rules schema - Add ALL missing columns
-- Date: 2025-12-17
-- Issue: Multiple columns are missing from the initial schema
-- ============================================================================

-- Add allowed_account_tags column
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS allowed_account_tags TEXT[];

-- Add daily_limit column (CRITICAL - was in comment but not in error)
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 100;

-- Add action tracking columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS actions_today INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add execution timing columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMPTZ;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMPTZ;

-- Add statistics columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS total_actions_count INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

-- Add action_types column for multiple actions support
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS action_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add advanced search filter columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_since TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_until TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_retweets INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_retweets INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_faves INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_faves INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS min_replies INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_replies INTEGER;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS has_engagement BOOLEAN DEFAULT false;

-- Add execution settings columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS max_actions_per_execution INTEGER DEFAULT 10;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS execution_interval_hours INTEGER DEFAULT 1;

-- Add columns from initial schema that might be missing
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_type TEXT CHECK (search_type IN ('keyword', 'url', 'user', 'hashtag'));

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS search_query TEXT;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS exclude_keywords TEXT[];

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS exclude_verified BOOLEAN DEFAULT false;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS require_verified BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN auto_engagement_rules.allowed_account_tags IS 'Filter executor accounts by tags (OR logic)';
COMMENT ON COLUMN auto_engagement_rules.action_types IS 'Array of action types to perform: like, reply, retweet, follow';
COMMENT ON COLUMN auto_engagement_rules.actions_today IS 'Number of actions performed today';
COMMENT ON COLUMN auto_engagement_rules.daily_limit IS 'Maximum actions allowed per day';

-- Verify ALL critical columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN (
    'allowed_account_tags',
    'daily_limit',
    'action_types',
    'actions_today',
    'max_actions_per_execution',
    'execution_interval_hours',
    'search_type',
    'search_query'
  )
ORDER BY column_name;

-- ============================================================================
-- Expected result: All 8 columns should be listed with their types
-- ============================================================================
