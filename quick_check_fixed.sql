-- クイック確認クエリ（修正版 - 正しいスキーマ対応）
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
-- 2. 過去24時間の実行統計
-- ==========================================
SELECT
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  COUNT(*) FILTER (WHERE error_message LIKE '%429%' OR error_message LIKE '%rate limit%') as rate_limit_errors,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as success_rate_percent,
  ROUND(
    (COUNT(*) FILTER (WHERE error_message LIKE '%429%')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as rate_limit_error_percent
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours';

-- ==========================================
-- 3. 時間別の実行統計（過去24時間）
-- ==========================================
SELECT
  DATE_TRUNC('hour', executed_at) as hour,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE success = true) as succeeded,
  COUNT(*) FILTER (WHERE success = false) as failed,
  COUNT(*) FILTER (WHERE error_message LIKE '%429%') as rate_limit_errors,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as success_rate
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', executed_at)
ORDER BY hour DESC;

-- ==========================================
-- 4. 現在のレート制限状況
-- ==========================================
SELECT
  endpoint,
  limit_total,
  remaining,
  ROUND((remaining::NUMERIC / NULLIF(limit_total, 0)) * 100, 2) as remaining_percent,
  reset_at,
  CASE
    WHEN remaining = 0 THEN '🚨 制限到達'
    WHEN (remaining::NUMERIC / NULLIF(limit_total, 0)) < 0.1 THEN '🔴 危険 (10%以下)'
    WHEN (remaining::NUMERIC / NULLIF(limit_total, 0)) < 0.2 THEN '⚠️ 警告 (20%以下)'
    WHEN (remaining::NUMERIC / NULLIF(limit_total, 0)) < 0.5 THEN '🟡 注意 (50%以下)'
    ELSE '✅ 正常'
  END as status,
  EXTRACT(MINUTE FROM (reset_at - NOW())) as minutes_until_reset
FROM rate_limits
WHERE window_started_at > NOW() - INTERVAL '1 hour'
  AND endpoint IN (
    '/2/users/:id/following',
    '/2/tweets',
    '/2/users/:id/likes',
    '/2/tweets/search/recent'
  )
ORDER BY remaining_percent ASC
LIMIT 20;

-- ==========================================
-- 5. 最近の429エラーの詳細
-- ==========================================
SELECT
  executed_at,
  rule_id,
  action_type,
  error_message,
  actions_attempted,
  actions_succeeded,
  actions_failed
FROM auto_engagement_executions
WHERE (error_message LIKE '%429%' OR error_message LIKE '%rate limit%')
  AND executed_at > NOW() - INTERVAL '24 hours'
ORDER BY executed_at DESC
LIMIT 10;

-- ==========================================
-- 6. 総合ステータス（シンプル版）
-- ==========================================
WITH token_count AS (
  SELECT COUNT(*) as active_tokens
  FROM account_tokens
  WHERE is_active = true AND token_type = 'oauth2'
),
recent_stats AS (
  SELECT
    COUNT(*) as total_exec,
    COUNT(*) FILTER (WHERE error_message LIKE '%429%') as rate_errors,
    COUNT(*) FILTER (WHERE success = false) as total_errors
  FROM auto_engagement_executions
  WHERE executed_at > NOW() - INTERVAL '1 hour'
)
SELECT
  '🔹 トークン' as check_item,
  CASE
    WHEN tc.active_tokens = 0 THEN '🚨 0件 - 即座に対応必要'
    WHEN tc.active_tokens < 3 THEN '⚠️ ' || tc.active_tokens || '件 - 少数'
    ELSE '✅ ' || tc.active_tokens || '件 - 正常'
  END as status
FROM token_count tc
UNION ALL
SELECT
  '🔹 エンゲージメント (過去1時間)',
  CASE
    WHEN rs.total_exec = 0 THEN '⚪ 実行なし'
    WHEN rs.rate_errors::NUMERIC / NULLIF(rs.total_exec, 0) > 0.1 THEN '🚨 429エラー頻発 (' || rs.rate_errors || '/' || rs.total_exec || ')'
    WHEN rs.rate_errors > 0 THEN '⚠️ 429エラーあり (' || rs.rate_errors || '/' || rs.total_exec || ')'
    WHEN rs.total_errors > 0 THEN '⚠️ エラーあり (' || rs.total_errors || '/' || rs.total_exec || ')'
    ELSE '✅ エラーなし (' || rs.total_exec || '件実行)'
  END
FROM recent_stats rs;
