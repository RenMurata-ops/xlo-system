-- 修正確認クエリ
-- Supabase SQL Editor で実行してください
-- https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor

-- ==========================================
-- 1. 過去10分間の実行履歴
-- ==========================================
SELECT
  id,
  rule_id,
  executed_at,
  success,
  action_type,
  actions_attempted,
  actions_succeeded,
  actions_failed,
  searched_count,
  filtered_count,
  used_account_ids,
  error_message
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '10 minutes'
ORDER BY executed_at DESC;

-- ==========================================
-- 2. 統計（過去10分間）
-- ==========================================
SELECT
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  MAX(executed_at) as last_execution
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '10 minutes';

-- ==========================================
-- 3. トータル統計（全期間）
-- ==========================================
SELECT
  COUNT(*) as total_all_time,
  COUNT(*) FILTER (WHERE success = true) as successful_all_time,
  COUNT(*) FILTER (WHERE success = false) as failed_all_time,
  MAX(executed_at) as most_recent
FROM auto_engagement_executions;
