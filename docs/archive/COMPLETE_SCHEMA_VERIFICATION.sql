-- ============================================================================
-- XLO System - Complete Schema Verification
-- Date: 2025-12-17
-- Purpose: Identify ALL missing columns in production database
-- ============================================================================

-- ============================================================================
-- Part 1: Verify all tables exist
-- ============================================================================
SELECT
  'ALL_TABLES' as check_name,
  string_agg(table_name, ', ' ORDER BY table_name) as tables_found
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- ============================================================================
-- Part 2: account_tokens - Verify all columns exist
-- ============================================================================
SELECT
  'account_tokens_columns' as check_name,
  COUNT(*) as total_columns,
  string_agg(column_name, ', ' ORDER BY column_name) as columns_found
FROM information_schema.columns
WHERE table_name = 'account_tokens';

-- Expected columns (from initial schema):
-- id, user_id, account_type, account_id, access_token, access_token_secret,
-- refresh_token, token_type, expires_at, scope, x_user_id, x_username,
-- display_name, twitter_display_name, profile_image_url, followers_count,
-- following_count, is_active, is_verified, is_suspended, suspended_at,
-- suspended_reason, last_refreshed_at, refresh_count, error_message,
-- created_at, updated_at

SELECT
  'MISSING: account_tokens' as issue,
  column_name as missing_column
FROM (VALUES
  ('id'), ('user_id'), ('account_type'), ('account_id'), ('access_token'),
  ('access_token_secret'), ('refresh_token'), ('token_type'), ('expires_at'),
  ('scope'), ('x_user_id'), ('x_username'), ('display_name'),
  ('twitter_display_name'), ('profile_image_url'), ('followers_count'),
  ('following_count'), ('is_active'), ('is_verified'), ('is_suspended'),
  ('suspended_at'), ('suspended_reason'), ('last_refreshed_at'),
  ('refresh_count'), ('error_message'), ('created_at'), ('updated_at')
) AS expected(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'account_tokens'
    AND columns.column_name = expected.column_name
);

-- ============================================================================
-- Part 3: auto_engagement_rules - Verify all columns exist
-- ============================================================================
SELECT
  'auto_engagement_rules_columns' as check_name,
  COUNT(*) as total_columns,
  string_agg(column_name, ', ' ORDER BY column_name) as columns_found
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules';

-- Check for missing columns in auto_engagement_rules
SELECT
  'MISSING: auto_engagement_rules' as issue,
  column_name as missing_column
FROM (VALUES
  -- From initial schema
  ('id'), ('user_id'), ('rule_name'), ('rule_type'), ('is_active'),
  ('search_keywords'), ('exclude_keywords'), ('target_urls'), ('target_user_ids'),
  ('min_followers'), ('max_followers'), ('account_age_days'), ('action_type'),
  ('like_strategy'), ('likes_per_follower'), ('reply_template_id'),
  ('executor_account_ids'), ('account_selection_mode'), ('max_accounts_per_run'),
  ('execution_frequency_minutes'), ('detection_delay_minutes'),
  ('max_executions_per_hour'), ('schedule_enabled'), ('schedule_days_of_week'),
  ('schedule_hours'), ('auto_unfollow_enabled'), ('unfollow_after_days'),
  ('last_execution_at'), ('total_executions'), ('success_count'), ('error_count'),
  ('created_at'), ('updated_at'),
  -- From 20251116_auto_engagement.sql
  ('name'), ('description'), ('search_type'), ('search_query'),
  ('allowed_account_tags'), ('max_actions_per_execution'), ('execution_interval_hours'),
  ('daily_limit'), ('actions_today'), ('last_daily_reset'),
  ('next_execution_at'), ('total_actions_count'), ('failure_count'),
  ('exclude_verified'), ('require_verified'),
  -- From 20251119000003_add_advanced_search_filters.sql
  ('search_since'), ('search_until'), ('min_retweets'), ('max_retweets'),
  ('min_faves'), ('max_faves'), ('min_replies'), ('max_replies'), ('has_engagement'),
  -- From 20251120000001_modify_engagement_actions.sql
  ('action_types')
) AS expected(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'auto_engagement_rules'
    AND columns.column_name = expected.column_name
);

-- ============================================================================
-- Part 4: loops - Verify all columns exist
-- ============================================================================
SELECT
  'loops_columns' as check_name,
  COUNT(*) as total_columns,
  string_agg(column_name, ', ' ORDER BY column_name) as columns_found
FROM information_schema.columns
WHERE table_name = 'loops';

SELECT
  'MISSING: loops' as issue,
  column_name as missing_column
FROM (VALUES
  -- From initial schema
  ('id'), ('user_id'), ('loop_name'), ('description'), ('is_active'),
  ('execution_interval_hours'), ('min_account_count'), ('max_account_count'),
  ('executor_account_ids'), ('allowed_account_tags'), ('reply_template_id'),
  ('reply_delay_min_minutes'), ('reply_delay_max_minutes'),
  ('jitter_min_minutes'), ('jitter_max_minutes'), ('last_execution_at'),
  ('next_execution_at'), ('post_count'), ('tags'), ('created_at'), ('updated_at'),
  -- From 20251120000002_enhance_loops_three_types.sql
  ('loop_type'), ('template_ids'), ('selection_mode'), ('last_used_template_index'),
  ('target_type'), ('target_value'), ('execution_count'),
  ('monitor_account_handle'), ('last_processed_tweet_id'),
  ('min_accounts'), ('max_accounts'),
  -- From 20251119000008_add_loop_interval_minutes.sql
  ('execution_interval_minutes')
) AS expected(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'loops'
    AND columns.column_name = expected.column_name
);

-- ============================================================================
-- Part 5: templates - Verify table and columns exist
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'templates')
    THEN 'templates table exists'
    ELSE '❌ CRITICAL: templates table does NOT exist'
  END as templates_table_check;

SELECT
  'templates_columns' as check_name,
  COUNT(*) as total_columns,
  string_agg(column_name, ', ' ORDER BY column_name) as columns_found
FROM information_schema.columns
WHERE table_name = 'templates';

SELECT
  'MISSING: templates' as issue,
  column_name as missing_column
FROM (VALUES
  ('id'), ('user_id'), ('template_name'), ('template_type'), ('content'),
  ('variables'), ('category'), ('tags'), ('usage_count'), ('is_active'),
  ('created_at'), ('updated_at')
) AS expected(column_name)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'templates')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates'
      AND columns.column_name = expected.column_name
  );

-- ============================================================================
-- Part 6: posts - Verify critical columns
-- ============================================================================
SELECT
  'posts_columns' as check_name,
  COUNT(*) as total_columns,
  string_agg(column_name, ', ' ORDER BY column_name) as columns_found
FROM information_schema.columns
WHERE table_name = 'posts';

SELECT
  'MISSING: posts' as issue,
  column_name as missing_column
FROM (VALUES
  -- From initial schema
  ('id'), ('user_id'), ('account_id'), ('content'), ('media_urls'),
  ('scheduled_at'), ('posted_at'), ('tweet_id'), ('engagement_count'),
  ('status'), ('error_message'), ('tags'), ('created_at'), ('updated_at'),
  -- From 20251217_add_in_reply_to_tweet_id.sql
  ('in_reply_to_tweet_id')
) AS expected(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'posts'
    AND columns.column_name = expected.column_name
);

-- ============================================================================
-- Part 7: Check for old deprecated tables
-- ============================================================================
SELECT
  'deprecated_table_check' as check_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_templates')
    THEN '❌ WARNING: post_templates table still exists (should be migrated to templates)'
    ELSE '✅ OK: post_templates table removed'
  END as result;

-- ============================================================================
-- Part 8: Verify auto_engagement_executions table exists
-- ============================================================================
SELECT
  'auto_engagement_executions' as check_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auto_engagement_executions')
    THEN 'table exists'
    ELSE '❌ CRITICAL: auto_engagement_executions table does NOT exist'
  END as result;

-- ============================================================================
-- Summary: Critical columns check
-- ============================================================================
SELECT
  '========== CRITICAL COLUMNS SUMMARY ==========' as summary_section;

-- Most critical columns for token refresh
SELECT
  'CRITICAL for token_refresh' as category,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'account_tokens'
        AND column_name IN (
          'access_token', 'refresh_token', 'expires_at',
          'last_refreshed_at', 'refresh_count', 'is_active'
        )
      HAVING COUNT(*) = 6
    )
    THEN '✅ All token refresh columns present'
    ELSE '❌ MISSING token refresh columns'
  END as status;

-- Most critical columns for engagement
SELECT
  'CRITICAL for auto_engagement' as category,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'auto_engagement_rules'
        AND column_name IN (
          'allowed_account_tags', 'daily_limit', 'action_types',
          'actions_today', 'max_actions_per_execution',
          'execution_interval_hours', 'search_type', 'search_query'
        )
      HAVING COUNT(*) = 8
    )
    THEN '✅ All engagement columns present'
    ELSE '❌ MISSING engagement columns'
  END as status;

-- Most critical columns for loops
SELECT
  'CRITICAL for loops' as category,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'loops'
        AND column_name IN (
          'loop_type', 'template_ids', 'selection_mode',
          'last_used_template_index', 'execution_interval_minutes'
        )
      HAVING COUNT(*) = 5
    )
    THEN '✅ All loop columns present'
    ELSE '❌ MISSING loop columns'
  END as status;

-- ============================================================================
-- Expected Result: This will show ALL missing columns grouped by table
-- If no missing columns are shown, schema is complete and consistent
-- ============================================================================
