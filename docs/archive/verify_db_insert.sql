-- DB 記録確認
-- Supabase SQL Editor で実行
-- https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor

-- trace_id で検索
SELECT
  id,
  rule_id,
  executed_at,
  success,
  action_type,
  executor_account_id,
  actions_attempted,
  actions_succeeded,
  actions_failed,
  error_message,
  trace_id
FROM auto_engagement_executions
WHERE trace_id = 'fe6fe436-711b-49d8-ad03-1356485a02ed'
ORDER BY executed_at DESC;

-- 全件確認
SELECT
  COUNT(*) as total_rows,
  MAX(executed_at) as most_recent
FROM auto_engagement_executions;

-- 過去10分の履歴
SELECT
  id,
  executed_at,
  success,
  action_type,
  actions_attempted,
  actions_succeeded,
  trace_id
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '10 minutes'
ORDER BY executed_at DESC;
