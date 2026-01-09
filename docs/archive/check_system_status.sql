-- システム状態の総合確認（正しいテーブル名）
-- Supabase SQL Editor で実行してください

-- ==========================================
-- 1. アクティブなトークン数
-- ==========================================
SELECT
  account_type,
  COUNT(*) as active_count,
  STRING_AGG(x_username, ', ' ORDER BY x_username) as usernames
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
GROUP BY account_type
ORDER BY account_type;

-- ==========================================
-- 2. エンゲージメントルールの状態
-- ==========================================
SELECT
  COUNT(*) as total_rules,
  COUNT(*) FILTER (WHERE is_active = true) as active_rules,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_rules
FROM auto_engagement_rules;

-- アクティブなルールの詳細
SELECT
  id,
  rule_name,
  action_type,
  search_type,
  is_active,
  created_at,
  updated_at
FROM auto_engagement_rules
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 10;

-- ==========================================
-- 3. Cron ジョブの確認
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
-- 4. 総合ステータス
-- ==========================================
WITH token_status AS (
  SELECT
    COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
  FROM account_tokens
  WHERE token_type = 'oauth2'
),
rule_status AS (
  SELECT
    COUNT(*) as total_rules,
    COUNT(*) FILTER (WHERE is_active = true) as active_rules
  FROM auto_engagement_rules
),
exec_status AS (
  SELECT
    COUNT(*) as total_executions,
    MAX(executed_at) as last_execution
  FROM auto_engagement_executions
),
cron_status AS (
  SELECT
    COUNT(*) as total_cron_jobs,
    COUNT(*) FILTER (WHERE active = true) as active_cron_jobs
  FROM cron.job
  WHERE jobname LIKE '%engagement%' OR command LIKE '%engagement%'
)
SELECT
  '🔹 トークン' as category,
  CASE
    WHEN ts.active_tokens = 0 THEN '🚨 アクティブなトークンなし'
    WHEN ts.active_tokens < 3 THEN '⚠️ アクティブ ' || ts.active_tokens || '件（少数）'
    ELSE '✅ アクティブ ' || ts.active_tokens || '件'
  END as status,
  'Inactive: ' || ts.inactive_tokens || '件' as detail
FROM token_status ts
UNION ALL
SELECT
  '🔹 エンゲージメントルール',
  CASE
    WHEN rs.total_rules = 0 THEN '⚪ ルール未作成'
    WHEN rs.active_rules = 0 THEN '⚠️ ルールあり（すべて無効）'
    ELSE '✅ アクティブ ' || rs.active_rules || '件'
  END,
  'Total: ' || rs.total_rules || '件'
FROM rule_status rs
UNION ALL
SELECT
  '🔹 実行履歴',
  CASE
    WHEN es.total_executions = 0 THEN '⚪ 実行履歴なし'
    ELSE '✅ ' || es.total_executions || '件実行済み'
  END,
  'Last: ' || COALESCE(es.last_execution::text, 'N/A')
FROM exec_status es
UNION ALL
SELECT
  '🔹 Cron ジョブ',
  CASE
    WHEN cs.total_cron_jobs = 0 THEN '⚪ Cron 未設定'
    WHEN cs.active_cron_jobs = 0 THEN '⚠️ Cron あり（すべて無効）'
    ELSE '✅ アクティブ ' || cs.active_cron_jobs || '件'
  END,
  'Total: ' || cs.total_cron_jobs || '件'
FROM cron_status cs;

-- ==========================================
-- 5. 最近無効化されたトークン
-- ==========================================
SELECT
  x_username,
  account_type,
  error_message,
  expires_at,
  updated_at
FROM account_tokens
WHERE is_active = false
  AND token_type = 'oauth2'
ORDER BY updated_at DESC
LIMIT 5;
