-- 現在の状態確認（事実のみ）
-- Supabase SQL Editor で実行
-- https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor

-- ==========================================
-- 1. 実行履歴（全件）
-- ==========================================
SELECT
  COUNT(*) as total_rows,
  MAX(executed_at) as most_recent_execution
FROM auto_engagement_executions;

-- ==========================================
-- 2. 過去30分の実行履歴詳細
-- ==========================================
SELECT
  executed_at,
  rule_id,
  success,
  action_type,
  actions_attempted,
  actions_succeeded,
  actions_failed,
  error_message,
  used_account_ids,
  trace_id
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '30 minutes'
ORDER BY executed_at DESC;

-- ==========================================
-- 3. アクティブなルールの実行条件
-- ==========================================
SELECT
  id,
  rule_name,
  is_active,
  search_type,
  search_query,
  action_type,
  next_execution_at,
  last_executed_at,
  execution_frequency_minutes,
  CASE
    WHEN next_execution_at IS NULL THEN '⚪ next_execution_at が NULL'
    WHEN next_execution_at > NOW() THEN '⏳ 実行待ち (' || EXTRACT(MINUTE FROM (next_execution_at - NOW())) || '分後)'
    ELSE '✅ 実行可能'
  END as execution_status,
  executor_account_ids,
  CASE
    WHEN search_query IS NULL OR search_query = '' THEN '❌ search_query が空'
    ELSE '✅ search_query あり'
  END as query_status
FROM auto_engagement_rules
WHERE is_active = true
ORDER BY created_at DESC;

-- ==========================================
-- 4. Cron 実行履歴（過去30分）
-- ==========================================
SELECT
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname = 'execute-auto-engagement-every-5-min'
     OR command LIKE '%execute-auto-engagement%'
)
  AND start_time > NOW() - INTERVAL '30 minutes'
ORDER BY start_time DESC
LIMIT 10;

-- ==========================================
-- 5. アクティブな実行可能アカウント
-- ==========================================
SELECT
  id,
  x_username,
  account_type,
  is_active,
  token_type,
  expires_at,
  CASE
    WHEN expires_at < NOW() THEN '❌ 期限切れ'
    WHEN expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ まもなく期限切れ'
    ELSE '✅ 有効'
  END as expiry_status
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
ORDER BY expires_at ASC
LIMIT 5;
