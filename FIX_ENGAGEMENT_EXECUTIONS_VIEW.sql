-- ============================================================================
-- Fix v_recent_engagement_executions view
-- Problem: View may not exist or has incorrect column references
-- ============================================================================

-- Drop and recreate the view with corrected column references
CREATE OR REPLACE VIEW v_recent_engagement_executions AS
SELECT
  e.id,
  e.rule_id,
  COALESCE(r.name, r.rule_name) as rule_name,
  r.search_type,
  r.action_types,
  e.executed_at,
  e.status,
  e.actions_attempted,
  e.actions_succeeded,
  e.actions_failed,
  e.trace_id,
  e.error_message,
  e.searched_count,
  e.filtered_count,
  e.used_account_ids,
  e.target_tweet_ids,
  e.target_user_ids
FROM auto_engagement_executions e
LEFT JOIN auto_engagement_rules r ON r.id = e.rule_id
ORDER BY e.executed_at DESC
LIMIT 100;

-- Create daily engagement stats view
CREATE OR REPLACE VIEW v_engagement_daily_stats AS
SELECT
  r.id as rule_id,
  COALESCE(r.name, r.rule_name) as rule_name,
  r.search_type,
  DATE(e.executed_at) as execution_date,
  COUNT(*) as executions_count,
  SUM(e.actions_attempted) as total_actions_attempted,
  SUM(e.actions_succeeded) as total_actions_succeeded,
  SUM(e.actions_failed) as total_actions_failed,
  SUM(e.searched_count) as total_searched,
  SUM(e.filtered_count) as total_filtered
FROM auto_engagement_executions e
JOIN auto_engagement_rules r ON r.id = e.rule_id
WHERE e.executed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY r.id, COALESCE(r.name, r.rule_name), r.search_type, DATE(e.executed_at)
ORDER BY execution_date DESC, rule_id;

-- Verification
SELECT 'v_recent_engagement_executions' as view_name,
       CASE WHEN EXISTS (
         SELECT FROM information_schema.views
         WHERE table_name = 'v_recent_engagement_executions'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

SELECT 'v_engagement_daily_stats' as view_name,
       CASE WHEN EXISTS (
         SELECT FROM information_schema.views
         WHERE table_name = 'v_engagement_daily_stats'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

SELECT '✅ Engagement execution views fixed!' as result;
