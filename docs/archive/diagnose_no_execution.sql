-- エンゲージメント未実行の原因診断
-- Supabase SQL Editor で実行してください

-- ==========================================
-- 1. Cron ジョブの詳細（スケジュール確認）
-- ==========================================
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE '%engagement%'
   OR command LIKE '%engagement%'
ORDER BY jobid;

-- ==========================================
-- 2. アクティブなエンゲージメントルールの詳細
-- ==========================================
SELECT
  id,
  rule_name,
  action_type,
  search_type,
  search_query,
  max_actions_per_execution,
  max_accounts_per_run,
  daily_limit,
  execution_frequency_minutes,
  is_active,
  last_executed_at,
  next_execution_at,
  created_at,
  updated_at
FROM auto_engagement_rules
WHERE is_active = true
ORDER BY created_at DESC;

-- ==========================================
-- 3. Cron 実行ログ（最近の実行履歴）
-- ==========================================
SELECT
  runid,
  jobid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname LIKE '%engagement%' OR command LIKE '%engagement%'
)
ORDER BY start_time DESC
LIMIT 10;

-- ==========================================
-- 4. 現在時刻とスケジュールの比較
-- ==========================================
WITH cron_info AS (
  SELECT
    jobid,
    jobname,
    schedule,
    active
  FROM cron.job
  WHERE jobname LIKE '%engagement%' OR command LIKE '%engagement%'
)
SELECT
  jobname,
  schedule,
  active,
  NOW() as current_time,
  -- 次回実行予定時刻（PostgreSQL の cron 拡張機能）
  CASE
    WHEN schedule LIKE '% % % % %' THEN '⏰ 標準 Cron 形式: ' || schedule
    ELSE '❓ 形式不明: ' || schedule
  END as schedule_info
FROM cron_info;

-- ==========================================
-- 5. 総合診断
-- ==========================================
WITH diagnostics AS (
  SELECT
    (SELECT COUNT(*) FROM account_tokens WHERE is_active = true AND token_type = 'oauth2') as active_tokens,
    (SELECT COUNT(*) FROM auto_engagement_rules WHERE is_active = true) as active_rules,
    (SELECT COUNT(*) FROM cron.job WHERE (jobname LIKE '%engagement%' OR command LIKE '%engagement%') AND active = true) as active_cron_jobs,
    (SELECT COUNT(*) FROM auto_engagement_executions) as total_executions,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%engagement%' OR command LIKE '%engagement%')) as cron_run_count
)
SELECT
  '診断結果' as category,
  CASE
    WHEN d.active_tokens = 0 THEN '🚨 トークンなし'
    WHEN d.active_rules = 0 THEN '🚨 ルールなし'
    WHEN d.active_cron_jobs = 0 THEN '🚨 Cron 無効'
    WHEN d.cron_run_count = 0 THEN '⚠️ Cron 未実行（スケジュール待ち？）'
    WHEN d.total_executions = 0 THEN '⚠️ Cron 実行済みだがエンゲージメント実行なし（エラー？）'
    ELSE '✅ 正常'
  END as status,
  jsonb_build_object(
    'tokens', d.active_tokens,
    'rules', d.active_rules,
    'cron_jobs', d.active_cron_jobs,
    'executions', d.total_executions,
    'cron_runs', d.cron_run_count
  ) as details
FROM diagnostics d;
